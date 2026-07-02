import type { ReactNode } from 'react'
import './ImportUpload.css'

interface ImportUploadButtonProps {
  label: string
  accept: string
  hint?: string
  disabled?: boolean
  inline?: boolean
  showHint?: boolean
  onFileSelect: (file: File) => void
  children?: ReactNode
}

export function ImportUploadButton({
  label,
  accept,
  hint,
  disabled,
  inline = false,
  showHint = true,
  onFileSelect,
  children,
}: ImportUploadButtonProps) {
  const content = (
    <>
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
        <span className="import-upload-action-btn">{label}</span>
        {showHint && hint ? <span className="import-upload-hint">{hint}</span> : null}
      </label>
      {children}
    </>
  )

  if (inline) {
    return content
  }

  return <div className="import-upload-card">{content}</div>
}
