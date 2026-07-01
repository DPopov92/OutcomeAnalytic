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
  onToggleOperationRemoved?: (id: string) => void
}

const amountFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
})

export function ImportPreviewTable({
  operations,
  categories,
  categoryColors,
  highlightMissingCategories = false,
  onUserCategoryChange,
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
            Назначьте каждой операции категорию из сохранённых
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
                  <td className="col-amount">{amountFormatter.format(operation.amount)}</td>
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
