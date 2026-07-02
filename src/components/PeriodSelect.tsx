import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import { useId, useMemo } from 'react'
import { MONTH_NAMES, type GroupedExpense } from '../types/expense'
import {
  getAllMonths,
  getAvailableYears,
  getDefaultSelectableYears,
  getMonthsForYear,
  type OperationPeriod,
} from '../utils/operationPeriods'

interface PeriodSelectProps {
  value: OperationPeriod
  onChange: (period: OperationPeriod) => void
  operations?: GroupedExpense[]
  years?: number[]
  disabled?: boolean
  size?: 'small' | 'medium'
}

function resolveAvailableYears(
  operations: GroupedExpense[] | undefined,
  years: number[] | undefined,
): number[] {
  if (years) {
    return years
  }

  if (operations && operations.length > 0) {
    return getAvailableYears(operations)
  }

  return getDefaultSelectableYears()
}

function resolveAvailableMonths(
  operations: GroupedExpense[] | undefined,
  year: number,
): number[] {
  if (operations && operations.length > 0) {
    return getMonthsForYear(operations, year)
  }

  return getAllMonths()
}

export function PeriodSelect({
  value,
  onChange,
  operations,
  years,
  disabled = false,
  size = 'small',
}: PeriodSelectProps) {
  const monthLabelId = useId()
  const yearLabelId = useId()

  const availableYears = useMemo(
    () => resolveAvailableYears(operations, years),
    [operations, years],
  )

  const availableMonths = useMemo(
    () => resolveAvailableMonths(operations, value.year),
    [operations, value.year],
  )

  function handleYearChange(year: number) {
    const months = resolveAvailableMonths(operations, year)
    const nextMonth = months.includes(value.month) ? value.month : (months[0] ?? 1)

    onChange({ year, month: nextMonth })
  }

  function handleMonthChange(month: number) {
    onChange({ ...value, month })
  }

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: 'center', width: 'fit-content' }}
    >
      <FormControl size={size} sx={{ minWidth: 120 }} disabled={disabled}>
        <InputLabel id={monthLabelId}>Месяц</InputLabel>
        <Select
          labelId={monthLabelId}
          label="Месяц"
          value={value.month}
          onChange={(event) =>
            handleMonthChange(Number.parseInt(String(event.target.value), 10))
          }
        >
          {availableMonths.map((month) => (
            <MenuItem key={month} value={month}>
              {MONTH_NAMES[month - 1] ?? month}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size={size} sx={{ minWidth: 88 }} disabled={disabled}>
        <InputLabel id={yearLabelId}>Год</InputLabel>
        <Select
          labelId={yearLabelId}
          label="Год"
          value={value.year}
          onChange={(event) =>
            handleYearChange(Number.parseInt(String(event.target.value), 10))
          }
        >
          {availableYears.map((year) => (
            <MenuItem key={year} value={year}>
              {year}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  )
}
