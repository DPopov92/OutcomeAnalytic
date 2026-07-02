import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useEffect, useMemo, useState } from 'react'
import { fetchCategories } from '../api/categories'
import {
  cancelImportBatch,
  clearAllOperations,
  fetchImportPreview,
  fetchOperations,
  importOperations,
  mapOperationDto,
  uploadExcelFile,
  uploadOzonFile,
} from '../api/operations'
import { TagsIcon } from '../assets/icons/TagsIcon'
import { AddOperationModal } from '../components/AddOperationModal'
import { CategoryManagerModal } from '../components/CategoryManagerModal'
import { ImportPreviewModal } from '../components/ImportPreviewModal'
import { ImportUploadSection } from '../components/ImportUploadSection'
import { OperationsTable } from '../components/OperationsTable'
import { PeriodSelect } from '../components/PeriodSelect'
import type { Category } from '../types/category'
import type { GroupedExpense, GroupedPreviewOperation } from '../types/expense'
import type { OzonExportOrder, OzonReceipt } from '../types/ozon'
import { buildCategoryColorMap } from '../utils/categoryColors'
import {
  filterOperationsByPeriod,
  getLatestPeriod,
  getMonthsForYear,
  type OperationPeriod,
} from '../utils/operationPeriods'

interface ImportPreview {
  fileName: string
  batchId: string
  operations: GroupedPreviewOperation[]
  inserted: number
  skipped: number
  source: 'excel' | 'ozon'
  ozonOrders?: OzonExportOrder[]
  ozonReceipts?: OzonReceipt[]
}

