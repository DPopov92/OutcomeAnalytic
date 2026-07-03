import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from '../api/categories'
import { AddIcon } from '../assets/icons/AddIcon'
import { CancelIcon } from '../assets/icons/CancelIcon'
import { DeleteIcon } from '../assets/icons/DeleteIcon'
import { EditIcon } from '../assets/icons/EditIcon'
import { SaveIcon } from '../assets/icons/SaveIcon'
import { DEFAULT_CATEGORY_COLOR } from '../constants/categoryPresetColors'
import type { Category, CategoryInput } from '../types/category'
import { CategoryBadge } from './CategoryBadge'
import { CategoryColorPicker } from './CategoryColorPicker'

const DEFAULT_COLOR = DEFAULT_CATEGORY_COLOR
const ICON_SIZE = 20
const ICON_STROKE = 2

interface CategoryManagerModalProps {
  categories: Category[]
  onClose: () => void
  onCategoriesChange: (categories: Category[]) => void
  onOperationsCategoryRenamed?: (oldName: string, newName: string) => void
}

interface EditState {
  id: number
  name: string
  color: string
}

export function CategoryManagerModal({
  categories,
  onClose,
  onCategoriesChange,
  onOperationsCategoryRenamed,
}: CategoryManagerModalProps) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string>(DEFAULT_COLOR)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()

    const input: CategoryInput = {
      name: newName.trim(),
      color: newColor,
    }

    if (!input.name) {
      setError('Введите название категории.')
      return
    }

    setBusy(true)
    setError(null)

    try {
      const category = await createCategory(input)
      onCategoriesChange([...categories, category].sort((a, b) => a.name.localeCompare(b.name, 'ru')))
      setNewName('')
      setNewColor(DEFAULT_COLOR)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать категорию.')
    } finally {
      setBusy(false)
    }
  }

  function startEdit(category: Category) {
    setEditState({
      id: category.id,
      name: category.name,
      color: category.color,
    })
    setError(null)
  }

  function cancelEdit() {
    setEditState(null)
    setError(null)
  }

  async function handleSaveEdit() {
    if (!editState) {
      return
    }

    const input: CategoryInput = {
      name: editState.name.trim(),
      color: editState.color,
    }

    if (!input.name) {
      setError('Введите название категории.')
      return
    }

    const existing = categories.find((category) => category.id === editState.id)
    const oldName = existing?.name

    setBusy(true)
    setError(null)

    try {
      const updated = await updateCategory(editState.id, input)
      onCategoriesChange(
        categories
          .map((category) => (category.id === updated.id ? updated : category))
          .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
      )

      if (oldName && oldName !== updated.name) {
        onOperationsCategoryRenamed?.(oldName, updated.name)
      }

      setEditState(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить категорию.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(category: Category) {
    if (!window.confirm(`Удалить категорию «${category.name}»?`)) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      await deleteCategory(category.id)
      onCategoriesChange(categories.filter((item) => item.id !== category.id))

      if (editState?.id === category.id) {
        setEditState(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить категорию.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={busy ? undefined : onClose}>
      <DialogTitle
        id="category-manager-title"
        sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}
      >
        <Box>
          <Typography variant="h6" component="span">
            Категории
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Настройте названия и цвета категорий для отображения в таблице на главном экране.
          </Typography>
        </Box>
        <IconButton aria-label="Закрыть" disabled={busy} onClick={onClose} sx={{ mt: -0.5 }}>
          <CancelIcon size={ICON_SIZE} strokeWidth={ICON_STROKE} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box
          component="form"
          onSubmit={(event) => void handleCreate(event)}
          sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'center', mb: 2 }}
        >
          <TextField
            size="small"
            value={newName}
            placeholder="Название категории"
            disabled={busy}
            slotProps={{ htmlInput: { maxLength: 80, 'aria-label': 'Название категории' } }}
            onChange={(event) => setNewName(event.target.value)}
            sx={{ flex: 1 }}
          />
          <CategoryColorPicker value={newColor} onChange={setNewColor} disabled={busy} />
          <IconButton
            type="submit"
            color="primary"
            disabled={busy}
            aria-label="Добавить категорию"
            title="Добавить категорию"
          >
            <AddIcon size={ICON_SIZE} strokeWidth={ICON_STROKE} />
          </IconButton>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {categories.length === 0 ? (
          <Typography color="text.secondary">Категории пока не созданы.</Typography>
        ) : (
          <List disablePadding>
            {categories.map((category) => (
              <ListItem
                key={category.id}
                disableGutters
                sx={{
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  py: 1,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                {editState?.id === category.id ? (
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', width: '100%' }}>
                    <TextField
                      size="small"
                      value={editState.name}
                      placeholder="Название категории"
                      disabled={busy}
                      slotProps={{ htmlInput: { maxLength: 80, 'aria-label': 'Название категории' } }}
                      onChange={(event) =>
                        setEditState({ ...editState, name: event.target.value })
                      }
                      sx={{ flex: 1 }}
                    />
                    <CategoryColorPicker
                      value={editState.color}
                      onChange={(color) => setEditState({ ...editState, color })}
                      disabled={busy}
                    />
                    <IconButton
                      color="primary"
                      disabled={busy}
                      aria-label="Сохранить изменения"
                      title="Сохранить"
                      onClick={() => void handleSaveEdit()}
                    >
                      <SaveIcon size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                    </IconButton>
                    <IconButton
                      disabled={busy}
                      aria-label="Отменить редактирование"
                      title="Отмена"
                      onClick={cancelEdit}
                    >
                      <CancelIcon size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                    </IconButton>
                  </Stack>
                ) : (
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', width: '100%' }}>
                    <CategoryBadge name={category.name} color={category.color} />
                    <Box sx={{ flex: 1 }} />
                    <IconButton
                      disabled={busy}
                      aria-label={`Изменить категорию «${category.name}»`}
                      title="Изменить"
                      onClick={() => startEdit(category)}
                    >
                      <EditIcon size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                    </IconButton>
                    <IconButton
                      color="error"
                      disabled={busy}
                      aria-label={`Удалить категорию «${category.name}»`}
                      title="Удалить"
                      onClick={() => void handleDelete(category)}
                    >
                      <DeleteIcon size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                    </IconButton>
                  </Stack>
                )}
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="outlined" onClick={onClose} disabled={busy}>
          Закрыть
        </Button>
      </DialogActions>
    </Dialog>
  )
}
