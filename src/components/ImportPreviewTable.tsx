import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { DeleteIcon } from '../assets/icons/DeleteIcon'
import { RestoreIcon } from '../assets/icons/RestoreIcon'
import type { Category } from '../types/category'
import { formatPeriod } from '../types/expense'
import { CategorySelect } from './CategorySelect'

export interface PreviewOperation {
  id: string
  month: number
  year: number
  operationCategory: string
  description: string
  amount: number
  userCategory: string
  removed?: boolean
}

interface ImportPreviewTableProps {
  operations: PreviewOperation[]
  categories: Category[]
  categoryColors: Record<string, string>
  highlightMissingCategories?: boolean
  onUserCategoryChange: (id: string, userCategory: string) => void
  onAmountChange?: (id: string, amount: number) => void
  onToggleOperationRemoved?: (id: string) => void
}

const amountFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
})

function normalizeAmount(amount: number): number {
  return Number.isFinite(amount) ? amount : 0
}

function formatAmountForEdit(amount: number): string {
  return normalizeAmount(amount).toFixed(2).replace('.', ',')
}

function parseAmountInput(value: string): number | null {
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  if (!normalized) {
    return null
  }

  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

interface ImportPreviewAmountInputProps {
  value: number
  disabled?: boolean
  onChange: (amount: number) => void
}

function ImportPreviewAmountInput({
  value,
  disabled = false,
  onChange,
}: ImportPreviewAmountInputProps) {
  const normalizedValue = normalizeAmount(value)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => formatAmountForEdit(normalizedValue))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) {
      setDraft(formatAmountForEdit(normalizedValue))
    }
  }, [normalizedValue, editing])

  useEffect(() => {
    if (!editing) {
      return
    }

    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])

  function commitDraft() {
    const parsed = parseAmountInput(draft)
    if (parsed !== null) {
      onChange(parsed)
    }
    setEditing(false)
  }

  function startEditing() {
    if (disabled) {
      return
    }

    setDraft(formatAmountForEdit(normalizedValue))
    setEditing(true)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitDraft()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setDraft(formatAmountForEdit(normalizedValue))
      setEditing(false)
    }
  }

  if (!editing) {
    return (
      <Button
        variant="text"
        size="small"
        disabled={disabled}
        aria-label="Изменить сумму операции"
        onClick={startEditing}
        sx={{ minWidth: 0, fontVariantNumeric: 'tabular-nums' }}
      >
        {amountFormatter.format(normalizedValue)}
      </Button>
    )
  }

  return (
    <TextField
      inputRef={inputRef}
      size="small"
      value={draft}
      disabled={disabled}
      aria-label="Сумма операции"
      slotProps={{ htmlInput: { inputMode: 'decimal' } }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commitDraft}
      onKeyDown={handleKeyDown}
      sx={{ width: 120 }}
    />
  )
}

export function ImportPreviewTable({
  operations,
  categories,
  categoryColors,
  highlightMissingCategories = false,
  onUserCategoryChange,
  onAmountChange,
  onToggleOperationRemoved,
}: ImportPreviewTableProps) {
  const activeOperations = operations.filter((operation) => !operation.removed)
  const total = activeOperations.reduce((sum, operation) => sum + operation.amount, 0)

  if (operations.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">Нет операций для загрузки.</Typography>
      </Box>
    )
  }

  return (
    <Stack spacing={2}>
      <Stack
        spacing={1}
        sx={{
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
        }}
      >
        <Box>
          <Typography variant="h6" component="h2">
            Операции из файла
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Назначьте категории и при необходимости скорректируйте суммы
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Всего: <strong>{activeOperations.length}</strong>
          {activeOperations.length !== operations.length ? (
            <>
              {' '}
              из <strong>{operations.length}</strong>
            </>
          ) : null}{' '}
          · Сумма: <strong>{amountFormatter.format(total)}</strong>
        </Typography>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Период</TableCell>
              <TableCell>Категория операции</TableCell>
              <TableCell>Описание</TableCell>
              <TableCell align="right">Сумма</TableCell>
              <TableCell>Категории</TableCell>
              {onToggleOperationRemoved && (
                <TableCell align="center" aria-label="Действия" />
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {operations.map((operation) => {
              const hasUserCategory = operation.userCategory.trim().length > 0
              const isRemoved = Boolean(operation.removed)

              return (
                <TableRow
                  key={operation.id}
                  hover={!isRemoved}
                  sx={isRemoved ? { opacity: 0.5, textDecoration: 'line-through' } : undefined}
                >
                  <TableCell>{formatPeriod(operation.month, operation.year)}</TableCell>
                  <TableCell>{operation.operationCategory}</TableCell>
                  <TableCell>{operation.description || '—'}</TableCell>
                  <TableCell align="right">
                    {!isRemoved && onAmountChange ? (
                      <ImportPreviewAmountInput
                        value={operation.amount}
                        onChange={(amount) => onAmountChange(operation.id, amount)}
                      />
                    ) : (
                      amountFormatter.format(operation.amount)
                    )}
                  </TableCell>
                  <TableCell sx={{ minWidth: 180 }}>
                    {!isRemoved && (
                      <CategorySelect
                        value={operation.userCategory}
                        categories={categories}
                        categoryColors={categoryColors}
                        hasError={highlightMissingCategories && !hasUserCategory}
                        onChange={(userCategory) =>
                          onUserCategoryChange(operation.id, userCategory)
                        }
                      />
                    )}
                  </TableCell>
                  {onToggleOperationRemoved && (
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color={isRemoved ? 'default' : 'error'}
                        onClick={() => onToggleOperationRemoved(operation.id)}
                        aria-label={
                          isRemoved
                            ? `Вернуть операцию: ${operation.operationCategory}`
                            : `Исключить операцию: ${operation.operationCategory}`
                        }
                        title={isRemoved ? 'Вернуть операцию' : 'Исключить операцию'}
                      >
                        {isRemoved ? (
                          <RestoreIcon size={16} strokeWidth={2} />
                        ) : (
                          <DeleteIcon size={16} strokeWidth={2} />
                        )}
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  )
}