export function HomePage() {
  const [operations, setOperations] = useState<GroupedExpense[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false)
  const [addOperationOpen, setAddOperationOpen] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<OperationPeriod | null>(
    null,
  )

  const categoryColors = useMemo(() => buildCategoryColorMap(categories), [categories])

  const filteredOperations = useMemo(() => {
    if (selectedPeriod === null) {
      return operations
    }

    return filterOperationsByPeriod(operations, selectedPeriod)
  }, [operations, selectedPeriod])

  useEffect(() => {
    if (operations.length === 0) {
      setSelectedPeriod(null)
      return
    }

    setSelectedPeriod((current) => {
      if (current === null) {
        return getLatestPeriod(operations)
      }

      const monthsForYear = getMonthsForYear(operations, current.year)
      if (monthsForYear.includes(current.month)) {
        return current
      }

      return getLatestPeriod(operations)
    })
  }, [operations])

  useEffect(() => {
    let cancelled = false

    async function loadSavedOperations() {
      try {
        const [data, loadedCategories] = await Promise.all([
          fetchOperations(),
          fetchCategories(),
        ])
        if (cancelled) {
          return
        }

        setCategories(loadedCategories)
        setOperations(data.operations.map(mapOperationDto))
        setFileName(data.lastImport?.fileName ?? null)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Не удалось загрузить сохранённые данные.',
          )
        }
      } finally {
        if (!cancelled) {
          setInitialLoading(false)
        }
      }
    }

    void loadSavedOperations()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleImportFile(
    file: File,
    upload: (file: File) => Promise<Awaited<ReturnType<typeof uploadExcelFile>>>,
  ) {
    setParsing(true)
    setError(null)

    try {
      const uploadResult = await upload(file)

      if (uploadResult.inserted === 0) {
        setError(
          uploadResult.skipped > 0
            ? `Все ${uploadResult.skipped} операций из файла уже были загружены ранее.`
            : 'В файле не найдено новых операций.',
        )
        return
      }

      const previewData = await fetchImportPreview(uploadResult.batchId)

      setPreview({
        fileName: uploadResult.fileName,
        batchId: uploadResult.batchId,
        operations: previewData.operations,
        inserted: uploadResult.inserted,
        skipped: uploadResult.skipped,
        source: uploadResult.source ?? 'excel',
        ozonOrders: uploadResult.ozonOrders,
        ozonReceipts: uploadResult.ozonReceipts,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обработать файл.')
    } finally {
      setParsing(false)
    }
  }

  function handleExcelFileSelect(file: File) {
    return handleImportFile(file, uploadExcelFile)
  }

  function handleOzonFileSelect(file: File) {
    return handleImportFile(file, uploadOzonFile)
  }

  async function handleConfirmSave(payload: {
    operations: Array<{
      month: number
      year: number
      operationCategory: string
      description: string
      category: string
      amount: number
    }>
    mappings: Array<{
      operationCategory: string
      description: string
      category: string
    }>
  }) {
    if (!preview) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const saved = await importOperations({
        fileName: preview.fileName,
        batchId: preview.batchId,
        operations: payload.operations,
        mappings: payload.mappings,
      })

      setOperations(saved.operations.map(mapOperationDto))
      setFileName(saved.lastImport?.fileName ?? preview.fileName)
      setPreview(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить данные.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCancelPreview() {
    if (saving || !preview) {
      return
    }

    const batchId = preview.batchId

    try {
      await cancelImportBatch(batchId)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось отменить загрузку.',
      )
    } finally {
      setPreview(null)
    }
  }

  async function handleClearAll() {
    if (
      !window.confirm(
        'Удалить все данные из базы? Это действие нельзя отменить.',
      )
    ) {
      return
    }

    setClearing(true)
    setError(null)

    try {
      await clearAllOperations()
      setOperations([])
      setFileName(null)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось очистить базу данных.',
      )
    } finally {
      setClearing(false)
    }
  }

  function handleOperationsCategoryRenamed(oldName: string, newName: string) {
    setOperations((current) =>
      current.map((operation) =>
        operation.category === oldName
          ? { ...operation, category: newName }
          : operation,
      ),
    )
  }

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Button
          variant="contained"
          color="secondary"
          size="large"
          startIcon={<TagsIcon size={20} strokeWidth={2} />}
          disabled={initialLoading || saving || preview !== null}
          onClick={() => setCategoryManagerOpen(true)}
          sx={{
            fontWeight: 600,
            px: 2.5,
            boxShadow: 2,
            '&:hover': { boxShadow: 4 },
          }}
        >
          Настроить категории
        </Button>

        {import.meta.env.DEV && (
          <Button
            variant="outlined"
            color="error"
            onClick={() => void handleClearAll()}
            disabled={clearing || initialLoading || saving || preview !== null}
            title="Только для тестирования"
          >
            {clearing ? 'Очистка…' : 'Очистить БД'}
          </Button>
        )}
      </Box>

      <ImportUploadSection
        disabled={
          parsing ||
          saving ||
          initialLoading ||
          preview !== null ||
          addOperationOpen
        }
        onExcelFileSelect={(file) => void handleExcelFileSelect(file)}
        onOzonFileSelect={(file) => void handleOzonFileSelect(file)}
        onAddOperation={() => setAddOperationOpen(true)}
      />

      {initialLoading && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CircularProgress size={18} />
          <Typography color="text.secondary">Загрузка сохранённых данных…</Typography>
        </Stack>
      )}

      {parsing && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CircularProgress size={18} />
          <Typography color="text.secondary">Обработка файла…</Typography>
        </Stack>
      )}

      {fileName && !parsing && !initialLoading && operations.length > 0 && (
        <Alert severity="success">
          Последний сохранённый файл: <strong>{fileName}</strong>
        </Alert>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      <Stack spacing={2}>
        {!initialLoading && operations.length > 0 && selectedPeriod !== null && (
          <PeriodSelect
            operations={operations}
            value={selectedPeriod}
            onChange={setSelectedPeriod}
          />
        )}

        <OperationsTable
          operations={filteredOperations}
          loading={initialLoading}
          categoryColors={categoryColors}
          emptyMessage={
            operations.length > 0
              ? 'Нет операций за выбранный период. Выберите другой месяц или год.'
              : 'Сохранённые операции появятся здесь после подтверждения загрузки файла.'
          }
        />
      </Stack>

      {categoryManagerOpen && (
        <CategoryManagerModal
          categories={categories}
          onClose={() => setCategoryManagerOpen(false)}
          onCategoriesChange={setCategories}
          onOperationsCategoryRenamed={handleOperationsCategoryRenamed}
        />
      )}

      {addOperationOpen && (
        <AddOperationModal
          categories={categories}
          categoryColors={categoryColors}
          onClose={() => setAddOperationOpen(false)}
          onSaved={(savedOperations) => {
            setOperations(savedOperations)
            setAddOperationOpen(false)
            setError(null)
          }}
        />
      )}

      {preview && (
        <ImportPreviewModal
          fileName={preview.fileName}
          operations={preview.operations}
          inserted={preview.inserted}
          skipped={preview.skipped}
          categories={categories}
          saving={saving}
          categoryColors={categoryColors}
          ozonOrders={preview.source === 'ozon' ? preview.ozonOrders : undefined}
          ozonReceipts={preview.source === 'ozon' ? preview.ozonReceipts : undefined}
          onConfirm={(payload) => void handleConfirmSave(payload)}
          onCancel={handleCancelPreview}
        />
      )}
    </Stack>
  )
}
