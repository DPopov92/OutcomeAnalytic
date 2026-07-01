import { Router } from 'express'
import {
  cancelImportBatch,
  clearAllData,
  getImportPreview,
  getLastImport,
  getOperations,
  saveGroupedOperations,
  uploadFileOperations,
} from '../db.js'
import type { ImportPayload, OperationsResponse, PreviewResponse } from '../types.js'

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

operationsRouter.post('/upload', (req, res) => {
  const fileBuffer = req.body

  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    res.status(400).json({ message: 'Ожидается файл в теле запроса.' })
    return
  }

  const rawFileName = req.headers['x-file-name']
  const fileName =
    typeof rawFileName === 'string'
      ? decodeURIComponent(rawFileName)
      : 'import.xlsx'

  try {
    const result = uploadFileOperations(fileBuffer, fileName)
    res.status(201).json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Не удалось обработать файл.'
    res.status(400).json({ message })
  }
})

operationsRouter.get('/preview/:batchId', (req, res) => {
  const batchId = req.params.batchId

  if (!batchId.trim()) {
    res.status(400).json({ message: 'Укажите идентификатор загрузки.' })
    return
  }

  const response: PreviewResponse = {
    operations: getImportPreview(batchId),
  }

  res.json(response)
})

operationsRouter.delete('/batch/:batchId', (req, res) => {
  const batchId = req.params.batchId

  if (!batchId.trim()) {
    res.status(400).json({ message: 'Укажите идентификатор загрузки.' })
    return
  }

  cancelImportBatch(batchId)
  res.status(204).send()
})

operationsRouter.post('/import', (req, res) => {
  const payload = req.body as ImportPayload

  if (!payload || !Array.isArray(payload.operations)) {
    res.status(400).json({ message: 'Ожидается массив operations.' })
    return
  }

  if (payload.operations.length === 0) {
    res.status(400).json({ message: 'Нет операций для сохранения.' })
    return
  }

  for (const [index, operation] of payload.operations.entries()) {
    if (
      !isValidPeriod(operation.month, operation.year) ||
      typeof operation.operationCategory !== 'string' ||
      typeof operation.description !== 'string' ||
      typeof operation.category !== 'string' ||
      typeof operation.amount !== 'number' ||
      !operation.operationCategory.trim() ||
      !operation.category.trim() ||
      !Number.isFinite(operation.amount)
    ) {
      res.status(400).json({
        message: `Некорректная операция в позиции ${index + 1}.`,
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

  const operations = saveGroupedOperations(payload)

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
