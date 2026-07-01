import { useEffect, useState } from 'react'
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from '../api/categories'
import type { Category, CategoryInput } from '../types/category'
import { CategoryBadge } from './CategoryBadge'
import { CategoryColorPicker } from './CategoryColorPicker'
import { DEFAULT_CATEGORY_COLOR } from '../constants/categoryPresetColors'
import { AddIcon } from '../assets/icons/AddIcon'
import { CancelIcon } from '../assets/icons/CancelIcon'
import { DeleteIcon } from '../assets/icons/DeleteIcon'
import { EditIcon } from '../assets/icons/EditIcon'
import { SaveIcon } from '../assets/icons/SaveIcon'
import './CategoryManagerModal.css'
import './ImportPreviewModal.css'

const DEFAULT_COLOR = DEFAULT_CATEGORY_COLOR

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
  const [newColor, setNewColor] = useState(DEFAULT_COLOR)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = ''
    }
  }, [])

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
    if (
      !window.confirm(`Удалить категорию «${category.name}»?`)
    ) {
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
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div
        className="modal-dialog category-manager-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-manager-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="category-manager-title">Категории</h2>
            <p className="modal-subtitle">
              Настройте названия и цвета категорий для отображения в таблице на главном экране.
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Закрыть"
          >
            ×
          </button>
        </header>

        <div className="modal-body category-manager-body">
          <form className="category-form" onSubmit={(event) => void handleCreate(event)}>
            <label className="category-field category-field-name">
              <span className="visually-hidden">Название</span>
              <input
                type="text"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Название категории"
                disabled={busy}
                maxLength={80}
              />
            </label>

            <CategoryColorPicker
              value={newColor}
              onChange={setNewColor}
              disabled={busy}
            />

            <button
              type="submit"
              className="category-add-btn"
              disabled={busy}
              aria-label="Добавить категорию"
              title="Добавить категорию"
            >
              <AddIcon size={20} strokeWidth={2.5} />
            </button>
          </form>

          {error && <p className="category-error">{error}</p>}

          {categories.length === 0 ? (
            <p className="category-empty">Категории пока не созданы.</p>
          ) : (
            <ul className="category-list">
              {categories.map((category) => (
                <li key={category.id} className="category-list-item">
                  {editState?.id === category.id ? (
                    <div className="category-edit-row">
                      <label className="category-field category-field-name">
                        <span className="visually-hidden">Название</span>
                        <input
                          type="text"
                          value={editState.name}
                          onChange={(event) =>
                            setEditState({ ...editState, name: event.target.value })
                          }
                          placeholder="Название категории"
                          disabled={busy}
                          maxLength={80}
                        />
                      </label>

                      <CategoryColorPicker
                        value={editState.color}
                        onChange={(color) =>
                          setEditState({ ...editState, color })
                        }
                        disabled={busy}
                      />

                      <div className="category-edit-actions">
                        <button
                          type="button"
                          className="category-icon-btn category-icon-btn-save"
                          onClick={() => void handleSaveEdit()}
                          disabled={busy}
                          aria-label="Сохранить изменения"
                          title="Сохранить"
                        >
                          <SaveIcon size={16} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          className="category-icon-btn category-icon-btn-cancel"
                          onClick={cancelEdit}
                          disabled={busy}
                          aria-label="Отменить редактирование"
                          title="Отмена"
                        >
                          <CancelIcon size={16} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="category-view-row">
                      <CategoryBadge name={category.name} color={category.color} />
                      <span className="category-color-code">{category.color}</span>
                      <div className="category-row-actions">
                        <button
                          type="button"
                          className="category-icon-btn category-icon-btn-edit"
                          onClick={() => startEdit(category)}
                          disabled={busy}
                          aria-label={`Изменить категорию «${category.name}»`}
                          title="Изменить"
                        >
                          <EditIcon size={16} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          className="category-icon-btn category-icon-btn-delete"
                          onClick={() => void handleDelete(category)}
                          disabled={busy}
                          aria-label={`Удалить категорию «${category.name}»`}
                          title="Удалить"
                        >
                          <DeleteIcon size={16} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="modal-footer">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
            disabled={busy}
          >
            Закрыть
          </button>
        </footer>
      </div>
    </div>
  )
}
