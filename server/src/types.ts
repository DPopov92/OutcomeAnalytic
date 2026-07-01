export interface OperationInput {
  month: number
  year: number
  category: string
  amount: number
}

export interface OperationRecord extends OperationInput {
  id: number
}

export interface ImportPayload {
  fileName?: string
  month: number
  year: number
  operations: Array<{
    category: string
    amount: number
  }>
  mappings?: CategoryMappingInput[]
}

export interface OperationsResponse {
  operations: OperationRecord[]
  lastImport: {
    fileName: string | null
    periodMonth: number | null
    periodYear: number | null
    importedAt: string | null
  } | null
}

export interface CategoryRecord {
  id: number
  name: string
  color: string
  createdAt: string
}

export interface CategoryInput {
  name: string
  color: string
}

export interface CategoryMappingRecord {
  operationCategory: string
  description: string
  category: string
}

export interface CategoryMappingInput {
  operationCategory: string
  description: string
  category: string
}

export interface CategoryMappingsResponse {
  mappings: CategoryMappingRecord[]
}
