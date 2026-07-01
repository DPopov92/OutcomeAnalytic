import { useEffect, useMemo, useState } from 'react'
import { fetchCategories } from './api/categories'
import {
  clearAllOperations,
  fetchOperations,
  importOperations,
  mapOperationDto,
} from './api/operations'
import { CategoryManagerModal } from './components/CategoryManagerModal'
import { FileUpload } from './components/FileUpload'
import { ImportPreviewModal } from './components/ImportPreviewModal'
import { OperationsTable } from './components/OperationsTable'
import type { Category } from './types/category'
import type { GroupedExpense, ParsedExpenseRow } from './types/expense'
import { formatPeriod } from './types/expense'
import { buildCategoryColorMap } from './utils/categoryColors'
import { parseExpenseExcel } from './utils/parseExcel'
import './App.css'

interface ImportPreview {
  fileName: string
  rawOperations: ParsedExpenseRow[]
}

function App() {
  const [operations, setOperations] = useState<GroupedExpense[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [periodLabel, setPeriodLabel] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false)

  const categoryColors = useMemo(() => buildCategoryColorMap(categories), [categories])

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

        if (data.lastImport?.periodMonth && data.lastImport?.periodYear) {
          setPeriodLabel(
            formatPeriod(data.lastImport.periodMonth, data.lastImport.periodYear),
          )
        } else {
          setPeriodLabel(null)
        }
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
      const buffer = await file.arrayBuffer()
      const parsed = parseExpenseExcel(buffer)
      setPreview({
        fileName: file.name,
        rawOperations: parsed,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обработать файл.')
    } finally {
      setParsing(false)
    }
  }

  async function handleConfirmSave(payload: {
    month: number
    year: number
    operations: Array<{
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
        month: payload.month,
        year: payload.year,
        operations: payload.operations,
        mappings: payload.mappings,
      })

      setOperations(saved.operations.map(mapOperationDto))
      setFileName(saved.lastImport?.fileName ?? preview.fileName)

      if (saved.lastImport?.periodMonth && saved.lastImport?.periodYear) {
        setPeriodLabel(
          formatPeriod(saved.lastImport.periodMonth, saved.lastImport.periodYear),
        )
      }

      setPreview(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить данные.')
    } finally {
      setSaving(false)
    }
  }

  function handleCancelPreview() {
    if (saving) {
      return
    }

    setPreview(null)
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
      setPeriodLabel(null)
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
    <div className="app">
      <header className="app-header">
        <div className="app-header-top">
          <h1>Outcome Analytic</h1>
          <div className="app-header-actions">
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
        <p>
          Загрузите Excel-файл, назначьте категории операциям, выберите период и сохраните
          сгруппированные данные.
        </p>
      </header>

      <main className="app-main">
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
            {periodLabel ? (
              <>
                {' '}
                · Период: <strong>{periodLabel}</strong>
              </>
            ) : null}
          </p>
        )}

        {error && <p className="status status-error">{error}</p>}

        <OperationsTable
          operations={operations}
          loading={initialLoading}
          categoryColors={categoryColors}
        />
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
          rawOperations={preview.rawOperations}
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

export default App
