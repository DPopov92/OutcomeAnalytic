import { useEffect, useState } from 'react'
import { fetchCategoryMappings } from '../api/categoryMappings'
import { buildMappingKey } from '../types/expense'
import { ImportPreviewTable, type PreviewOperation } from './ImportPreviewTable'
import {
  OzonReceiptsImportTable,
  areAllOzonReceiptItemsCategorized,
  buildOzonReceiptGroups,
  collectOzonReceiptSaveOperations,
  countActiveOzonReceiptItems,
  type OzonReceiptGroupState,
} from './OzonReceiptsImportTable'
import { OzonOrdersPreview } from './OzonOrdersPreview'
import type { CategoryMappingInput, GroupedPreviewOperation } from '../types/expense'
import type { Category } from '../types/category'
import type { OzonExportOrder, OzonReceipt } from '../types/ozon'
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
  ozonOrders?: OzonExportOrder[]
  ozonReceipts?: OzonReceipt[]
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
  ozonOrders,
  ozonReceipts,
  onConfirm,
  onCancel,
}: ImportPreviewModalProps) {
  const isReceiptsImport = Boolean(ozonReceipts && ozonReceipts.length > 0)
  const [editableOperations, setEditableOperations] = useState<PreviewOperation[]>(() =>
    buildEditableOperations(operations),
  )
  const [receiptGroups, setReceiptGroups] = useState<OzonReceiptGroupState[]>(() =>
    ozonReceipts ? buildOzonReceiptGroups(ozonReceipts) : [],
  )
  const [validationError, setValidationError] = useState<string | null>(null)
  const [mappingsLoading, setMappingsLoading] = useState(true)

  useEffect(() => {
    setEditableOperations(buildEditableOperations(operations))
  }, [operations])

  useEffect(() => {
    if (ozonReceipts) {
      setReceiptGroups(buildOzonReceiptGroups(ozonReceipts))
    }
  }, [ozonReceipts])

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

        if (isReceiptsImport) {
          setReceiptGroups((current) =>
            current.map((group) => {
              const updatedItems = group.items.map((item) => {
                if (item.userCategory.trim()) {
                  return item
                }

                const mappedCategory = mappingByKey.get(
                  buildMappingKey('Ozon', item.description),
                )

                if (!mappedCategory || !categoryNames.has(mappedCategory)) {
                  return item
                }

                return {
                  ...item,
                  userCategory: mappedCategory,
                  categoryFromParent: false,
                }
              })

              const categorizedItems = updatedItems.filter(
                (item) => !item.removed && item.userCategory.trim(),
              )
              const allSameCategory =
                categorizedItems.length > 0 &&
                categorizedItems.every(
                  (item) => item.userCategory === categorizedItems[0]?.userCategory,
                )
              const allItemsCategorized =
                updatedItems.filter((item) => !item.removed).length ===
                  categorizedItems.length && allSameCategory

              return {
                ...group,
                userCategory: allItemsCategorized
                  ? (categorizedItems[0]?.userCategory ?? '')
                  : '',
                items: updatedItems.map((item) =>
                  allItemsCategorized
                    ? { ...item, categoryFromParent: true }
                    : item,
                ),
              }
            }),
          )
        } else {
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
        }
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
  }, [operations, categories, isReceiptsImport, ozonReceipts])

  const activeOperations = editableOperations.filter((operation) => !operation.removed)
  const activeReceiptItemCount = countActiveOzonReceiptItems(receiptGroups)

  const allCategoriesAssigned = isReceiptsImport
    ? areAllOzonReceiptItemsCategorized(receiptGroups)
    : activeOperations.every((operation) => operation.userCategory.trim().length > 0)

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

  function handleAmountChange(id: string, amount: number) {
    setEditableOperations((current) =>
      current.map((operation) =>
        operation.id === id ? { ...operation, amount } : operation,
      ),
    )
    setValidationError(null)
  }

  function handleToggleReceiptGroupRemoved(groupId: string) {
    setReceiptGroups((current) =>
      current.map((group) => {
        if (group.id !== groupId) {
          return group
        }

        const removed = !group.removed
        return {
          ...group,
          removed,
          items: group.items.map((item) => ({ ...item, removed })),
        }
      }),
    )
    setValidationError(null)
  }

  function handleToggleReceiptItemRemoved(groupId: string, itemId: string) {
    setReceiptGroups((current) =>
      current.map((group) => {
        if (group.id !== groupId) {
          return group
        }

        const parentCategory = group.userCategory.trim()

        return {
          ...group,
          items: group.items.map((item) => {
            if (item.id !== itemId) {
              return item
            }

            const removed = !item.removed

            if (removed) {
              return { ...item, removed: true }
            }

            if (parentCategory) {
              return {
                ...item,
                removed: false,
                userCategory: parentCategory,
                categoryFromParent: true,
              }
            }

            return {
              ...item,
              removed: false,
              categoryFromParent: false,
            }
          }),
        }
      }),
    )
    setValidationError(null)
  }

  function handleReceiptGroupsChange(groups: OzonReceiptGroupState[]) {
    setReceiptGroups(groups)
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
      setValidationError('У каждой позиции должна быть выбрана категория.')
      return
    }

    setValidationError(null)

    if (isReceiptsImport) {
      const saveOperations = collectOzonReceiptSaveOperations(receiptGroups)
      onConfirm({
        operations: saveOperations,
        mappings: saveOperations.map(({ operationCategory, description, category }) => ({
          operationCategory,
          description,
          category,
        })),
      })
      return
    }

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

  const canSave = isReceiptsImport
    ? activeReceiptItemCount > 0
    : activeOperations.length > 0

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
              {isReceiptsImport ? (
                <>
                  Назначьте категории позициям из чеков Ozon в файле{' '}
                  <strong>{fileName}</strong> перед сохранением.
                </>
              ) : (
                <>
                  Назначьте категории сгруппированным операциям из файла{' '}
                  <strong>{fileName}</strong> перед сохранением.
                </>
              )}
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

          {isReceiptsImport ? (
            <OzonReceiptsImportTable
              groups={receiptGroups}
              categories={categories}
              categoryColors={categoryColors}
              highlightMissingCategories={validationError !== null && !allCategoriesAssigned}
              onGroupsChange={handleReceiptGroupsChange}
              onToggleGroupRemoved={saving ? undefined : handleToggleReceiptGroupRemoved}
              onToggleItemRemoved={saving ? undefined : handleToggleReceiptItemRemoved}
            />
          ) : (
            <>
              {ozonOrders && ozonOrders.length > 0 && (
                <OzonOrdersPreview orders={ozonOrders} />
              )}

              <ImportPreviewTable
                operations={editableOperations}
                categories={categories}
                categoryColors={categoryColors}
                highlightMissingCategories={validationError !== null && !allCategoriesAssigned}
                onUserCategoryChange={handleUserCategoryChange}
                onAmountChange={saving ? undefined : handleAmountChange}
                onToggleOperationRemoved={saving ? undefined : handleToggleOperationRemoved}
              />
            </>
          )}
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
            disabled={saving || !canSave || mappingsLoading}
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </footer>
      </div>
    </div>
  )
}
