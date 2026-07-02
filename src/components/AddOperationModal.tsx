import { useEffect, useState } from 'react'
import { addOperation, mapOperationDto } from '../api/operations'
import { SaveIcon } from '../assets/icons/SaveIcon'
import type { Category } from '../types/category'
import { CategorySelect } from './CategorySelect'
import './AddOperationModal.css'
import './ImportPreviewModal.css'

const MANUAL_OPERATION_CATEGORY = 'Вручную'

interface AddOperationModalProps {
  categories: Category[]
  categoryColors: Record<string, string>
  onClose: () => void
  onSaved: (operations: ReturnType<typeof mapOperationDto>[]) => void
}

function getDefaultMonthValue(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${now.getFullYear()}-${month}`
}

function parseMonthValue(value: string): { month: number; year: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return null
  }

  return { month, year }
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
  const [period, setPeriod] = useState(getDefaultMonthValue)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [categoryError, setCategoryError] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const parsedPeriod = parseMonthValue(period)
    const trimmedDescription = description.trim()
    const trimmedCategory = category.trim()
    const parsedAmount = parseAmountInput(amount)

    if (!parsedPeriod) {
      setError('Укажите корректный период.')
      return
    }

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
        month: parsedPeriod.month,
        year: parsedPeriod.year,
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
    <div className="modal-overlay" onClick={saving ? undefined : onClose}>
      <div
        className="modal-dialog add-operation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-operation-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="add-operation-title">Добавить операцию</h2>
            <p className="modal-subtitle">
              Операция будет сохранена и отобразится в таблице и статистике.
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            aria-label="Закрыть"
            disabled={saving}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <form className="modal-body add-operation-body" onSubmit={(event) => void handleSubmit(event)}>
          <label className="add-operation-field">
            <span>Период</span>
            <input
              type="month"
              value={period}
              disabled={saving}
              required
              onChange={(event) => setPeriod(event.target.value)}
            />
          </label>

          <label className="add-operation-field">
            <span>Описание</span>
            <input
              type="text"
              value={description}
              disabled={saving}
              placeholder="Например: Продукты в магазине"
              required
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <div className="add-operation-field">
            <span>Категория</span>
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
              <p className="add-operation-hint">
                Сначала создайте категории через кнопку «Категории».
              </p>
            )}
          </div>

          <label className="add-operation-field">
            <span>Сумма, ₽</span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              disabled={saving}
              placeholder="0,00"
              required
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>

          {error && <p className="add-operation-error">{error}</p>}
        </form>

        <footer className="modal-footer">
          <button
            type="button"
            className="button button-secondary"
            disabled={saving}
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={saving || categories.length === 0}
            onClick={(event) => void handleSubmit(event)}
          >
            <SaveIcon size={16} strokeWidth={2} />
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </footer>
      </div>
    </div>
  )
}
