import { ImportUploadButton } from './ImportUploadButton'
import './ImportUpload.css'
interface ExcelFileUploadProps {
  disabled?: boolean
  onFileSelect: (file: File) => void
  onAddOperation?: () => void
}

export function ExcelFileUpload({
  disabled,
  onFileSelect,
  onAddOperation,
}: ExcelFileUploadProps) {
  return (
    <div className="import-upload-card">
      <div className="import-upload-actions">
        <ImportUploadButton
          label="Загрузка Excel"
          accept=".xlsx,.xls,.csv"
          hint="Формат: .xlsx, .xls или .csv"
          disabled={disabled}
          inline
          showHint={false}
          onFileSelect={onFileSelect}
        />
        {onAddOperation && (
          <button
            type="button"
            className="import-upload-action-btn"
            disabled={disabled}
            onClick={onAddOperation}
          >
            Добавить операцию
          </button>
        )}
      </div>
      <p className="import-upload-hint import-upload-actions-hint">
        Формат: .xlsx, .xls или .csv
      </p>
      <p className="import-upload-details">
        Ожидаемые колонки: <strong>Дата</strong>, <strong>Категория</strong>,{' '}
        <strong>Сумма</strong>, <strong>Описание</strong>
        <br />
        Формат даты: <strong>01 июн. 2026, 13:53</strong>
      </p>
    </div>
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
  onAddOperation?: () => void
}

export function ImportUploadSection({
  disabled,
  onExcelFileSelect,
  onOzonFileSelect,
  onAddOperation,
}: ImportUploadSectionProps) {
  return (
    <section className="import-upload-section">
      <ExcelFileUpload
        disabled={disabled}
        onFileSelect={onExcelFileSelect}
        onAddOperation={onAddOperation}
      />
      <OzonFileUpload disabled={disabled} onFileSelect={onOzonFileSelect} />
    </section>
  )
}
