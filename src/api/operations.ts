import type { GroupedExpense } from '../types/expense'

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
    periodMonth: number | null
    periodYear: number | null
    importedAt: string | null
  } | null
}

export interface CategoryMappingInput {
  operationCategory: string
  description: string
  category: string
}

export interface ImportOperationsPayload {
  fileName?: string
  month: number
  year: number
  operations: Array<{
    category: string
    amount: number
  }>
  mappings?: CategoryMappingInput[]
}

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
