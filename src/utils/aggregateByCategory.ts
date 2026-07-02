import { DEFAULT_CATEGORY_COLOR } from '../constants/categoryPresetColors'
import type { GroupedExpense } from '../types/expense'
import { resolveCategoryColor } from './categoryColors'

export interface CategoryTotal {
  category: string
  amount: number
  percentage: number
  color: string
}

export function aggregateCategoryTotals(
  operations: GroupedExpense[],
  categoryColors: Record<string, string>,
): CategoryTotal[] {
  const totals = new Map<string, number>()

  for (const operation of operations) {
    totals.set(
      operation.category,
      (totals.get(operation.category) ?? 0) + operation.amount,
    )
  }

  const grandTotal = Array.from(totals.values()).reduce((sum, value) => sum + value, 0)
  if (grandTotal === 0) {
    return []
  }

  return Array.from(totals.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: (amount / grandTotal) * 100,
      color:
        resolveCategoryColor(category, categoryColors) ?? DEFAULT_CATEGORY_COLOR,
    }))
    .sort((left, right) => right.amount - left.amount)
}
