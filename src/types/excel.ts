export interface ExcelOperationItem {
  date: string
  time?: string
  amount: number
}

export interface ExcelOperationGroup {
  month: number
  year: number
  operationCategory: string
  description: string
  totalAmount: number
  items: ExcelOperationItem[]
}
