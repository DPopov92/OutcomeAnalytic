import { DEFAULT_CATEGORY_COLOR } from '../constants/categoryPresetColors'
import { formatPeriod, type GroupedExpense } from '../types/expense'
import { resolveCategoryColor } from './categoryColors'
import { periodToSortKey } from './operationPeriods'

export interface CategorySegment {
  category: string
  amount: number
  color: string
}

export interface MonthStack {
  month: number
  year: number
  label: string
  total: number
  segments: CategorySegment[]
}

export function aggregateMonthlyCategoryStacks(
  operations: GroupedExpense[],
  categoryColors: Record<string, string>,
): MonthStack[] {
  const monthTotals = new Map<string, Map<string, number>>()

  for (const operation of operations) {
    const periodKey = `${operation.year}-${operation.month}`
    const categoryTotals = monthTotals.get(periodKey) ?? new Map<string, number>()

    categoryTotals.set(
      operation.category,
      (categoryTotals.get(operation.category) ?? 0) + operation.amount,
    )
    monthTotals.set(periodKey, categoryTotals)
  }

  const stacks: MonthStack[] = []

  for (const [periodKey, categoryTotals] of monthTotals.entries()) {
    const [yearPart, monthPart] = periodKey.split('-')
    const year = Number.parseInt(yearPart ?? '0', 10)
    const month = Number.parseInt(monthPart ?? '0', 10)

    const segments = Array.from(categoryTotals.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        color:
          resolveCategoryColor(category, categoryColors) ?? DEFAULT_CATEGORY_COLOR,
      }))
      .sort((left, right) => right.amount - left.amount)

    const total = segments.reduce((sum, segment) => sum + segment.amount, 0)

    stacks.push({
      month,
      year,
      label: formatPeriod(month, year),
      total,
      segments,
    })
  }

  return stacks.sort(
    (left, right) =>
      periodToSortKey({ month: left.month, year: left.year }) -
      periodToSortKey({ month: right.month, year: right.year }),
  )
}

export function collectUniqueCategories(stacks: MonthStack[]): CategorySegment[] {
  const totals = new Map<string, { amount: number; color: string }>()

  for (const stack of stacks) {
    for (const segment of stack.segments) {
      const existing = totals.get(segment.category)
      totals.set(segment.category, {
        amount: (existing?.amount ?? 0) + segment.amount,
        color: segment.color,
      })
    }
  }

  return Array.from(totals.entries())
    .map(([category, { amount, color }]) => ({ category, amount, color }))
    .sort((left, right) => right.amount - left.amount)
}
