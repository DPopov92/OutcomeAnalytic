import type { ParsedExpenseRow } from './parseExcel.js'
import {
  isOzonReceiptsFile,
  normalizeReceipt,
  receiptItemLineTotal,
  type OzonReceipt,
  type OzonReceiptsFile,
} from './ozonReceiptTypes.js'

export const OZON_RECEIPT_CATEGORY = 'Ozon'

export interface ParseOzonReceiptsOptions {
  splitByItems?: boolean
}

export interface ParseOzonReceiptsResult {
  rows: ParsedExpenseRow[]
  receiptsFile: OzonReceiptsFile
}

export function parseOzonReceiptsBuffer(
  fileBuffer: Buffer,
  options: ParseOzonReceiptsOptions = {},
): ParseOzonReceiptsResult {
  let parsed: unknown

  try {
    parsed = JSON.parse(fileBuffer.toString('utf8'))
  } catch {
    throw new Error('Файл не похож на выгрузку чеков Ozon: некорректный JSON.')
  }

  if (!isOzonReceiptsFile(parsed)) {
    throw new Error(
      'Файл не похож на выгрузку чеков Ozon. Ожидается JSON с полем source: "ozon" и массивом receipts.',
    )
  }

  return parseOzonReceiptsFile(parsed, options)
}

export function parseOzonReceiptsFile(
  receiptsFile: OzonReceiptsFile,
  options: ParseOzonReceiptsOptions = {},
): ParseOzonReceiptsResult {
  const filteredReceipts = filterReceiptsByExportPeriod(receiptsFile)

  if (filteredReceipts.length === 0) {
    throw new Error('В выгрузке Ozon не найдено чеков за указанный период.')
  }

  const splitByItems = options.splitByItems === true
  const rows: ParsedExpenseRow[] = []

  for (const receipt of filteredReceipts) {
    rows.push(...mapReceiptToExpenseRows(normalizeReceipt(receipt), splitByItems))
  }

  return {
    rows: rows.sort((a, b) => b.date.getTime() - a.date.getTime()),
    receiptsFile: {
      ...receiptsFile,
      receipts: filteredReceipts.map((receipt) => normalizeReceipt(receipt)),
    },
  }
}

export function buildReceiptDescription(receipt: OzonReceipt): string {
  const itemNames = receipt.items.map((item) => item.name.trim()).filter(Boolean)

  if (itemNames.length === 0) {
    return 'Чек Ozon'
  }

  if (itemNames.length === 1) {
    return `Чек Ozon: ${itemNames[0]}`
  }

  const preview = itemNames.slice(0, 2).join(', ')
  const suffix = itemNames.length > 2 ? ` и ещё ${itemNames.length - 2}` : ''

  return `Чек Ozon: ${preview}${suffix}`
}

function buildItemDescription(name: string, quantity: number): string {
  const label = name.trim() || 'Товар'
  if (quantity > 1) {
    return `Чек Ozon: ${label} (${quantity} шт.)`
  }

  return `Чек Ozon: ${label}`
}

function mapReceiptToExpenseRows(
  receipt: OzonReceipt,
  splitByItems: boolean,
): ParsedExpenseRow[] {
  const date = parseReceiptDate(receipt.date)

  if (!date) {
    throw new Error(`Чек от ${receipt.date}: некорректная дата.`)
  }

  if (splitByItems && receipt.items.length > 0) {
    return receipt.items.map((item) => ({
      date,
      operationCategory: OZON_RECEIPT_CATEGORY,
      description: buildItemDescription(item.name, item.quantity),
      amount: normalizeAmount(receiptItemLineTotal(item)),
    }))
  }

  return [
    {
      date,
      operationCategory: OZON_RECEIPT_CATEGORY,
      description: buildReceiptDescription(receipt),
      amount: normalizeAmount(receipt.totalAmount),
    },
  ]
}

function filterReceiptsByExportPeriod(receiptsFile: OzonReceiptsFile): OzonReceipt[] {
  if (receiptsFile.period) {
    return filterReceiptsByDayMonthYearPeriod(receiptsFile.receipts, receiptsFile.period)
  }

  if (receiptsFile.month && /^\d{4}-\d{2}$/.test(receiptsFile.month)) {
    return filterReceiptsByMonth(receiptsFile.receipts, receiptsFile.month)
  }

  return receiptsFile.receipts
}

function filterReceiptsByDayMonthYearPeriod(
  receipts: OzonReceipt[],
  period: { from: string; to: string },
): OzonReceipt[] {
  const fromDate = parseDayMonthYear(period.from)
  const toDate = parseDayMonthYear(period.to)

  if (!fromDate || !toDate) {
    return receipts
  }

  const start = startOfDay(fromDate)
  const end = endOfDay(toDate)

  return receipts.filter((receipt) => {
    const date = parseReceiptDate(receipt.date)
    if (!date) {
      return false
    }

    const timestamp = date.getTime()
    return timestamp >= start.getTime() && timestamp <= end.getTime()
  })
}

function filterReceiptsByMonth(receipts: OzonReceipt[], month: string): OzonReceipt[] {
  const [yearText, monthText] = month.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1

  return receipts.filter((receipt) => {
    const date = parseReceiptDate(receipt.date)
    if (!date) {
      return false
    }

    return date.getFullYear() === year && date.getMonth() === monthIndex
  })
}

function parseDayMonthYear(value: string): Date | null {
  const match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(value.trim())
  if (!match) {
    return null
  }

  const day = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const year = Number(match[3])
  const date = new Date(year, monthIndex, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function parseReceiptDate(value: string): Date | null {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function normalizeAmount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.round(value * 100) / 100
}
