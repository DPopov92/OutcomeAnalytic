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

export interface OzonReceiptItem {
  name: string
  quantity: number
  /** Цена за единицу */
  price: number
}

export interface OzonReceipt {
  totalAmount: number
  date: string
  items: OzonReceiptItem[]
}

export function ozonReceiptItemLineTotal(item: OzonReceiptItem): number {
  const quantity = item.quantity > 0 ? item.quantity : 1
  return Math.round(quantity * item.price * 100) / 100
}
