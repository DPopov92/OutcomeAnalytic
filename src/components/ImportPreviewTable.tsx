import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { DeleteIcon } from '../assets/icons/DeleteIcon'
import { RestoreIcon } from '../assets/icons/RestoreIcon'
import type { Category } from '../types/category'
import { formatPeriod } from '../types/expense'
import { CategorySelect } from './CategorySelect'
import './ImportPreviewTable.css'

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

  function handleChange(nextDraft: string) {
    setDraft(nextDraft)
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
      <button
        type="button"
        className="import-preview-amount-display"
        disabled={disabled}
        aria-label="Изменить сумму операции"
        onClick={startEditing}
      >
        {amountFormatter.format(normalizedValue)}
      </button>
    )
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      className="import-preview-amount-input"
      value={draft}
      disabled={disabled}
      aria-label="Сумма операции"
      onChange={(event) => handleChange(event.target.value)}
      onBlur={commitDraft}
      onKeyDown={handleKeyDown}
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
      <div className="table-empty">
        <p>Нет операций для загрузки.</p>
      </div>
    )
  }

  return (
    <div className="table-section compact import-preview-table">
      <div className="table-header">
        <div>
          <h2>Операции из файла</h2>
          <p className="table-period">
            Назначьте категории и при необходимости скорректируйте суммы
          </p>
        </div>
        <p>
          Всего: <strong>{activeOperations.length}</strong>
          {activeOperations.length !== operations.length ? (
            <>
              {' '}
              из <strong>{operations.length}</strong>
            </>
          ) : null}{' '}
          · Сумма: <strong>{amountFormatter.format(total)}</strong>
        </p>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Период</th>
              <th>Категория операции</th>
              <th>Описание</th>
              <th className="col-amount">Сумма</th>
              <th>Категории</th>
              {onToggleOperationRemoved && <th className="col-actions" aria-label="Действия" />}
            </tr>
          </thead>
          <tbody>
            {operations.map((operation) => {
              const hasUserCategory = operation.userCategory.trim().length > 0
              const isRemoved = Boolean(operation.removed)

              return (
                <tr
                  key={operation.id}
                  className={isRemoved ? 'import-preview-row-removed' : undefined}
                >
                  <td>{formatPeriod(operation.month, operation.year)}</td>
                  <td>{operation.operationCategory}</td>
                  <td>{operation.description || '—'}</td>
                  <td className="col-amount">
                    {!isRemoved && onAmountChange ? (
                      <ImportPreviewAmountInput
                        value={operation.amount}
                        onChange={(amount) => onAmountChange(operation.id, amount)}
                      />
                    ) : (
                      amountFormatter.format(operation.amount)
                    )}
                  </td>
                  <td>
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
                  </td>
                  {onToggleOperationRemoved && (
                    <td className="col-actions">
                      <button
                        type="button"
                        className={
                          isRemoved ? 'row-restore-btn' : 'row-delete-btn'
                        }
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
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
