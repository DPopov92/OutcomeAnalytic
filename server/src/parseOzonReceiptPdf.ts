import { PDFParse } from 'pdf-parse'
import type { OzonReceipt, OzonReceiptItem } from './ozonReceiptTypes.js'
import { normalizeReceipt, pickReceiptLineTotal, resolveReceiptUnitPrice, sumReceiptItems } from './ozonReceiptTypes.js'

const ADVANCE_RECEIPT_PATTERN = /(?:авансов|предоплат)/i
const RETURN_RECEIPT_PATTERN = /(?:возврат\s+прихода|возврат\s+расхода)/i
const TOTAL_LINE_PATTERN =
  /(?:^|\s)(?:ИТОГО|Итого|ВСЕГО|СУММА(?:\s+ПО\s+ЧЕКУ)?)\s*(?:[=:]?\s*)?(\d[\d\s]*(?:[.,]\d{2})?)/i
const DATE_PATTERN =
  /(\d{2})\.(\d{2})\.(\d{2,4})(?:[^\d](\d{2}):(\d{2}))?/
const NUMBERED_ITEM_PATTERN = /^([1-9]\d{0,2})[.)]\s+(.+)$/
const QTY_PRICE_PATTERN =
  /(\d+(?:[.,]\d+)?)\s*(?:шт\.?\s*)?(?:x|×|х|\*)\s*(\d[\d\s]*(?:[.,]\d{2})?)/i
const AMOUNT_PATTERN = /^(\d[\d\s]*(?:[.,]\d{2})?)$/
const TABLE_ROW_PATTERN =
  /^(.+?)\s+(\d+(?:[.,]\d+)?)\s+(\d[\d\s]*(?:[.,]\d{2})?)\s+(\d[\d\s]*(?:[.,]\d{2})?)$/

export function parseOzonReceiptPdfText(text: string): OzonReceipt | null {
  const normalized = normalizeReceiptText(text)

  if (!normalized || isSkippedReceiptType(normalized)) {
    return null
  }

  const date = extractReceiptDate(normalized)
  if (!date) {
    return null
  }

  const items = extractReceiptItems(normalized)
  const totalAmount = extractReceiptTotal(normalized, items)

  if (totalAmount == null || totalAmount <= 0) {
    return null
  }

  if (items.length === 0 && ADVANCE_RECEIPT_PATTERN.test(normalized)) {
    return null
  }

  return normalizeReceipt({
    date,
    totalAmount: totalAmount ?? sumReceiptItems(items),
    items,
  })
}

export function parseOzonReceiptPdfBuffer(buffer: Buffer): OzonReceipt | null {
  return parseOzonReceiptPdfText(extractPdfText(buffer))
}

export async function parseOzonReceiptPdfBufferAsync(buffer: Buffer): Promise<OzonReceipt | null> {
  const text = await extractPdfTextAsync(buffer)
  return parseOzonReceiptPdfText(text)
}

export async function extractPdfTextPreview(buffer: Buffer, limit = 160): Promise<string> {
  const text = await extractPdfTextAsync(buffer)
  return text.replace(/\s+/g, ' ').trim().slice(0, limit)
}

function normalizeReceiptText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function isSkippedReceiptType(text: string): boolean {
  return RETURN_RECEIPT_PATTERN.test(text.slice(0, 400))
}

function extractReceiptDate(text: string): string | null {
  const match = text.match(DATE_PATTERN)
  if (!match) {
    return null
  }

  const day = Number(match[1])
  const month = Number(match[2])
  const year = parseYear(match[3] ?? '')
  const hours = match[4] != null ? Number(match[4]) : 12
  const minutes = match[5] != null ? Number(match[5]) : 0

  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null
  }

  return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString()
}

function parseYear(value: string): number {
  const year = Number(value)
  if (!Number.isFinite(year)) {
    return Number.NaN
  }

  if (year < 100) {
    return year >= 70 ? 1900 + year : 2000 + year
  }

  return year
}

function extractReceiptTotal(text: string, items: OzonReceiptItem[]): number | null {
  const totals: number[] = []

  for (const line of text.split('\n')) {
    const match = line.match(TOTAL_LINE_PATTERN)
    if (!match) {
      continue
    }

    const amount = parseRubAmount(match[1])
    if (amount != null && amount > 0) {
      totals.push(amount)
    }
  }

  if (totals.length > 0) {
    return totals[totals.length - 1] ?? null
  }

  if (items.length > 0) {
    return sumReceiptItems(items)
  }

  return null
}

function extractReceiptItems(text: string): OzonReceiptItem[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const items: OzonReceiptItem[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''

    if (isTotalOrMetaLine(line)) {
      index += 1
      continue
    }

    const tableMatch = line.match(TABLE_ROW_PATTERN)
    if (tableMatch) {
      const name = tableMatch[1]?.trim()
      const quantity = parseQuantityToken(tableMatch[2] ?? '1')
      const unitPrice = parseRubAmount(tableMatch[3] ?? '')
      const lineTotal = parseRubAmount(tableMatch[4] ?? '')

      if (name && !looksLikeHeader(name)) {
        const price = resolveReceiptUnitPrice(unitPrice, lineTotal, quantity)
        if (price != null && price > 0) {
          items.push({ name, quantity, price })
        }
      }

      index += 1
      continue
    }

    const numberedMatch = line.match(NUMBERED_ITEM_PATTERN)
    if (numberedMatch) {
      const name = numberedMatch[2]?.trim() ?? ''
      const parsed = parseItemBlock(lines, index + 1, name)

      if (parsed) {
        items.push({ name: parsed.name, quantity: parsed.quantity, price: parsed.price })
        index = parsed.nextIndex
        continue
      }
    }

    index += 1
  }

  return dedupeItems(items)
}

