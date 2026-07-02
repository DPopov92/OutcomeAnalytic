import type { ReactNode } from 'react'
import './ImportUpload.css'

interface ImportUploadButtonProps {
  label: string
  accept: string
  hint: string
  disabled?: boolean
  onFileSelect: (file: File) => void
  children?: ReactNode
}

export function ImportUploadButton({
  label,
  accept,
  hint,
  disabled,
  onFileSelect,
  children,
}: ImportUploadButtonProps) {
  return (
    <div className="import-upload-card">
      <label className="import-upload-label">
        <input
          type="file"
          accept={accept}
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) {
              onFileSelect(file)
            }
            event.target.value = ''
          }}
        />
        <span className="import-upload-button">{label}</span>
        <span className="import-upload-hint">{hint}</span>
      </label>
      {children}
    </div>
  )
}
