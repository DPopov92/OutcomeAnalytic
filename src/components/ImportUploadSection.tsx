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
      hint="JSON-файл чеков из npm run ozon:checks"
      disabled={disabled}
      onFileSelect={onFileSelect}
    >
      <div className="import-upload-details">
        <p>
          Электронные чеки Ozon:{' '}
          <a href="https://www.ozon.ru/my/e-check" target="_blank" rel="noreferrer">
            ozon.ru/my/e-check
          </a>
        </p>
        <ol>
          <li>
            Один раз выполните <code>npm run ozon:checks:login</code> во внешнем терминале
            Windows (PowerShell) и войдите в аккаунт
          </li>
          <li>
            Если Ozon не открывается, добавьте{' '}
            <code>-- --browser chrome</code> (нужен установленный Google Chrome)
          </li>
          <li>
            Выгрузите чеки за месяц:{' '}
            <code>npm run ozon:checks -- --month YYYY-MM</code>
          </li>
          <li>Загрузите полученный JSON кнопкой выше</li>
        </ol>
      </div>
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
