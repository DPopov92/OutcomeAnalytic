import type { Category } from '../types/category'
import { CategorySelect } from './CategorySelect'
import './ImportPreviewTable.css'

export interface PreviewOperation {
  id: string
  operationCategory: string
  description: string
  amount: number
  userCategory: string
}

interface ImportPreviewTableProps {
  operations: PreviewOperation[]
  categories: Category[]
  categoryColors: Record<string, string>
  highlightMissingCategories?: boolean
  onUserCategoryChange: (id: string, userCategory: string) => void
  onDeleteOperation?: (id: string) => void
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
  onDeleteOperation,
}: ImportPreviewTableProps) {
  const total = operations.reduce((sum, operation) => sum + operation.amount, 0)

  if (operations.length === 0) {
    return (
      <div className="table-empty">
        <p>Все операции удалены. Добавьте строки в файл или отмените загрузку.</p>
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
          Всего: <strong>{operations.length}</strong> · Сумма:{' '}
          <strong>{amountFormatter.format(total)}</strong>
        </p>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Категория операции</th>
              <th>Описание</th>
              <th className="col-amount">Сумма</th>
              <th>Категории</th>
              {onDeleteOperation && <th className="col-actions" aria-label="Действия" />}
            </tr>
          </thead>
          <tbody>
            {operations.map((operation) => {
              const hasUserCategory = operation.userCategory.trim().length > 0

              return (
                <tr key={operation.id}>
                  <td>{operation.operationCategory}</td>
                  <td>{operation.description || '—'}</td>
                  <td className="col-amount">{amountFormatter.format(operation.amount)}</td>
                  <td>
                    <CategorySelect
                      value={operation.userCategory}
                      categories={categories}
                      categoryColors={categoryColors}
                      hasError={highlightMissingCategories && !hasUserCategory}
                      onChange={(userCategory) =>
                        onUserCategoryChange(operation.id, userCategory)
                      }
                    />
                  </td>
                  {onDeleteOperation && (
                    <td className="col-actions">
                      <button
                        type="button"
                        className="row-delete-btn"
                        onClick={() => onDeleteOperation(operation.id)}
                        aria-label={`Удалить операцию: ${operation.operationCategory}`}
                        title="Удалить операцию"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
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
