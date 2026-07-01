import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PaletteIcon } from '../assets/icons/PaletteIcon'
import { CATEGORY_PRESET_COLORS } from '../constants/categoryPresetColors'
import './CategoryColorPicker.css'

interface CategoryColorPickerProps {
  value: string
  onChange: (color: string) => void
  disabled?: boolean
}

interface PopoverPosition {
  top: number
  left: number
}

const POPOVER_GAP = 6
const VIEWPORT_PADDING = 8

function normalizeColor(color: string): string {
  return color.trim().toLowerCase()
}

export function CategoryColorPicker({
  value,
  onChange,
  disabled = false,
}: CategoryColorPickerProps) {
  const [open, setOpen] = useState(false)
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const customInputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()
  const normalizedValue = normalizeColor(value)

  function updatePopoverPosition() {
    const trigger = triggerRef.current
    const popover = popoverRef.current

    if (!trigger || !popover) {
      return
    }

    const triggerRect = trigger.getBoundingClientRect()
    const popoverRect = popover.getBoundingClientRect()

    let top = triggerRect.bottom + POPOVER_GAP
    let left = triggerRect.right - popoverRect.width

    if (top + popoverRect.height > window.innerHeight - VIEWPORT_PADDING) {
      top = triggerRect.top - popoverRect.height - POPOVER_GAP
    }

    left = Math.max(
      VIEWPORT_PADDING,
      Math.min(left, window.innerWidth - popoverRect.width - VIEWPORT_PADDING),
    )

    top = Math.max(
      VIEWPORT_PADDING,
      Math.min(top, window.innerHeight - popoverRect.height - VIEWPORT_PADDING),
    )

    setPopoverPosition({ top, left })
  }

  useLayoutEffect(() => {
    if (!open) {
      setPopoverPosition(null)
      return
    }

    updatePopoverPosition()
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node

      if (
        !rootRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    function handleReposition() {
      updatePopoverPosition()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [open])

  function selectColor(color: string) {
    onChange(normalizeColor(color))
    setOpen(false)
  }

  const popover = open
    ? createPortal(
        <div
          ref={popoverRef}
          className="color-picker-popover"
          id={listboxId}
          role="listbox"
          aria-label="Палитра цветов"
          style={
            popoverPosition
              ? { top: popoverPosition.top, left: popoverPosition.left }
              : { visibility: 'hidden' }
          }
        >
          <div className="color-picker-palette">
            {CATEGORY_PRESET_COLORS.map((color) => {
              const isSelected = normalizedValue === normalizeColor(color)

              return (
                <button
                  key={color}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`color-picker-swatch${isSelected ? ' selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => selectColor(color)}
                  aria-label={`Цвет ${color}`}
                  title={color}
                />
              )
            })}
          </div>

          <div className="color-picker-custom">
            <input
              ref={customInputRef}
              type="color"
              className="color-picker-custom-input"
              value={value}
              onChange={(event) => onChange(normalizeColor(event.target.value))}
              disabled={disabled}
              aria-label="Свой цвет"
              tabIndex={-1}
            />
            <button
              type="button"
              className="color-picker-custom-btn"
              onClick={() => customInputRef.current?.click()}
              disabled={disabled}
              title="Свой цвет"
            >
              <PaletteIcon size={15} strokeWidth={2} />
              <span>Свой цвет</span>
            </button>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <div className="color-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="color-picker-trigger"
        style={{ color: value }}
        onClick={() => !disabled && setOpen((current) => !current)}
        disabled={disabled}
        aria-label="Выбрать цвет категории"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        title="Выбрать цвет"
      >
        <PaletteIcon size={20} strokeWidth={2} />
      </button>

      {popover}
    </div>
  )
}
