export interface OzonReceiptItem {
  name: string
  quantity: number
  /** Цена за единицу товара */
  price: number
}

export interface OzonReceipt {
  totalAmount: number
  date: string
  items: OzonReceiptItem[]
}

export interface OzonReceiptsFile {
  source: 'ozon'
  exportedAt: string
  month?: string
  receipts: OzonReceipt[]
}

export function normalizeReceiptItem(
  item: Pick<OzonReceiptItem, 'name' | 'price'> & { quantity?: number },
): OzonReceiptItem {
  const quantity =
    typeof item.quantity === 'number' && item.quantity > 0
      ? Math.round(item.quantity * 1000) / 1000
      : 1

  return {
    name: item.name.trim(),
    quantity,
    price: Math.round(item.price * 100) / 100,
  }
}

export function receiptItemLineTotal(item: OzonReceiptItem): number {
  return Math.round(item.quantity * item.price * 100) / 100
}

export function sumReceiptItems(items: OzonReceiptItem[]): number {
  return Math.round(items.reduce((sum, item) => sum + receiptItemLineTotal(item), 0) * 100) / 100
}

const MONEY_EPSILON = 0.02

export function resolveReceiptUnitPrice(
  unitPrice: number | null,
  lineTotal: number | null,
  quantity: number,
): number | null {
  const qty = Math.max(1, quantity)

  if (lineTotal != null && lineTotal > 0) {
    const unitFromLine = Math.round((lineTotal / qty) * 100) / 100

    if (unitPrice != null) {
      if (Math.abs(unitPrice * qty - lineTotal) <= MONEY_EPSILON) {
        return unitPrice
      }

      if (Math.abs(unitPrice - lineTotal) <= MONEY_EPSILON) {
        return unitFromLine
      }

      return unitFromLine
    }

    return unitFromLine
  }

  if (unitPrice != null) {
    if (qty > 1) {
      const unitFromLine = Math.round((unitPrice / qty) * 100) / 100
      if (unitFromLine > 0 && Math.abs(unitFromLine * qty - unitPrice) <= MONEY_EPSILON) {
        return unitFromLine
      }
    }

    return unitPrice
  }

  return null
}

export function pickReceiptLineTotal(
  amounts: number[],
  unitPrice: number | null,
  quantity: number,
): number | null {
  if (amounts.length === 0) {
    return null
  }

  const qty = Math.max(1, quantity)
  const expectedFromUnit =
    unitPrice != null ? Math.round(unitPrice * qty * 100) / 100 : null

  if (expectedFromUnit != null) {
    const matching = amounts.filter((amount) => Math.abs(amount - expectedFromUnit) <= MONEY_EPSILON)
    if (matching.length > 0) {
      return matching[matching.length - 1] ?? null
    }
  }

  if (amounts.length === 1) {
    return amounts[0] ?? null
  }

  return amounts.reduce((max, amount) => (amount > max ? amount : max), amounts[0] ?? 0)
}

export function isOzonReceiptItem(value: unknown): value is OzonReceiptItem {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>

  return (
    typeof record.name === 'string' &&
    typeof record.price === 'number' &&
    (record.quantity == null ||
      (typeof record.quantity === 'number' && Number.isFinite(record.quantity)))
  )
}

export function isOzonReceipt(value: unknown): value is OzonReceipt {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>

  return (
    typeof record.totalAmount === 'number' &&
    typeof record.date === 'string' &&
    Array.isArray(record.items) &&
    record.items.every(isOzonReceiptItem)
  )
}

export function isOzonReceiptsFile(value: unknown): value is OzonReceiptsFile {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>

  return (
    record.source === 'ozon' &&
    typeof record.exportedAt === 'string' &&
    Array.isArray(record.receipts) &&
    record.receipts.every(isOzonReceipt)
  )
}

export function normalizeReceipt(receipt: OzonReceipt): OzonReceipt {
  const items = receipt.items.map((item) => normalizeReceiptItem(item))

  return {
    date: receipt.date,
    totalAmount: receipt.totalAmount > 0 ? receipt.totalAmount : sumReceiptItems(items),
    items,
  }
}
