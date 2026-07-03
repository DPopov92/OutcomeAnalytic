import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'

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
    <Stack spacing={1}>
      <Button
        variant="contained"
        component="label"
        disabled={disabled}
        sx={{ alignSelf: 'flex-start' }}
      >
        {label}
        <input
          type="file"
          accept={accept}
          hidden
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) {
              onFileSelect(file)
            }
            event.target.value = ''
          }}
        />
      </Button>
      {showHint && hint ? (
        <Typography variant="body2" color="text.secondary">
          {hint}
        </Typography>
      ) : null}
      {children}
    </Stack>
  )

  if (inline) {
    return content
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, borderStyle: 'dashed' }}>
      {content}
    </Paper>
  )
}

interface ImportUploadSectionProps {
  disabled?: boolean
  onExcelFileSelect: (file: File) => void
  onOzonFileSelect: (file: File) => void
  onAddOperation?: () => void
}

export const importBlockPaperSx = {
  p: 2,
  borderStyle: 'dashed',
} as const

const uploadPaperSx = {
  ...importBlockPaperSx,
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
} as const

function ExcelFileUpload({
  disabled,
  onFileSelect,
  onAddOperation,
}: {
  disabled?: boolean
  onFileSelect: (file: File) => void
  onAddOperation?: () => void
}) {
  return (
    <Paper variant="outlined" sx={uploadPaperSx}>
      <Stack spacing={1.5} sx={{ flex: 1 }}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
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
            <Button variant="contained" disabled={disabled} onClick={onAddOperation}>
              Добавить операцию
            </Button>
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Формат: .xlsx, .xls или .csv
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Ожидаемые колонки: <strong>Дата</strong>, <strong>Категория</strong>,{' '}
          <strong>Сумма</strong>, <strong>Описание</strong>
          <br />
          Формат даты: <strong>01 июн. 2026, 13:53</strong>
        </Typography>
      </Stack>
    </Paper>
  )
}

function OzonFileUpload({
  disabled,
  onFileSelect,
}: {
  disabled?: boolean
  onFileSelect: (file: File) => void
}) {
  return (
    <Paper variant="outlined" sx={uploadPaperSx}>
      <Stack spacing={1.5} sx={{ flex: 1 }}>
        <ImportUploadButton
          label="Загрузка OZON"
          accept=".json,application/json"
          disabled={disabled}
          inline
          showHint={false}
          onFileSelect={onFileSelect}
        />
        <Typography variant="body2" color="text.secondary">
          JSON-файл с чеками Ozon
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          Выгрузите чеки:{' '}
          <Box component="code" sx={{ fontFamily: 'monospace' }}>
            npm run ozon:checks -- --from ДД-ММ-ГГГГ --to ДД-ММ-ГГГГ
          </Box>
          <br />
          При первом запуске:{' '}
          <Box component="code" sx={{ fontFamily: 'monospace' }}>
            npm run ozon:checks:login
          </Box>
        </Typography>
      </Stack>
    </Paper>
  )
}

export function ImportUploadSection({
  disabled,
  onExcelFileSelect,
  onOzonFileSelect,
  onAddOperation,
}: ImportUploadSectionProps) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      sx={{ alignItems: 'stretch' }}
    >
      <ExcelFileUpload
        disabled={disabled}
        onFileSelect={onExcelFileSelect}
        onAddOperation={onAddOperation}
      />
      <OzonFileUpload disabled={disabled} onFileSelect={onOzonFileSelect} />
    </Stack>
  )
}
