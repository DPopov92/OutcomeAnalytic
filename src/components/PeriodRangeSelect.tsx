import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useId, useMemo } from 'react'
import { MONTH_NAMES, type GroupedExpense } from '../types/expense'
import {
  getAllMonths,
  getAvailableYears,
  getDefaultSelectableYears,
  getMonthsForYear,
  isPeriodAfter,
  isPeriodBefore,
  type OperationPeriod,
} from '../utils/operationPeriods'

export interface PeriodRange {
  from: OperationPeriod
  to: OperationPeriod
}

interface PeriodRangeSelectProps {
  value: PeriodRange
  onChange: (range: PeriodRange) => void
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

interface SinglePeriodSelectProps {
  label: string
  value: OperationPeriod
  onChange: (period: OperationPeriod) => void
  operations?: GroupedExpense[]
  years: number[]
  disabled?: boolean
  size?: 'small' | 'medium'
}

function SinglePeriodSelect({
  label,
  value,
  onChange,
  operations,
  years,
  disabled = false,
  size = 'small',
}: SinglePeriodSelectProps) {
  const monthLabelId = useId()
  const yearLabelId = useId()

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
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ minWidth: 20, fontWeight: 600 }}
      >
        {label}
      </Typography>
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
          {years.map((year) => (
            <MenuItem key={year} value={year}>
              {year}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  )
}

export function PeriodRangeSelect({
  value,
  onChange,
  operations,
  years,
  disabled = false,
  size = 'small',
}: PeriodRangeSelectProps) {
  const availableYears = useMemo(
    () => resolveAvailableYears(operations, years),
    [operations, years],
  )

  function handleFromChange(from: OperationPeriod) {
    const nextRange = { from, to: value.to }

    if (isPeriodAfter(from, value.to)) {
      nextRange.to = from
    }

    onChange(nextRange)
  }

  function handleToChange(to: OperationPeriod) {
    const nextRange = { from: value.from, to }

    if (isPeriodBefore(to, value.from)) {
      nextRange.from = to
    }

    onChange(nextRange)
  }

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={{ xs: 1.5, sm: 2 }}
      sx={{ alignItems: { xs: 'stretch', sm: 'center' }, width: 'fit-content' }}
    >
      <SinglePeriodSelect
        label="С"
        value={value.from}
        onChange={handleFromChange}
        operations={operations}
        years={availableYears}
        disabled={disabled}
        size={size}
      />
      <SinglePeriodSelect
        label="По"
        value={value.to}
        onChange={handleToChange}
        operations={operations}
        years={availableYears}
        disabled={disabled}
        size={size}
      />
    </Stack>
  )
}
