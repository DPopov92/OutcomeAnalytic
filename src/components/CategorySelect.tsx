import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import type { Category } from '../types/category'
import { CategoryBadge } from './CategoryBadge'

interface CategorySelectProps {
  value: string
  categories: Category[]
  categoryColors: Record<string, string>
  placeholder?: string
  hasError?: boolean
  disabled?: boolean
  clearable?: boolean
  onChange: (value: string) => void
}

export function CategorySelect({
  value,
  categories,
  categoryColors: _categoryColors,
  placeholder = 'Категория',
  hasError = false,
  disabled = false,
  clearable = false,
  onChange,
}: CategorySelectProps) {
  const options = categories.map((category) => category.name)

  return (
    <Autocomplete
      size="small"
      options={options}
      value={value || null}
      disabled={disabled}
      disableClearable={!clearable}
      onChange={(_, newValue) => onChange(newValue ?? '')}
      getOptionLabel={(option) => option}
      isOptionEqualToValue={(option, optionValue) => option === optionValue}
      renderInput={(params) => (
        <TextField {...params} placeholder={placeholder} error={hasError} />
      )}
      renderOption={(props, option) => {
        const category = categories.find((item) => item.name === option)
        const { key, ...optionProps } = props

        return (
          <Box component="li" key={key} {...optionProps}>
            <CategoryBadge name={option} color={category?.color} />
          </Box>
        )
      }}
      slotProps={{
        popper: {
          sx: { minWidth: 200 },
        },
      }}
    />
  )
}
