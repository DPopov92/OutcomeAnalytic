import { Router } from 'express'
import { clearAllData, getLastImport, getOperations, replaceOperations } from '../db.js'
import type { ImportPayload, OperationsResponse } from '../types.js'

export const operationsRouter = Router()

function isValidPeriod(month: unknown, year: unknown): month is number {
  return (
    typeof month === 'number' &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    typeof year === 'number' &&
    Number.isInteger(year) &&
    year >= 2000 &&
    year <= 2100
  )
}

operationsRouter.get('/', (_req, res) => {
  const response: OperationsResponse = {
    operations: getOperations(),
    lastImport: getLastImport() ?? null,
  }

  res.json(response)
})

operationsRouter.post('/import', (req, res) => {
  const payload = req.body as ImportPayload

  if (!payload || !Array.isArray(payload.operations)) {
    res.status(400).json({ message: 'Ожидается массив operations.' })
    return
  }

  if (!isValidPeriod(payload.month, payload.year)) {
    res.status(400).json({ message: 'Укажите корректный месяц и год периода.' })
    return
  }

  if (payload.operations.length === 0) {
    res.status(400).json({ message: 'Нет операций для сохранения.' })
    return
  }

  for (const [index, operation] of payload.operations.entries()) {
    if (
      typeof operation.category !== 'string' ||
      typeof operation.amount !== 'number' ||
      !operation.category.trim() ||
      !Number.isFinite(operation.amount)
    ) {
      res.status(400).json({
        message: `Некорректная операция в позиции ${index + 1}. Укажите категорию и сумму.`,
      })
      return
    }
  }

  if (payload.mappings !== undefined) {
    if (!Array.isArray(payload.mappings)) {
      res.status(400).json({ message: 'Поле mappings должно быть массивом.' })
      return
    }

    for (const [index, mapping] of payload.mappings.entries()) {
      if (
        typeof mapping.operationCategory !== 'string' ||
        typeof mapping.description !== 'string' ||
        typeof mapping.category !== 'string' ||
        !mapping.operationCategory.trim() ||
        !mapping.description.trim() ||
        !mapping.category.trim()
      ) {
        res.status(400).json({
          message: `Некорректная связка категорий в позиции ${index + 1}.`,
        })
        return
      }
    }
  }

  const operations = replaceOperations(payload)

  res.status(201).json({
    operations,
    lastImport: getLastImport() ?? null,
  } satisfies OperationsResponse)
})

operationsRouter.delete('/', (_req, res) => {
  clearAllData()

  res.json({
    operations: [],
    lastImport: null,
  } satisfies OperationsResponse)
})
