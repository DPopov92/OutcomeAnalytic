import type {
  ExcelOperationGroupDto,
  ExcelOperationItemDto,
  FileOperationRecord,
  GroupedPreviewRecord,
} from './types.js'
import type { ParsedExpenseRow } from './parseExcel.js'
import { toDateKey } from './parseExcel.js'

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

function sortExcelItems(items: ExcelOperationItemDto[]): ExcelOperationItemDto[] {
  return [...items].sort((left, right) => {
    const dateCompare = right.date.localeCompare(left.date)
    if (dateCompare !== 0) {
      return dateCompare
    }

    return (right.time ?? '').localeCompare(left.time ?? '')
  })
}

function formatOperationTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function compareExcelGroups(
  left: ExcelOperationGroupDto,
  right: ExcelOperationGroupDto,
): number {
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
}

export function buildExcelGroupsFromBatch(
  rows: FileOperationRecord[],
): ExcelOperationGroupDto[] {
  const grouped = new Map<string, ExcelOperationGroupDto>()

  for (const row of rows) {
    const [yearStr, monthStr] = row.date.split('-')
    const year = Number(yearStr)
    const month = Number(monthStr)
    const operationCategory = row.operationCategory.trim()
    const description = row.description.trim()
    const key = buildGroupKey(month, year, operationCategory, description)
    const item: ExcelOperationItemDto = {
      date: row.date,
      amount: row.amount,
    }
    const existing = grouped.get(key)

    if (existing) {
      existing.items.push(item)
      existing.totalAmount += row.amount
      continue
    }

    grouped.set(key, {
      month,
      year,
      operationCategory,
      description,
      totalAmount: row.amount,
      items: [item],
    })
  }

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      items: sortExcelItems(group.items),
    }))
    .sort(compareExcelGroups)
}

export function buildExcelGroupsFromParsedRows(
  parsedRows: ParsedExpenseRow[],
  stagedRows: FileOperationRecord[],
): ExcelOperationGroupDto[] {
  const stagedGroupKeys = new Set<string>()

  for (const row of stagedRows) {
    const [yearStr, monthStr] = row.date.split('-')
    stagedGroupKeys.add(
      buildGroupKey(Number(monthStr), Number(yearStr), row.operationCategory, row.description),
    )
  }

  const grouped = new Map<string, ExcelOperationGroupDto>()

  for (const row of parsedRows) {
    const dateKey = toDateKey(row.date)
    const [yearStr, monthStr] = dateKey.split('-')
    const year = Number(yearStr)
    const month = Number(monthStr)
    const operationCategory = row.operationCategory.trim()
    const description = row.description.trim()
    const key = buildGroupKey(month, year, operationCategory, description)

    if (!stagedGroupKeys.has(key)) {
      continue
    }

    const item: ExcelOperationItemDto = {
      date: dateKey,
      time: formatOperationTime(row.date),
      amount: row.amount,
    }
    const existing = grouped.get(key)

    if (existing) {
      existing.items.push(item)
      existing.totalAmount += row.amount
      continue
    }

    grouped.set(key, {
      month,
      year,
      operationCategory,
      description,
      totalAmount: row.amount,
      items: [item],
    })
  }

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      items: sortExcelItems(group.items),
    }))
    .sort(compareExcelGroups)
}
