import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useEffect, useMemo, useState } from 'react'
import { fetchCategories } from '../api/categories'
import { fetchOperations, mapOperationDto } from '../api/operations'
import { CategoryPieChart } from '../components/CategoryPieChart'
import { PeriodSelect } from '../components/PeriodSelect'
import type { Category } from '../types/category'
import type { GroupedExpense } from '../types/expense'
import { aggregateCategoryTotals } from '../utils/aggregateByCategory'
import { buildCategoryColorMap } from '../utils/categoryColors'
import {
  filterOperationsByPeriod,
  getLatestPeriod,
  type OperationPeriod,
} from '../utils/operationPeriods'

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
    <Stack spacing={3}>
      {loading && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CircularProgress size={18} />
          <Typography color="text.secondary">Загрузка данных…</Typography>
        </Stack>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && operations.length === 0 && (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Нет данных для диаграммы
          </Typography>
          <Typography color="text.secondary">
            Загрузите и сохраните операции на главной странице — здесь появится
            распределение расходов по категориям.
          </Typography>
        </Paper>
      )}

      {!loading && !error && operations.length > 0 && selectedPeriod !== null && (
        <Stack spacing={2}>
          <PeriodSelect
            operations={operations}
            value={selectedPeriod}
            onChange={setSelectedPeriod}
          />

          {categoryTotals.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                Нет данных за выбранный период
              </Typography>
              <Typography color="text.secondary">
                Выберите другой месяц или год — для этого периода операции не
                найдены.
              </Typography>
            </Paper>
          ) : (
            <CategoryPieChart items={categoryTotals} />
          )}
        </Stack>
      )}
    </Stack>
  )
}
