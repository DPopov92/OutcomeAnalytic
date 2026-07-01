import { useEffect, useMemo, useState } from 'react'
import { fetchCategoryMappings } from '../api/categoryMappings'
import {
  buildMappingKey,
  buildYearOptions,
  getDefaultPeriod,
  groupFileOperations,
} from '../utils/groupOperations'
import { ImportPreviewTable, type PreviewOperation } from './ImportPreviewTable'
import type { CategoryMappingInput, GroupedExpenseInput, ParsedExpenseRow } from '../types/expense'
import { formatPeriod, MONTH_NAMES } from '../types/expense'
import type { Category } from '../types/category'
import './ImportPreviewModal.css'

function buildPreviewOperations(rows: ParsedExpenseRow[]): PreviewOperation[] {
  return groupFileOperations(rows).map((group) => ({
    ...group,
    userCategory: '',
  }))
}

interface ImportPreviewModalProps {
  fileName: string
  rawOperations: ParsedExpenseRow[]
  categories: Category[]
  saving: boolean
  categoryColors?: Record<string, string>
  onConfirm: (payload: {
    month: number
    year: number
    operations: GroupedExpenseInput[]
    mappings: CategoryMappingInput[]
  }) => void
  onCancel: () => void
}

export function ImportPreviewModal({
  fileName,
  rawOperations,
  categories,
  saving,
  categoryColors = {},
  onConfirm,
  onCancel,
}: ImportPreviewModalProps) {
  const defaultPeriod = useMemo(() => getDefaultPeriod(rawOperations), [rawOperations])
  const [month, setMonth] = useState(defaultPeriod.month)
  const [year, setYear] = useState(defaultPeriod.year)
  const [editableOperations, setEditableOperations] = useState<PreviewOperation[]>(() =>
    buildPreviewOperations(rawOperations),
  )
  const [validationError, setValidationError] = useState<string | null>(null)
  const [mappingsLoading, setMappingsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadSavedMappings() {
      setMappingsLoading(true)

      try {
        const mappings = await fetchCategoryMappings()
        if (cancelled) {
          return
        }

        const mappingByKey = new Map(
          mappings.map((mapping) => [
            buildMappingKey(mapping.operationCategory, mapping.description),
            mapping.category,
          ]),
        )
        const categoryNames = new Set(categories.map((category) => category.name))

        setEditableOperations((current) =>
          current.map((operation) => {
            if (operation.userCategory.trim()) {
              return operation
            }

            const mappedCategory = mappingByKey.get(
              buildMappingKey(operation.operationCategory, operation.description),
            )

            if (!mappedCategory || !categoryNames.has(mappedCategory)) {
              return operation
            }

            return { ...operation, userCategory: mappedCategory }
          }),
        )
      } catch {
        // Автозаполнение необязательно — при ошибке оставляем пустые категории.
      } finally {
        if (!cancelled) {
          setMappingsLoading(false)
        }
      }
    }

    void loadSavedMappings()

    return () => {
      cancelled = true
    }
  }, [rawOperations, categories])

  const allCategoriesAssigned = editableOperations.every(
    (operation) => operation.userCategory.trim().length > 0,
  )

  const yearOptions = useMemo(() => buildYearOptions(defaultPeriod.year), [defaultPeriod.year])

  function handleDeleteOperation(id: string) {
    setEditableOperations((current) => current.filter((operation) => operation.id !== id))
    setValidationError(null)
  }

  function handleUserCategoryChange(id: string, userCategory: string) {
    setEditableOperations((current) =>
      current.map((operation) =>
        operation.id === id ? { ...operation, userCategory } : operation,
      ),
    )
    setValidationError(null)
  }

  function handleSave() {
    if (categories.length === 0) {
      setValidationError(
        'Сначала создайте категории в разделе «Категории», затем назначьте их операциям.',
      )
      return
    }

    if (!allCategoriesAssigned) {
      setValidationError('У каждой операции должна быть выбрана категория.')
      return
    }

    setValidationError(null)
    onConfirm({
      month,
      year,
      operations: editableOperations.map(({ userCategory, amount }) => ({
        category: userCategory.trim(),
        amount,
      })),
      mappings: editableOperations.map(({ operationCategory, description, userCategory }) => ({
        operationCategory,
        description,
        category: userCategory.trim(),
      })),
    })
  }

  return (
    <div className="modal-overlay" onClick={saving ? undefined : onCancel}>
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-preview-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="import-preview-title">Подтверждение загрузки</h2>
            <p className="modal-subtitle">
              Назначьте категории сгруппированным операциям из файла{' '}
              <strong>{fileName}</strong> перед сохранением.
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onCancel}
            disabled={saving}
            aria-label="Закрыть"
          >
            ×
          </button>
        </header>

        <div className="modal-body">
          <div className="period-selector">
            <label className="period-field">
              <span>Месяц</span>
              <select
                value={month}
                disabled={saving}
                onChange={(event) => setMonth(Number(event.target.value))}
              >
                {MONTH_NAMES.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label className="period-field">
              <span>Год</span>
              <select
                value={year}
                disabled={saving}
                onChange={(event) => setYear(Number(event.target.value))}
              >
                {yearOptions.map((optionYear) => (
                  <option key={optionYear} value={optionYear}>
                    {optionYear}
                  </option>
                ))}
              </select>
            </label>

            <p className="period-summary">
              Период сохранения: <strong>{formatPeriod(month, year)}</strong>
            </p>
          </div>

          {mappingsLoading && (
            <p className="status status-loading">Загрузка сохранённых связей категорий…</p>
          )}

          {validationError && (
            <p className="import-preview-warning">{validationError}</p>
          )}

          <ImportPreviewTable
            operations={editableOperations}
            categories={categories}
            categoryColors={categoryColors}
            highlightMissingCategories={validationError !== null && !allCategoriesAssigned}
            onUserCategoryChange={handleUserCategoryChange}
            onDeleteOperation={saving ? undefined : handleDeleteOperation}
          />
        </div>

        <footer className="modal-footer">
          <button
            type="button"
            className="button button-secondary"
            onClick={onCancel}
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={handleSave}
            disabled={saving || editableOperations.length === 0 || mappingsLoading}
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </footer>
      </div>
    </div>
  )
}
