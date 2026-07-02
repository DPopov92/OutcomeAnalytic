import type { GroupedExpense } from '../types/expense'

export interface OperationPeriod {
  month: number
  year: number
}

export function comparePeriods(
  left: OperationPeriod,
  right: OperationPeriod,
): number {
  if (left.year !== right.year) {
    return right.year - left.year
  }

  return right.month - left.month
}

export function getLatestPeriod(
  operations: GroupedExpense[],
): OperationPeriod | null {
  const periods = getAvailablePeriods(operations)
  return periods[0] ?? null
}

export function getAvailablePeriods(
  operations: GroupedExpense[],
): OperationPeriod[] {
  const unique = new Map<string, OperationPeriod>()

  for (const operation of operations) {
    const key = `${operation.year}-${operation.month}`
    unique.set(key, { month: operation.month, year: operation.year })
  }

  return Array.from(unique.values()).sort(comparePeriods)
}

export function getAvailableYears(operations: GroupedExpense[]): number[] {
  return [...new Set(operations.map((operation) => operation.year))].sort(
    (left, right) => right - left,
  )
}

export function getMonthsForYear(
  operations: GroupedExpense[],
  year: number,
): number[] {
  return [
    ...new Set(
      operations
        .filter((operation) => operation.year === year)
        .map((operation) => operation.month),
    ),
  ].sort((left, right) => right - left)
}

export function filterOperationsByPeriod(
  operations: GroupedExpense[],
  period: OperationPeriod,
): GroupedExpense[] {
  return operations.filter(
    (operation) =>
      operation.month === period.month && operation.year === period.year,
  )
}
