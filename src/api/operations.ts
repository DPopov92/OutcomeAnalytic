import type { GroupedExpense } from '../types/expense'

import type { OzonExportOrder, OzonReceipt } from '../types/ozon'
import type { ExcelOperationGroup } from '../types/excel'

export interface OperationDto {
  id: number
  month: number
  year: number
  category: string
  amount: number
}

export interface OperationsResponse {
  operations: OperationDto[]
  lastImport: {
    fileName: string | null
    importedAt: string | null
  } | null
}

export interface UploadResponse {
  batchId: string
  fileName: string
  inserted: number
  skipped: number
  source?: 'excel' | 'ozon'
  ozonOrders?: OzonExportOrder[]
  ozonReceipts?: OzonReceipt[]
  excelGroups?: ExcelOperationGroup[]
}

export interface PreviewOperationDto {
  id: string
  month: number
  year: number
  operationCategory: string
  description: string
  amount: number
}

export interface PreviewResponse {
  operations: PreviewOperationDto[]
}

export interface CategoryMappingInput {
  operationCategory: string
  description: string
  category: string
}

export interface GroupedOperationInput {
  month: number
  year: number
  operationCategory: string
  description: string
  category: string
  amount: number
}

export interface ImportOperationsPayload {
  fileName?: string
  batchId?: string
  operations: GroupedOperationInput[]
  mappings?: CategoryMappingInput[]
}

export interface AddOperationPayload extends GroupedOperationInput {}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = 'Не удалось выполнить запрос к серверу.'

    try {
      const body = (await response.json()) as { message?: string }
      if (body.message) {
        message = body.message
      }
    } catch {
      // ignore parse errors
    }

    throw new Error(message)
  }

  return response.json() as Promise<T>
}

export function mapOperationDto(dto: OperationDto): GroupedExpense {
  return {
    id: String(dto.id),
    month: dto.month,
    year: dto.year,
    category: dto.category,
    amount: dto.amount,
  }
}

export async function fetchOperations(): Promise<OperationsResponse> {
  const response = await fetch('/api/operations')
  return parseJsonResponse<OperationsResponse>(response)
}

export async function uploadExcelFile(file: File): Promise<UploadResponse> {
  const response = await fetch('/api/operations/upload/excel', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name),
    },
    body: file,
  })

  return parseJsonResponse<UploadResponse>(response)
}

export async function uploadOzonFile(file: File): Promise<UploadResponse> {
  const response = await fetch('/api/operations/upload/ozon', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name),
    },
    body: file,
  })

  return parseJsonResponse<UploadResponse>(response)
}

export async function fetchImportPreview(batchId: string): Promise<PreviewResponse> {
  const response = await fetch(`/api/operations/preview/${encodeURIComponent(batchId)}`)
  return parseJsonResponse<PreviewResponse>(response)
}

export async function cancelImportBatch(batchId: string): Promise<void> {
  const response = await fetch(
    `/api/operations/batch/${encodeURIComponent(batchId)}`,
    {
      method: 'DELETE',
    },
  )

  if (!response.ok) {
    let message = 'Не удалось отменить загрузку.'

    try {
      const body = (await response.json()) as { message?: string }
      if (body.message) {
        message = body.message
      }
    } catch {
      // ignore parse errors
    }

    throw new Error(message)
  }
}

export async function addOperation(
  payload: AddOperationPayload,
): Promise<OperationsResponse> {
  const response = await fetch('/api/operations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJsonResponse<OperationsResponse>(response)
}

export async function importOperations(
  payload: ImportOperationsPayload,
): Promise<OperationsResponse> {
  const response = await fetch('/api/operations/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJsonResponse<OperationsResponse>(response)
}

export async function clearAllOperations(): Promise<OperationsResponse> {
  const response = await fetch('/api/operations', {
    method: 'DELETE',
  })

  return parseJsonResponse<OperationsResponse>(response)
}
