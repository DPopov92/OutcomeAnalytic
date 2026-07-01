import type { GroupedExpense } from '../types/expense'
import { formatPeriod } from '../types/expense'
import { CategoryBadge } from './CategoryBadge'
import { resolveCategoryColor } from '../utils/categoryColors'

interface OperationsTableProps {
  operations: GroupedExpense[]
  loading?: boolean
  title?: string
  emptyMessage?: string
  categoryColors?: Record<string, string>
}

const amountFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
})

export function OperationsTable({
  operations,
  loading = false,
  title = 'Сохранённые операции',
  emptyMessage = 'Сохранённые операции появятся здесь после подтверждения загрузки файла.',
  categoryColors = {},
}: OperationsTableProps) {
  const total = operations.reduce((sum, operation) => sum + operation.amount, 0)

  if (loading) {
    return null
  }

  if (operations.length === 0) {
    return (
      <div className="table-empty">
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="table-section">
      <div className="table-header">
        <div>
          <h2>{title}</h2>
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
              <th>Период</th>
              <th>Категория</th>
              <th className="col-amount">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {operations.map((operation) => (
              <tr key={operation.id}>
                <td>{formatPeriod(operation.month, operation.year)}</td>
                <td>
                  <CategoryBadge
                    name={operation.category}
                    color={resolveCategoryColor(operation.category, categoryColors)}
                  />
                </td>
                <td className="col-amount">{amountFormatter.format(operation.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
