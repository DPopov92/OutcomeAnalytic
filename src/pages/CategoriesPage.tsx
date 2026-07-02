import { useEffect, useMemo, useState } from 'react'
import { fetchCategories } from '../api/categories'
import { fetchOperations, mapOperationDto } from '../api/operations'
import { CategoryPieChart } from '../components/CategoryPieChart'
import { PeriodFilter } from '../components/PeriodFilter'
import type { Category } from '../types/category'
import type { GroupedExpense } from '../types/expense'
import { aggregateCategoryTotals } from '../utils/aggregateByCategory'
import { buildCategoryColorMap } from '../utils/categoryColors'
import {
  filterOperationsByPeriod,
  getLatestPeriod,
  type OperationPeriod,
} from '../utils/operationPeriods'
import './CategoriesPage.css'

export function CategoriesPage() {
  const [operations, setOperations] = useState<GroupedExpense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<OperationPeriod | null>(
    null,
  )

  const categoryColors = useMemo(
    () => buildCategoryColorMap(categories),
    [categories],
  )

  const filteredOperations = useMemo(() => {
    if (selectedPeriod === null) {
      return []
    }

    return filterOperationsByPeriod(operations, selectedPeriod)
  }, [operations, selectedPeriod])

  const categoryTotals = useMemo(
    () => aggregateCategoryTotals(filteredOperations, categoryColors),
    [filteredOperations, categoryColors],
  )

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const [operationsResponse, loadedCategories] = await Promise.all([
          fetchOperations(),
          fetchCategories(),
        ])

        if (cancelled) {
          return
        }

        const loadedOperations = operationsResponse.operations.map(mapOperationDto)
        setOperations(loadedOperations)
        setCategories(loadedCategories)
        setSelectedPeriod(getLatestPeriod(loadedOperations))
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Не удалось загрузить данные для аналитики.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="categories-page">
      <header className="categories-page-header">
        <h1>По категориям</h1>
        <p>Доля расходов по каждой категории за выбранный месяц.</p>
      </header>

      {loading && (
        <p className="categories-page-status categories-page-status-loading">
          Загрузка данных…
        </p>
      )}

      {error && (
        <p className="categories-page-status categories-page-status-error">{error}</p>
      )}

      {!loading && !error && operations.length === 0 && (
        <div className="categories-page-empty">
          <p className="categories-page-empty-title">Нет данных для диаграммы</p>
          <p className="categories-page-empty-text">
            Загрузите и сохраните операции на главной странице — здесь появится
            распределение расходов по категориям.
          </p>
        </div>
      )}

      {!loading && !error && operations.length > 0 && selectedPeriod !== null && (
        <section className="categories-chart-section">
          <PeriodFilter
            operations={operations}
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
          />

          {categoryTotals.length === 0 ? (
            <div className="categories-page-empty categories-page-empty-period">
              <p className="categories-page-empty-title">
                Нет данных за выбранный период
              </p>
              <p className="categories-page-empty-text">
                Выберите другой месяц или год — для этого периода операции не
                найдены.
              </p>
            </div>
          ) : (
            <CategoryPieChart items={categoryTotals} />
          )}
        </section>
      )}
    </div>
  )
}
