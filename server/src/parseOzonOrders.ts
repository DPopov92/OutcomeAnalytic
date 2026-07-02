import type { ParsedExpenseRow } from './parseExcel.js'
import {
  isOzonExportFile,
  type OzonExportFile,
  type OzonExportOrder,
} from './ozonExportTypes.js'

export const OZON_OPERATION_CATEGORY = 'Ozon'

export interface ParseOzonOrdersOptions {
  excludeStatuses?: string[]
}

export interface ParseOzonOrdersResult {
  rows: ParsedExpenseRow[]
  exportFile: OzonExportFile
}

export function parseOzonOrdersBuffer(
  fileBuffer: Buffer,
  options: ParseOzonOrdersOptions = {},
): ParseOzonOrdersResult {
  let parsed: unknown

  try {
    parsed = JSON.parse(fileBuffer.toString('utf8'))
  } catch {
    throw new Error('Файл не похож на выгрузку Ozon: некорректный JSON.')
  }

  if (!isOzonExportFile(parsed)) {
    throw new Error(
      'Файл не похож на выгрузку Ozon. Ожидается JSON с полем source: "ozon" и массивом orders.',
    )
  }

  return parseOzonExportFile(parsed, options)
}

export function parseOzonExportFile(
  exportFile: OzonExportFile,
  options: ParseOzonOrdersOptions = {},
): ParseOzonOrdersResult {
  const excludeStatuses = new Set(
    (options.excludeStatuses ?? ['cancelled']).map((status) => status.toLowerCase()),
  )

  const filteredOrders = exportFile.orders.filter((order) => {
    if (excludeStatuses.has(order.status.trim().toLowerCase())) {
      return false
    }

    if (!exportFile.period) {
      return true
    }

    const orderDate = parseOrderDate(order.date)
    if (!orderDate) {
      return false
    }

    const from = parsePeriodBoundary(exportFile.period.from, 'start')
    const to = parsePeriodBoundary(exportFile.period.to, 'end')

    if (from && orderDate < from) {
      return false
    }

    if (to && orderDate > to) {
      return false
    }

    return true
  })

  if (filteredOrders.length === 0) {
    throw new Error('В выгрузке Ozon не найдено заказов за указанный период.')
  }

  const rows: ParsedExpenseRow[] = []

  for (const order of filteredOrders) {
    rows.push(...mapOrderToExpenseRows(order, exportFile.splitByItems === true))
  }

  return {
    rows: rows.sort((a, b) => b.date.getTime() - a.date.getTime()),
    exportFile: {
      ...exportFile,
      orders: filteredOrders,
    },
  }
}

function mapOrderToExpenseRows(
  order: OzonExportOrder,
  splitByItems: boolean,
): ParsedExpenseRow[] {
  const date = parseOrderDate(order.date)

  if (!date) {
    throw new Error(`Заказ ${order.orderNumber}: некорректная дата.`)
  }

  if (splitByItems && order.items.length > 0) {
    return order.items.map((item) => ({
      date,
      operationCategory: OZON_OPERATION_CATEGORY,
      description: buildItemDescription(order.orderNumber, item.name),
      amount: normalizeAmount(item.price * item.quantity),
    }))
  }

  return [
    {
      date,
      operationCategory: OZON_OPERATION_CATEGORY,
      description: buildOrderDescription(order),
      amount: normalizeAmount(order.totalAmount),
    },
  ]
}

export function buildOrderDescription(order: OzonExportOrder): string {
  const itemNames = order.items.map((item) => item.name.trim()).filter(Boolean)

  if (itemNames.length === 0) {
    return `Заказ #${order.orderNumber}`
  }

  if (itemNames.length === 1) {
    return `Заказ #${order.orderNumber}: ${itemNames[0]}`
  }

  const preview = itemNames.slice(0, 2).join(', ')
  const suffix =
    itemNames.length > 2 ? ` и ещё ${itemNames.length - 2}` : ''

  return `Заказ #${order.orderNumber}: ${preview}${suffix}`
}

function buildItemDescription(orderNumber: string, itemName: string): string {
  const name = itemName.trim() || 'Товар'
  return `Заказ #${orderNumber}: ${name}`
}

function parseOrderDate(value: string): Date | null {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function parsePeriodBoundary(
  value: string,
  boundary: 'start' | 'end',
): Date | null {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!isoMatch) {
    return null
  }

  const year = Number(isoMatch[1])
  const month = Number(isoMatch[2]) - 1
  const day = Number(isoMatch[3])

  if (boundary === 'start') {
    return new Date(year, month, day, 0, 0, 0, 0)
  }

  return new Date(year, month, day, 23, 59, 59, 999)
}

function normalizeAmount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.round(value * 100) / 100
}
