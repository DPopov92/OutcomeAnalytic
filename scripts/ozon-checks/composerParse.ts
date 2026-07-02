import type { OzonReceipt, OzonReceiptItem } from '../../server/src/ozonReceiptTypes.js'
import {
  normalizeReceiptItem,
  resolveReceiptUnitPrice,
  sumReceiptItems,
} from '../../server/src/ozonReceiptTypes.js'

const RECEIPT_ARRAY_KEYS = ['cheques', 'checks', 'receipts', 'eChecks', 'echecks', 'items', 'list']
const PRODUCT_ARRAY_KEYS = ['products', 'items', 'goods', 'positions', 'skuList', 'lineItems']
const DATE_KEYS = ['date', 'createdAt', 'receiptDate', 'operationDate', 'purchaseDate', 'issuedAt']
const TOTAL_KEYS = ['totalAmount', 'totalPrice', 'amount', 'sum', 'price', 'total']
const DOWNLOAD_KEYS = [
  'downloadUrl',
  'pdfUrl',
  'fileUrl',
  'receiptUrl',
  'link',
  'url',
  'href',
  'path',
]

export function extractReceiptsFromComposer(payload: unknown): OzonReceipt[] {
  const receipts: OzonReceipt[] = []
  walkComposerNode(payload, receipts, 0)
  return dedupeReceipts(receipts)
}

export function extractDownloadUrlsFromComposer(payload: unknown): string[] {
  const urls = new Set<string>()
  walkDownloadUrls(payload, urls, 0)
  return [...urls]
}

function walkComposerNode(node: unknown, receipts: OzonReceipt[], depth: number): void {
  if (depth > 24 || node == null) {
    return
  }

  if (typeof node === 'string') {
    if (node.startsWith('{') || node.startsWith('[')) {
      try {
        walkComposerNode(JSON.parse(node), receipts, depth + 1)
      } catch {
        // ignore invalid json strings
      }
    }
    return
  }

  if (Array.isArray(node)) {
    const arrayReceipts = node
      .map((item) => normalizeReceiptRecord(item))
      .filter((item): item is OzonReceipt => item != null)

    if (arrayReceipts.length > 0 && arrayReceipts.length >= Math.min(node.length, 1)) {
      receipts.push(...arrayReceipts)
    }

    for (const item of node) {
      walkComposerNode(item, receipts, depth + 1)
    }
    return
  }

  if (typeof node !== 'object') {
    return
  }

  const record = node as Record<string, unknown>
  const normalized = normalizeReceiptRecord(record)
  if (normalized) {
    receipts.push(normalized)
  }

  for (const key of RECEIPT_ARRAY_KEYS) {
    if (key in record) {
      walkComposerNode(record[key], receipts, depth + 1)
    }
  }

  if ('widgetStates' in record) {
    walkComposerNode(record.widgetStates, receipts, depth + 1)
  }

  for (const [key, value] of Object.entries(record)) {
    if (RECEIPT_ARRAY_KEYS.includes(key) || key === 'widgetStates') {
      continue
    }

    if (/cheque|check|receipt|fiscal|e-check/i.test(key)) {
      walkComposerNode(value, receipts, depth + 1)
      continue
    }

    if (typeof value === 'object' && value != null) {
      walkComposerNode(value, receipts, depth + 1)
    }
  }
}

function walkDownloadUrls(node: unknown, urls: Set<string>, depth: number): void {
  if (depth > 24 || node == null) {
    return
  }

  if (typeof node === 'string') {
    if (isDownloadUrl(node)) {
      urls.add(normalizeUrl(node))
    }

    if (node.startsWith('{') || node.startsWith('[')) {
      try {
        walkDownloadUrls(JSON.parse(node), urls, depth + 1)
      } catch {
        // ignore invalid json strings
      }
    }
    return
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      walkDownloadUrls(item, urls, depth + 1)
    }
    return
  }

  if (typeof node !== 'object') {
    return
  }

  for (const [key, value] of Object.entries(node)) {
    if (DOWNLOAD_KEYS.includes(key) || /download|pdf|file|receipt/i.test(key)) {
      walkDownloadUrls(value, urls, depth + 1)
      continue
    }

    walkDownloadUrls(value, urls, depth + 1)
  }
}

function normalizeReceiptRecord(raw: unknown): OzonReceipt | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const record = raw as Record<string, unknown>
  const date = pickDate(record)
  const items = extractItems(record)
  const totalAmount = normalizeMoney(pickValue(record, TOTAL_KEYS)) ?? sumItems(items)

  if (!date || totalAmount == null || totalAmount <= 0) {
    return null
  }

  if (items.length === 0) {
    return null
  }

  return normalizeReceiptRecordOutput({
    date,
    totalAmount: totalAmount ?? sumItems(items),
    items,
  })
}

