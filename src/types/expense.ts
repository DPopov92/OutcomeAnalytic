export interface ParsedExpenseRow {
  id: string
  date: Date
  operationCategory: string
  amount: number
  description: string
}

export interface GroupedExpense {
  id: string
  month: number
  year: number
  category: string
  amount: number
}

export interface GroupedExpenseInput {
  category: string
  amount: number
}

export interface CategoryMappingInput {
  operationCategory: string
  description: string
  category: string
}

export const REQUIRED_COLUMNS = [
  'Дата',
  'Категория операции',
  'Сумма',
  'Описание',
] as const

export const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const

export function formatPeriod(month: number, year: number): string {
  const monthName = MONTH_NAMES[month - 1]
  return monthName ? `${monthName} ${year}` : `${month}/${year}`
}
