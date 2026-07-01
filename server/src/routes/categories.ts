import { Router } from 'express'
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from '../db.js'
import type { CategoryInput } from '../types.js'

export const categoriesRouter = Router()

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/

function parseCategoryInput(body: unknown): CategoryInput | null {
  if (!body || typeof body !== 'object') {
    return null
  }

  const { name, color } = body as Record<string, unknown>

  if (typeof name !== 'string' || typeof color !== 'string') {
    return null
  }

  const trimmedName = name.trim()
  if (!trimmedName || !HEX_COLOR_PATTERN.test(color)) {
    return null
  }

  return { name: trimmedName, color: color.toLowerCase() }
}

categoriesRouter.get('/', (_req, res) => {
  res.json({ categories: getCategories() })
})

categoriesRouter.post('/', (req, res) => {
  const input = parseCategoryInput(req.body)

  if (!input) {
    res.status(400).json({
      message: 'Укажите название и цвет в формате #RRGGBB.',
    })
    return
  }

  try {
    const category = createCategory(input)
    res.status(201).json({ category })
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes('UNIQUE')
        ? 'Категория с таким названием уже существует.'
        : 'Не удалось создать категорию.'

    res.status(400).json({ message })
  }
})

categoriesRouter.patch('/:id', (req, res) => {
  const id = Number(req.params.id)

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: 'Некорректный идентификатор категории.' })
    return
  }

  const input = parseCategoryInput(req.body)

  if (!input) {
    res.status(400).json({
      message: 'Укажите название и цвет в формате #RRGGBB.',
    })
    return
  }

  try {
    const category = updateCategory(id, input)

    if (!category) {
      res.status(404).json({ message: 'Категория не найдена.' })
      return
    }

    res.json({ category })
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes('UNIQUE')
        ? 'Категория с таким названием уже существует.'
        : 'Не удалось обновить категорию.'

    res.status(400).json({ message })
  }
})

categoriesRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id)

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: 'Некорректный идентификатор категории.' })
    return
  }

  const result = deleteCategory(id)

  if (result.reason === 'not_found') {
    res.status(404).json({ message: 'Категория не найдена.' })
    return
  }

  if (result.reason === 'in_use') {
    res.status(409).json({
      message: 'Нельзя удалить категорию, которая используется в операциях.',
    })
    return
  }

  res.status(204).send()
})
