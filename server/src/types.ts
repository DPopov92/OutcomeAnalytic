export interface OperationRecord {
  id: number
  month: number
  year: number
  category: string
  amount: number
}

export interface FileOperationRecord {
  id: number
  date: string
  operationCategory: string
  description: string
  amount: number
  importBatchId: string
  fileName: string | null
  importedAt: string
}

export interface GroupedPreviewRecord {
  id: string
  month: number
  year: number
  operationCategory: string
  description: string
  amount: number
}

export interface UploadResult {
  batchId: string
  fileName: string
  inserted: number
  skipped: number
}

export interface ImportPayload {
  fileName?: string
  batchId?: string
  operations: Array<{
    month: number
    year: number
    operationCategory: string
    description: string
    category: string
    amount: number
  }>
  mappings?: CategoryMappingInput[]
}

export interface OperationsResponse {
  operations: OperationRecord[]
  lastImport: {
    fileName: string | null
    importedAt: string | null
  } | null
}

export interface PreviewResponse {
  operations: GroupedPreviewRecord[]
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
