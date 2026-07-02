import { useEffect, useMemo, useState } from 'react'
import { fetchCategories } from '../api/categories'
import {
  cancelImportBatch,
  clearAllOperations,
  fetchImportPreview,
  fetchOperations,
  importOperations,
  mapOperationDto,
  uploadOperationsFile,
} from '../api/operations'
import { CategoryManagerModal } from '../components/CategoryManagerModal'
import { FileUpload } from '../components/FileUpload'
import { ImportPreviewModal } from '../components/ImportPreviewModal'
import { OperationsTable } from '../components/OperationsTable'
import { PeriodFilter } from '../components/PeriodFilter'
import type { Category } from '../types/category'
import type { GroupedExpense, GroupedPreviewOperation } from '../types/expense'
import { buildCategoryColorMap } from '../utils/categoryColors'
import {
  filterOperationsByPeriod,
  getLatestPeriod,
  getMonthsForYear,
  type OperationPeriod,
} from '../utils/operationPeriods'
import './HomePage.css'

interface ImportPreview {
  fileName: string
  batchId: string
  operations: GroupedPreviewOperation[]
  inserted: number
  skipped: number
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

  useEffect(() => {
    document.body.style.overflow = preview || categoryManagerOpen ? 'hidden' : ''

    return () => {
      document.body.style.overflow = ''
    }
  }, [preview, categoryManagerOpen])

  async function handleFileSelect(file: File) {
    setParsing(true)
    setError(null)

    try {
      const uploadResult = await uploadOperationsFile(file)

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
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обработать файл.')
    } finally {
      setParsing(false)
    }
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
    <div className="home-page">
      <header className="page-header">
        <div className="page-header-top">
          <div>
            <h1>Главная</h1>
            <p>
              Загрузите Excel-файл, назначьте категории операциям и сохраните
              сгруппированные данные.
            </p>
          </div>
          <div className="page-header-actions">
            <button
              type="button"
              className="header-action-btn"
              onClick={() => setCategoryManagerOpen(true)}
              disabled={initialLoading || saving || preview !== null}
            >
              Категории
            </button>
            <button
              type="button"
              className="dev-clear-btn"
              onClick={() => void handleClearAll()}
              disabled={clearing || initialLoading || saving || preview !== null}
              title="Только для тестирования"
            >
              {clearing ? 'Очистка…' : 'Очистить БД'}
            </button>
          </div>
        </div>
      </header>

      <main className="page-main">
        <FileUpload
          onFileSelect={handleFileSelect}
          disabled={parsing || saving || initialLoading || preview !== null}
        />

        {initialLoading && (
          <p className="status status-loading">Загрузка сохранённых данных…</p>
        )}

        {parsing && <p className="status status-loading">Обработка файла…</p>}

        {fileName && !parsing && !initialLoading && operations.length > 0 && (
          <p className="status status-success">
            Последний сохранённый файл: <strong>{fileName}</strong>
          </p>
        )}

        {error && <p className="status status-error">{error}</p>}

        <section className="home-operations-section">
          {!initialLoading && operations.length > 0 && selectedPeriod !== null && (
            <PeriodFilter
              operations={operations}
              selectedPeriod={selectedPeriod}
              onPeriodChange={setSelectedPeriod}
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
        </section>
      </main>

      {categoryManagerOpen && (
        <CategoryManagerModal
          categories={categories}
          onClose={() => setCategoryManagerOpen(false)}
          onCategoriesChange={setCategories}
          onOperationsCategoryRenamed={handleOperationsCategoryRenamed}
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
          onConfirm={(payload) => void handleConfirmSave(payload)}
          onCancel={handleCancelPreview}
        />
      )}
    </div>
  )
}
