import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import { useEffect, useMemo, useState } from 'react'
import { fetchCategories } from '../api/categories'
import { fetchOperations, mapOperationDto } from '../api/operations'
import { CategoryPieChart } from '../components/CategoryPieChart'
import { CategoryStackedBarChart } from '../components/CategoryStackedBarChart'
import { PeriodRangeSelect, type PeriodRange } from '../components/PeriodRangeSelect'
import { PeriodSelect } from '../components/PeriodSelect'
import type { Category } from '../types/category'
import type { GroupedExpense } from '../types/expense'
import { aggregateMonthlyCategoryStacks } from '../utils/aggregateByMonth'
import { aggregateCategoryTotals } from '../utils/aggregateByCategory'
import { buildCategoryColorMap } from '../utils/categoryColors'
import {
  filterOperationsByPeriod,
  filterOperationsByPeriodRange,
  getEarliestPeriod,
  getLatestPeriod,
  type OperationPeriod,
} from '../utils/operationPeriods'

type StatisticsTab = 'categories' | 'months'

interface TabPanelProps {
  value: StatisticsTab
  tab: StatisticsTab
  children: React.ReactNode
}

function TabPanel({ value, tab, children }: TabPanelProps) {
  if (value !== tab) {
    return null
  }

  return <Box sx={{ pt: 2 }}>{children}</Box>
}

export function StatisticsPage() {
  const [operations, setOperations] = useState<GroupedExpense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<StatisticsTab>('categories')
  const [selectedPeriod, setSelectedPeriod] = useState<OperationPeriod | null>(
    null,
  )
  const [selectedRange, setSelectedRange] = useState<PeriodRange | null>(null)

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

  const rangeFilteredOperations = useMemo(() => {
    if (selectedRange === null) {
      return []
    }

    return filterOperationsByPeriodRange(
      operations,
      selectedRange.from,
      selectedRange.to,
    )
  }, [operations, selectedRange])

  const monthlyStacks = useMemo(
    () => aggregateMonthlyCategoryStacks(rangeFilteredOperations, categoryColors),
    [rangeFilteredOperations, categoryColors],
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

        const latestPeriod = getLatestPeriod(loadedOperations)
        const earliestPeriod = getEarliestPeriod(loadedOperations)
        setSelectedPeriod(latestPeriod)

        if (latestPeriod && earliestPeriod) {
          setSelectedRange({ from: earliestPeriod, to: latestPeriod })
        }
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
            статистика расходов.
          </Typography>
        </Paper>
      )}

      {!loading && !error && operations.length > 0 && (
        <>
          <Tabs
            value={activeTab}
            onChange={(_event, nextTab: StatisticsTab) => setActiveTab(nextTab)}
            aria-label="Разделы статистики"
          >
            <Tab label="По категориям" value="categories" />
            <Tab label="По месяцам" value="months" />
          </Tabs>

          <TabPanel value={activeTab} tab="categories">
            {selectedPeriod !== null && (
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
          </TabPanel>

          <TabPanel value={activeTab} tab="months">
            {selectedRange !== null && (
              <Stack spacing={2}>
                <PeriodRangeSelect
                  operations={operations}
                  value={selectedRange}
                  onChange={setSelectedRange}
                />

                {monthlyStacks.length === 0 ? (
                  <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="h6" gutterBottom>
                      Нет данных за выбранный период
                    </Typography>
                    <Typography color="text.secondary">
                      Выберите другой диапазон — для этих месяцев операции не
                      найдены.
                    </Typography>
                  </Paper>
                ) : (
                  <CategoryStackedBarChart stacks={monthlyStacks} />
                )}
              </Stack>
            )}
          </TabPanel>
        </>
      )}
    </Stack>
  )
}
