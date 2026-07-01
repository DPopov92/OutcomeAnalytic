import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import type { Category } from '../types/category'
import { resolveCategoryColor } from '../utils/categoryColors'
import { ChevronDownIcon } from '../assets/icons/ChevronDownIcon'
import './CategorySelect.css'

interface CategorySelectProps {
  value: string
  categories: Category[]
  categoryColors: Record<string, string>
  placeholder?: string
  hasError?: boolean
  disabled?: boolean
  onChange: (value: string) => void
}

function getCategoryLabelStyle(color: string | undefined): CSSProperties {
  if (!color) {
    return {
      borderColor: 'var(--border)',
      background: 'var(--accent-bg)',
      color: 'var(--accent)',
    }
  }

  const match = /^#([0-9a-f]{6})$/i.exec(color)
  if (!match) {
    return {
      borderColor: color,
      color,
    }
  }

  const hex = match[1]
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)

  return {
    borderColor: color,
    background: `rgba(${r}, ${g}, ${b}, 0.12)`,
    color,
  }
}

function CategoryLabel({ name, color }: { name: string; color?: string }) {
  return (
    <span className="category-select-label" style={getCategoryLabelStyle(color)}>
      {name}
    </span>
  )
}

export function CategorySelect({
  value,
  categories,
  categoryColors,
  placeholder = 'Категория',
  hasError = false,
  disabled = false,
  onChange,
}: CategorySelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const selectedColor = value ? resolveCategoryColor(value, categoryColors) : undefined

  useEffect(() => {
    if (!open) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  function handleSelect(categoryName: string) {
    onChange(categoryName)
    setOpen(false)
  }

  return (
    <div
      ref={containerRef}
      className={`category-select${open ? ' category-select-open' : ''}${
        hasError ? ' category-select-error' : ''
      }`}
    >
      <button
        type="button"
        className="category-select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
      >
        {value ? (
          <CategoryLabel name={value} color={selectedColor} />
        ) : (
          <span className="category-select-placeholder">{placeholder}</span>
        )}
        <ChevronDownIcon className="category-select-chevron" size={16} strokeWidth={2} />
      </button>

      {open && (
        <ul id={listboxId} className="category-select-menu" role="listbox">
          {categories.map((category) => (
            <li key={category.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={category.name === value}
                className={`category-select-option${
                  category.name === value ? ' category-select-option-selected' : ''
                }`}
                onClick={() => handleSelect(category.name)}
              >
                <CategoryLabel name={category.name} color={category.color} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
