import { ImportUploadButton } from './ImportUploadButton'
import './ImportUpload.css'

interface ExcelFileUploadProps {
  disabled?: boolean
  onFileSelect: (file: File) => void
}

export function ExcelFileUpload({ disabled, onFileSelect }: ExcelFileUploadProps) {
  return (
    <ImportUploadButton
      label="Загрузка Excel-отчёта"
      accept=".xlsx,.xls,.csv"
      hint="Формат: .xlsx, .xls или .csv"
      disabled={disabled}
      onFileSelect={onFileSelect}
    >
      <p className="import-upload-details">
        Ожидаемые колонки: <strong>Дата</strong>, <strong>Категория</strong>,{' '}
        <strong>Сумма</strong>, <strong>Описание</strong>
        <br />
        Формат даты: <strong>01 июн. 2026, 13:53</strong>
      </p>
    </ImportUploadButton>
  )
}

interface OzonFileUploadProps {
  disabled?: boolean
  onFileSelect: (file: File) => void
}

export function OzonFileUpload({ disabled, onFileSelect }: OzonFileUploadProps) {
  return (
    <ImportUploadButton
      label="Загрузка OZON"
      accept=".json,application/json"
      hint="JSON-файл с чеками Ozon"
      disabled={disabled}
      onFileSelect={onFileSelect}
    >
      <p className="import-upload-details">
        Выгрузите чеки: <code>npm run ozon:checks -- --month YYYY-MM</code>
        <br />
        При первом запуске: <code>npm run ozon:checks:login</code>
      </p>
    </ImportUploadButton>
  )
}

interface ImportUploadSectionProps {
  disabled?: boolean
  onExcelFileSelect: (file: File) => void
  onOzonFileSelect: (file: File) => void
}

export function ImportUploadSection({
  disabled,
  onExcelFileSelect,
  onOzonFileSelect,
}: ImportUploadSectionProps) {
  return (
    <section className="import-upload-section">
      <ExcelFileUpload disabled={disabled} onFileSelect={onExcelFileSelect} />
      <OzonFileUpload disabled={disabled} onFileSelect={onOzonFileSelect} />
    </section>
  )
}
