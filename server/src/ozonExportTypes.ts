export interface OzonExportItem {
  name: string
  quantity: number
  price: number
}

export interface OzonExportOrder {
  orderNumber: string
  date: string
  status: string
  totalAmount: number
  items: OzonExportItem[]
}

export interface OzonExportFile {
  source: 'ozon'
  exportedAt: string
  period?: {
    from: string
    to: string
  }
  splitByItems?: boolean
  orders: OzonExportOrder[]
}

export function isOzonExportFile(value: unknown): value is OzonExportFile {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>

  return (
    record.source === 'ozon' &&
    typeof record.exportedAt === 'string' &&
    Array.isArray(record.orders)
  )
}
