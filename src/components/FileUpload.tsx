interface FileUploadProps {
  onFileSelect: (file: File) => void
  disabled?: boolean
}

export function FileUpload({ onFileSelect, disabled }: FileUploadProps) {
  return (
    <div className="upload-section">
      <label className="upload-label">
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) {
              onFileSelect(file)
            }
            event.target.value = ''
          }}
        />
        <span className="upload-button">Выбрать Excel-файл</span>
        <span className="upload-hint">Формат: .xlsx, .xls или .csv</span>
      </label>
      <p className="upload-format">
        Ожидаемые колонки: <strong>Дата</strong>, <strong>Категория</strong>,{' '}
        <strong>Сумма</strong>, <strong>Описание</strong>
        <br />
        Формат даты: <strong>01 июн. 2026, 13:53</strong>
      </p>
    </div>
  )
}
