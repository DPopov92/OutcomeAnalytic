export interface GroupedExpense {
  id: string
  month: number
  year: number
  category: string
  amount: number
}

export interface GroupedPreviewOperation {
  id: string
  month: number
  year: number
  operationCategory: string
  description: string
  amount: number
}

export interface CategoryMappingInput {
  operationCategory: string
  description: string
  category: string
}

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

export function buildMappingKey(operationCategory: string, description: string): string {
  return `${operationCategory.trim()}\0${description.trim()}`
}
