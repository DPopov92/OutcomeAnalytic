import { useEffect, useState } from 'react'
import { fetchCategoryMappings } from '../api/categoryMappings'
import { buildMappingKey } from '../types/expense'
import { ImportPreviewTable, type PreviewOperation } from './ImportPreviewTable'
import type { CategoryMappingInput, GroupedPreviewOperation } from '../types/expense'
import type { Category } from '../types/category'
import './ImportPreviewModal.css'

function buildEditableOperations(rows: GroupedPreviewOperation[]): PreviewOperation[] {
  return rows.map((row) => ({
    ...row,
    userCategory: '',
    removed: false,
  }))
}

interface ImportPreviewModalProps {
  fileName: string
  operations: GroupedPreviewOperation[]
  inserted: number
  skipped: number
  categories: Category[]
  saving: boolean
  categoryColors?: Record<string, string>
  onConfirm: (payload: {
    operations: Array<{
      month: number
      year: number
      operationCategory: string
      description: string
      category: string
      amount: number
    }>
    mappings: CategoryMappingInput[]
  }) => void
  onCancel: () => void
}

export function ImportPreviewModal({
  fileName,
  operations,
  inserted,
  skipped,
  categories,
  saving,
  categoryColors = {},
  onConfirm,
  onCancel,
}: ImportPreviewModalProps) {
  const [editableOperations, setEditableOperations] = useState<PreviewOperation[]>(() =>
    buildEditableOperations(operations),
  )
  const [validationError, setValidationError] = useState<string | null>(null)
  const [mappingsLoading, setMappingsLoading] = useState(true)

  useEffect(() => {
    setEditableOperations(buildEditableOperations(operations))
  }, [operations])

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
  }, [operations, categories])

  const activeOperations = editableOperations.filter((operation) => !operation.removed)

  const allCategoriesAssigned = activeOperations.every(
    (operation) => operation.userCategory.trim().length > 0,
  )

  function handleToggleOperationRemoved(id: string) {
    setEditableOperations((current) =>
      current.map((operation) =>
        operation.id === id ? { ...operation, removed: !operation.removed } : operation,
      ),
    )
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
      operations: activeOperations.map(
        ({ month, year, operationCategory, description, userCategory, amount }) => ({
          month,
          year,
          operationCategory,
          description,
          category: userCategory.trim(),
          amount,
        }),
      ),
      mappings: activeOperations.map(({ operationCategory, description, userCategory }) => ({
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
            <p className="modal-subtitle">
              Загружено новых операций: <strong>{inserted}</strong>
              {skipped > 0 ? (
                <>
                  {' '}
                  · Пропущено дубликатов: <strong>{skipped}</strong>
                </>
              ) : null}
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
            onToggleOperationRemoved={saving ? undefined : handleToggleOperationRemoved}
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
            disabled={saving || activeOperations.length === 0 || mappingsLoading}
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </footer>
      </div>
    </div>
  )
}
