import type { FileOperationRecord, GroupedPreviewRecord } from './types.js'

export function buildGroupKey(
  month: number,
  year: number,
  operationCategory: string,
  description: string,
): string {
  return `${year}\0${month}\0${operationCategory.trim()}\0${description.trim()}`
}

export function buildPreviewId(
  month: number,
  year: number,
  operationCategory: string,
  description: string,
): string {
  return `${year}-${month}-${operationCategory.trim()}-${description.trim()}`
}

export function groupFileOperations(
  rows: FileOperationRecord[],
): GroupedPreviewRecord[] {
  const grouped = new Map<string, GroupedPreviewRecord>()

  for (const row of rows) {
    const [yearStr, monthStr, dayStr] = row.date.split('-')
    const year = Number(yearStr)
    const month = Number(monthStr)
    const operationCategory = row.operationCategory.trim()
    const description = row.description.trim()
    const key = buildGroupKey(month, year, operationCategory, description)
    const existing = grouped.get(key)

    if (existing) {
      existing.amount += row.amount
      continue
    }

    grouped.set(key, {
      id: buildPreviewId(month, year, operationCategory, description),
      month,
      year,
      operationCategory,
      description,
      amount: row.amount,
    })
  }

  return Array.from(grouped.values()).sort((left, right) => {
    if (left.year !== right.year) {
      return right.year - left.year
    }

    if (left.month !== right.month) {
      return right.month - left.month
    }

    const categoryCompare = left.operationCategory.localeCompare(
      right.operationCategory,
      'ru',
    )
    if (categoryCompare !== 0) {
      return categoryCompare
    }

    return left.description.localeCompare(right.description, 'ru')
  })
}
