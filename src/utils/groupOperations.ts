import type { ParsedExpenseRow } from '../types/expense'

export interface GroupedFileOperation {
  id: string
  operationCategory: string
  description: string
  amount: number
}

export function buildMappingKey(operationCategory: string, description: string): string {
  return `${operationCategory.trim()}\0${description.trim()}`
}

export function groupFileOperations(rows: ParsedExpenseRow[]): GroupedFileOperation[] {
  const grouped = new Map<string, GroupedFileOperation>()

  for (const row of rows) {
    const operationCategory = row.operationCategory.trim()
    const description = row.description.trim()
    const key = buildMappingKey(operationCategory, description)
    const existing = grouped.get(key)

    if (existing) {
      existing.amount += row.amount
      continue
    }

    grouped.set(key, {
      id: `group-${grouped.size}`,
      operationCategory,
      description,
      amount: row.amount,
    })
  }

  return Array.from(grouped.values()).sort((left, right) => {
    const categoryCompare = left.operationCategory.localeCompare(right.operationCategory, 'ru')
    if (categoryCompare !== 0) {
      return categoryCompare
    }

    return left.description.localeCompare(right.description, 'ru')
  })
}

export function getDefaultPeriod(rows: ParsedExpenseRow[]): { month: number; year: number } {
  if (rows.length > 0) {
    const date = rows[0].date
    return {
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    }
  }

  const now = new Date()
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  }
}

export function buildYearOptions(centerYear: number, range = 5): number[] {
  return Array.from({ length: range * 2 + 1 }, (_, index) => centerYear - range + index)
}
