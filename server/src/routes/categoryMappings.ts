import { Router } from 'express'
import { getCategoryMappings } from '../db.js'
import type { CategoryMappingsResponse } from '../types.js'

export const categoryMappingsRouter = Router()

categoryMappingsRouter.get('/', (_req, res) => {
  const response: CategoryMappingsResponse = {
    mappings: getCategoryMappings(),
  }

  res.json(response)
})
