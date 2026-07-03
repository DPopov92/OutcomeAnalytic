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

export function getCurrentPeriod(): OperationPeriod {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

export function getDefaultSelectableYears(): number[] {
  const currentYear = new Date().getFullYear()
  const years: number[] = []

  for (let year = currentYear + 1; year >= currentYear - 10; year -= 1) {
    years.push(year)
  }

  return years
}

export function getAllMonths(): number[] {
  return Array.from({ length: 12 }, (_, index) => 12 - index)
}

export function periodToSortKey(period: OperationPeriod): number {
  return period.year * 12 + period.month
}

export function isPeriodBefore(
  left: OperationPeriod,
  right: OperationPeriod,
): boolean {
  return periodToSortKey(left) < periodToSortKey(right)
}

export function isPeriodAfter(
  left: OperationPeriod,
  right: OperationPeriod,
): boolean {
  return periodToSortKey(left) > periodToSortKey(right)
}

export function getEarliestPeriod(
  operations: GroupedExpense[],
): OperationPeriod | null {
  const periods = getAvailablePeriods(operations)
  return periods[periods.length - 1] ?? null
}

export function getPeriodsInRange(
  from: OperationPeriod,
  to: OperationPeriod,
): OperationPeriod[] {
  const startKey = periodToSortKey(from)
  const endKey = periodToSortKey(to)
  const [rangeStart, rangeEnd] =
    startKey <= endKey ? [startKey, endKey] : [endKey, startKey]

  const periods: OperationPeriod[] = []

  for (let key = rangeStart; key <= rangeEnd; key += 1) {
    const year = Math.floor((key - 1) / 12)
    const month = ((key - 1) % 12) + 1
    periods.push({ month, year })
  }

  return periods
}

export function filterOperationsByPeriodRange(
  operations: GroupedExpense[],
  from: OperationPeriod,
  to: OperationPeriod,
): GroupedExpense[] {
  const startKey = periodToSortKey(from)
  const endKey = periodToSortKey(to)
  const rangeStart = Math.min(startKey, endKey)
  const rangeEnd = Math.max(startKey, endKey)

  return operations.filter((operation) => {
    const key = periodToSortKey({
      month: operation.month,
      year: operation.year,
    })
    return key >= rangeStart && key <= rangeEnd
  })
}