function normalizeReceiptRecordOutput(receipt: OzonReceipt): OzonReceipt | null {
  const items = receipt.items.map((item) => normalizeReceiptItem(item))
  const itemsTotal = sumReceiptItems(items)

  if (!receipt.date || items.length === 0) {
    return null
  }

  const totalAmount = receipt.totalAmount > 0 ? receipt.totalAmount : itemsTotal

  if (totalAmount <= 0) {
    return null
  }

  return {
    date: receipt.date,
    totalAmount,
    items,
  }
}

function extractItems(record: Record<string, unknown>): OzonReceiptItem[] {
  for (const key of PRODUCT_ARRAY_KEYS) {
    const products = record[key]
    if (!Array.isArray(products)) {
      continue
    }

    const items = products
      .map((product) => normalizeItem(product))
      .filter((item): item is OzonReceiptItem => item != null)

    if (items.length > 0) {
      return items
    }
  }

  return []
}

function normalizeItem(raw: unknown): OzonReceiptItem | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const record = raw as Record<string, unknown>
  const name = pickString(record, ['name', 'title', 'productName', 'skuName', 'text'])
  const quantity = pickQuantity(record)
  const lineTotal = normalizeMoney(
    pickValue(record, ['totalPrice', 'lineTotal', 'finalPrice', 'amount', 'sum', 'total']),
  )
  const unitPrice = normalizeMoney(
    pickValue(record, ['pricePerUnit', 'unitPrice', 'singlePrice', 'itemPrice']),
  )
  const listPrice = normalizeMoney(record.price)
  const price = resolveReceiptUnitPrice(
    unitPrice ?? (lineTotal == null ? listPrice : null),
    lineTotal,
    quantity,
  )

  if (!name || price == null || price <= 0) {
    return null
  }

  return normalizeReceiptItem({ name: cleanName(name), quantity, price })
}

function pickDate(record: Record<string, unknown>): string | null {
  const direct = pickString(record, DATE_KEYS)
  if (direct) {
    const parsed = new Date(direct)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }

  for (const key of DATE_KEYS) {
    const nested = record[key]
    if (nested && typeof nested === 'object') {
      const nestedDate = pickString(nested as Record<string, unknown>, ['iso', 'value', 'text', 'date'])
      if (nestedDate) {
        const parsed = new Date(nestedDate)
        if (!Number.isNaN(parsed.getTime())) {
          return parsed.toISOString()
        }
      }
    }
  }

  return null
}

function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function pickValue(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in source) {
      return source[key]
    }
  }

  return null
}

function normalizeMoney(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isInteger(value)) {
      return Math.round(value) / 100
    }

    return Math.round(value * 100) / 100
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/\s/g, '').replace(',', '.'))
    if (Number.isFinite(parsed)) {
      return Math.round(parsed * 100) / 100
    }
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return (
      normalizeMoney(record.totalPrice) ??
      normalizeMoney(record.finalPrice) ??
      normalizeMoney(record.lineTotal) ??
      normalizeMoney(record.amount) ??
      normalizeMoney(record.sum) ??
      normalizeMoney(record.total) ??
      normalizeMoney(record.value) ??
      normalizeMoney(record.text) ??
      normalizeMoney(record.price)
    )
  }

  return null
}

function sumItems(items: OzonReceiptItem[]): number {
  return sumReceiptItems(items)
}

function pickQuantity(record: Record<string, unknown>): number {
  for (const key of ['quantity', 'qty', 'count', 'orderedQuantity', 'itemsQuantity']) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return Math.round(value * 1000) / 1000
    }

    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value.replace(',', '.'))
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.round(parsed * 1000) / 1000
      }
    }
  }

  return 1
}

function cleanName(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function isDownloadUrl(value: string): boolean {
  const normalized = value.trim()
  if (!normalized) {
    return false
  }

  const lower = normalized.toLowerCase()

  if (/^\/cheques(?:\/|-|$)/i.test(normalized)) {
    return false
  }

  if (lower.includes('ozon.ru/cheques') && !lower.includes('.pdf')) {
    return false
  }

  if (lower.includes('.pdf')) {
    return true
  }

  if (/1-ofd\.ru|ofd\.|kkt|fiscal|receipt\/download|\/api\/.*(?:pdf|receipt|fiscal)/i.test(normalized)) {
    return true
  }

  return false
}

export function normalizeUrl(value: string): string {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value
  }

  if (value.startsWith('//')) {
    return `https:${value}`
  }

  return new URL(value, 'https://www.ozon.ru').href
}

function dedupeReceipts(receipts: OzonReceipt[]): OzonReceipt[] {
  const seen = new Map<string, OzonReceipt>()

  for (const receipt of receipts) {
    const key = `${receipt.date}::${receipt.totalAmount}::${receipt.items
      .map((item) => `${item.name}:${item.quantity}x${item.price}`)
      .join('|')}`
    seen.set(key, receipt)
  }

  return [...seen.values()]
}