function parseItemBlock(
  lines: string[],
  startIndex: number,
  name: string,
): { name: string; quantity: number; price: number; nextIndex: number } | null {
  if (!name || looksLikeHeader(name) || isTotalOrMetaLine(name) || looksLikeAmount(name)) {
    return null
  }

  let quantity = 1
  let unitPrice: number | null = null
  const amountLines: number[] = []
  let endIndex = startIndex

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index] ?? ''

    if (NUMBERED_ITEM_PATTERN.test(line)) {
      break
    }

    if (isTotalOrMetaLine(line)) {
      endIndex = index
      break
    }

    const qtyPriceMatch = line.match(QTY_PRICE_PATTERN)
    if (qtyPriceMatch) {
      quantity = parseQuantityToken(qtyPriceMatch[1] ?? '1')
      unitPrice = parseRubAmount(qtyPriceMatch[2] ?? '')
      endIndex = index + 1
      continue
    }

    const qtyOnlyMatch = line.match(/^(\d+(?:[.,]\d+)?)\s*(?:шт\.?|штук(?:а|и)?)/i)
    if (qtyOnlyMatch) {
      quantity = parseQuantityToken(qtyOnlyMatch[1] ?? '1')
      endIndex = index + 1
      continue
    }

    const amountMatch = line.match(AMOUNT_PATTERN)
    if (amountMatch) {
      const amount = parseRubAmount(amountMatch[1] ?? '')
      if (amount != null) {
        amountLines.push(amount)
      }
      endIndex = index + 1
      continue
    }

    endIndex = index + 1
  }

  const lineTotal = pickReceiptLineTotal(amountLines, unitPrice, quantity)
  const price = resolveReceiptUnitPrice(unitPrice, lineTotal, quantity)
  if (price == null || price <= 0) {
    return null
  }

  return {
    name,
    quantity,
    price,
    nextIndex: endIndex,
  }
}

function dedupeItems(items: OzonReceiptItem[]): OzonReceiptItem[] {
  const merged = new Map<string, OzonReceiptItem>()

  for (const item of items) {
    const key = `${item.name}::${item.price}`
    const existing = merged.get(key)

    if (!existing) {
      merged.set(key, { ...item })
      continue
    }

    existing.quantity += item.quantity
  }

  return [...merged.values()]
}

function parseQuantityToken(value: string): number {
  const parsed = Number.parseFloat(value.replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1
  }

  return Math.round(parsed * 1000) / 1000
}

function isTotalOrMetaLine(line: string): boolean {
  return (
    TOTAL_LINE_PATTERN.test(line) ||
    /^(?:наименование|кол\.?|количество|цена|сумма|ндс|фн|фп|фд|смена|кассир|приход|расход)/i.test(
      line,
    ) ||
    /\bндс\b/i.test(line)
  )
}

function looksLikeHeader(value: string): boolean {
  return /^(?:наименование|товар|предмет)/i.test(value.trim())
}

function looksLikeAmount(value: string): boolean {
  return AMOUNT_PATTERN.test(value.trim())
}

function parseRubAmount(value: string): number | null {
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  const parsed = Number.parseFloat(normalized)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return Math.round(parsed * 100) / 100
}

async function extractPdfTextAsync(buffer: Buffer): Promise<string> {
  if (!buffer.subarray(0, 4).equals(Buffer.from('%PDF'))) {
    return buffer.toString('utf8')
  }

  try {
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    await parser.destroy()

    if (result.text.trim()) {
      return result.text
    }
  } catch {
    // fallback to lightweight extractor below
  }

  return extractPdfText(buffer)
}

function extractPdfText(buffer: Buffer): string {
  const chunks: string[] = []
  const content = buffer.toString('latin1')
  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g

  for (const match of content.matchAll(streamPattern)) {
    const stream = match[1] ?? ''
    const textParts = [...stream.matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g)]
      .map((part) => decodePdfString(part[1] ?? ''))
      .filter(Boolean)

    if (textParts.length > 0) {
      chunks.push(textParts.join(' '))
      continue
    }

    const arrayParts = [...stream.matchAll(/\[([^\]]+)\]/g)]
      .flatMap((part) =>
        [...(part[1]?.matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g) ?? [])].map((item) =>
          decodePdfString(item[1] ?? ''),
        ),
      )
      .filter(Boolean)

    if (arrayParts.length > 0) {
      chunks.push(arrayParts.join(' '))
    }
  }

  if (chunks.length > 0) {
    return chunks.join('\n')
  }

  return buffer.toString('utf8')
}

function decodePdfString(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
}
