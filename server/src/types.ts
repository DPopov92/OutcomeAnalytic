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

export interface OzonExportOrderDto {
  orderNumber: string
  date: string
  status: string
  totalAmount: number
  items: Array<{
    name: string
    quantity: number
    price: number
  }>
}

export interface OzonReceiptItemDto {
  name: string
  quantity: number
  price: number
}

export interface OzonReceiptDto {
  totalAmount: number
  date: string
  items: OzonReceiptItemDto[]
}

export interface UploadResult {
  batchId: string
  fileName: string
  inserted: number
  skipped: number
  source?: 'excel' | 'ozon'
  ozonOrders?: OzonExportOrderDto[]
  ozonReceipts?: OzonReceiptDto[]
}

export interface GroupedOperationInput {
  month: number
  year: number
  operationCategory: string
  description: string
  category: string
  amount: number
}

export interface ImportPayload {
  fileName?: string
  batchId?: string
  operations: GroupedOperationInput[]
  mappings?: CategoryMappingInput[]
}

export interface ManualOperationInput extends GroupedOperationInput {}

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
