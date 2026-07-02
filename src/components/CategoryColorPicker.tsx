import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Popover from '@mui/material/Popover'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useId, useRef, useState } from 'react'
import { PaletteIcon } from '../assets/icons/PaletteIcon'
import { CATEGORY_PRESET_COLORS } from '../constants/categoryPresetColors'

interface CategoryColorPickerProps {
  value: string
  onChange: (color: string) => void
  disabled?: boolean
}

function normalizeColor(color: string): string {
  return color.trim().toLowerCase()
}

export function CategoryColorPicker({
  value,
  onChange,
  disabled = false,
}: CategoryColorPickerProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const customInputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()
  const normalizedValue = normalizeColor(value)
  const open = Boolean(anchorEl)

  function selectColor(color: string) {
    onChange(normalizeColor(color))
    setAnchorEl(null)
  }

  return (
    <>
      <IconButton
        aria-label="Выбрать цвет категории"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{ color: value }}
      >
        <PaletteIcon size={20} strokeWidth={2} />
      </IconButton>

      <Popover
        id={listboxId}
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: { sx: { p: 1.5, maxWidth: 280 } },
        }}
      >
        <Box
          role="listbox"
          aria-label="Палитра цветов"
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: 0.75,
            mb: 1.5,
          }}
        >
          {CATEGORY_PRESET_COLORS.map((color) => {
            const isSelected = normalizedValue === normalizeColor(color)

            return (
              <IconButton
                key={color}
                role="option"
                aria-selected={isSelected}
                aria-label={`Цвет ${color}`}
                title={color}
                onClick={() => selectColor(color)}
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: color,
                  border: 2,
                  borderColor: isSelected ? 'primary.main' : 'transparent',
                  '&:hover': { bgcolor: color, opacity: 0.85 },
                }}
              />
            )
          })}
        </Box>

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <input
            ref={customInputRef}
            type="color"
            value={value}
            hidden
            disabled={disabled}
            aria-label="Свой цвет"
            onChange={(event) => onChange(normalizeColor(event.target.value))}
          />
          <Button
            size="small"
            variant="outlined"
            startIcon={<PaletteIcon size={15} strokeWidth={2} />}
            disabled={disabled}
            onClick={() => customInputRef.current?.click()}
          >
            Свой цвет
          </Button>
          <Typography variant="caption" color="text.secondary">
            {value}
          </Typography>
        </Stack>
      </Popover>
    </>
  )
}
