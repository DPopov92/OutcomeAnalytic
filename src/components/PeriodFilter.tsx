import { useMemo } from 'react'
import { MONTH_NAMES, type GroupedExpense } from '../types/expense'
import {
  getAvailableYears,
  getMonthsForYear,
  type OperationPeriod,
} from '../utils/operationPeriods'
import './PeriodFilter.css'

interface PeriodFilterProps {
  operations: GroupedExpense[]
  selectedPeriod: OperationPeriod
  onPeriodChange: (period: OperationPeriod) => void
}

export function PeriodFilter({
  operations,
  selectedPeriod,
  onPeriodChange,
}: PeriodFilterProps) {
  const availableYears = useMemo(
    () => getAvailableYears(operations),
    [operations],
  )

  const availableMonths = useMemo(
    () => getMonthsForYear(operations, selectedPeriod.year),
    [operations, selectedPeriod.year],
  )

  function handleYearChange(year: number) {
    const months = getMonthsForYear(operations, year)
    const nextMonth = months.includes(selectedPeriod.month)
      ? selectedPeriod.month
      : (months[0] ?? 1)

    onPeriodChange({ year, month: nextMonth })
  }

  function handleMonthChange(month: number) {
    onPeriodChange({ ...selectedPeriod, month })
  }

  return (
    <div className="period-filter">
      <label className="period-filter-field">
        <span className="period-filter-label">Месяц</span>
        <select
          className="period-filter-select"
          value={selectedPeriod.month}
          onChange={(event) =>
            handleMonthChange(Number.parseInt(event.target.value, 10))
          }
        >
          {availableMonths.map((month) => (
            <option key={month} value={month}>
              {MONTH_NAMES[month - 1] ?? month}
            </option>
          ))}
        </select>
      </label>

      <label className="period-filter-field">
        <span className="period-filter-label">Год</span>
        <select
          className="period-filter-select"
          value={selectedPeriod.year}
          onChange={(event) =>
            handleYearChange(Number.parseInt(event.target.value, 10))
          }
        >
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
