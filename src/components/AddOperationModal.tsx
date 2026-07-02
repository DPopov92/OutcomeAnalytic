import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { addOperation, mapOperationDto } from '../api/operations'
import { SaveIcon } from '../assets/icons/SaveIcon'
import type { Category } from '../types/category'
import { getCurrentPeriod } from '../utils/operationPeriods'
import { CategorySelect } from './CategorySelect'
import { PeriodSelect } from './PeriodSelect'

const MANUAL_OPERATION_CATEGORY = 'Вручную'

interface AddOperationModalProps {
  categories: Category[]
  categoryColors: Record<string, string>
  onClose: () => void
  onSaved: (operations: ReturnType<typeof mapOperationDto>[]) => void
}

function parseAmountInput(value: string): number | null {
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  if (!normalized) {
    return null
  }

  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function AddOperationModal({
  categories,
  categoryColors,
  onClose,
  onSaved,
}: AddOperationModalProps) {
  const [period, setPeriod] = useState(getCurrentPeriod)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [categoryError, setCategoryError] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const trimmedDescription = description.trim()
    const trimmedCategory = category.trim()
    const parsedAmount = parseAmountInput(amount)

    if (!trimmedDescription) {
      setError('Введите описание операции.')
      return
    }

    if (!trimmedCategory) {
      setCategoryError(true)
      setError('Выберите категорию.')
      return
    }

    if (parsedAmount === null || parsedAmount === 0) {
      setError('Укажите сумму операции.')
      return
    }

    setSaving(true)
    setError(null)
    setCategoryError(false)

    try {
      const response = await addOperation({
        month: period.month,
        year: period.year,
        operationCategory: MANUAL_OPERATION_CATEGORY,
        description: trimmedDescription,
        category: trimmedCategory,
        amount: parsedAmount,
      })

      onSaved(response.operations.map(mapOperationDto))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить операцию.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={saving ? undefined : onClose}>
      <DialogTitle
        id="add-operation-title"
        sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}
      >
        <Box>
          <Typography variant="h6" component="span">
            Добавить операцию
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Операция будет сохранена и отобразится в таблице и статистике.
          </Typography>
        </Box>
        <IconButton aria-label="Закрыть" disabled={saving} onClick={onClose} sx={{ mt: -0.5 }}>
          ×
        </IconButton>
      </DialogTitle>

      <Box component="form" onSubmit={(event) => void handleSubmit(event)}>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                Период
              </Typography>
              <PeriodSelect value={period} disabled={saving} onChange={setPeriod} />
            </Box>

            <TextField
              label="Описание"
              value={description}
              disabled={saving}
              placeholder="Например: Продукты в магазине"
              required
              fullWidth
              onChange={(event) => setDescription(event.target.value)}
            />

            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                Категория
              </Typography>
              <CategorySelect
                value={category}
                categories={categories}
                categoryColors={categoryColors}
                placeholder="Выберите категорию"
                hasError={categoryError}
                disabled={saving || categories.length === 0}
                onChange={(value) => {
                  setCategory(value)
                  setCategoryError(false)
                }}
              />
              {categories.length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                  Сначала создайте категории через кнопку «Категории».
                </Typography>
              )}
            </Box>

            <TextField
              label="Сумма, ₽"
              value={amount}
              disabled={saving}
              placeholder="0,00"
              required
              fullWidth
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              onChange={(event) => setAmount(event.target.value)}
            />

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button variant="outlined" disabled={saving} onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={saving || categories.length === 0}
            startIcon={<SaveIcon size={16} strokeWidth={2} />}
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
