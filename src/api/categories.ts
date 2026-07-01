import type { Category, CategoryInput } from '../types/category'

interface CategoriesResponse {
  categories: Category[]
}

interface CategoryResponse {
  category: Category
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

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export async function fetchCategories(): Promise<Category[]> {
  const response = await fetch('/api/categories')
  const data = await parseJsonResponse<CategoriesResponse>(response)
  return data.categories
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  const response = await fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  const data = await parseJsonResponse<CategoryResponse>(response)
  return data.category
}

export async function updateCategory(
  id: number,
  input: CategoryInput,
): Promise<Category> {
  const response = await fetch(`/api/categories/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  const data = await parseJsonResponse<CategoryResponse>(response)
  return data.category
}

export async function deleteCategory(id: number): Promise<void> {
  const response = await fetch(`/api/categories/${id}`, {
    method: 'DELETE',
  })

  await parseJsonResponse<void>(response)
}
