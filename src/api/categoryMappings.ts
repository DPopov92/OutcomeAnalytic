export interface CategoryMapping {
  operationCategory: string
  description: string
  category: string
}

interface CategoryMappingsResponse {
  mappings: CategoryMapping[]
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

export async function fetchCategoryMappings(): Promise<CategoryMapping[]> {
  const response = await fetch('/api/category-mappings')
  const data = await parseJsonResponse<CategoryMappingsResponse>(response)
  return data.mappings
}
