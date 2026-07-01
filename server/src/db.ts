import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  CategoryInput,
  CategoryMappingInput,
  CategoryMappingRecord,
  CategoryRecord,
  ImportPayload,
  OperationRecord,
} from './types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '..', 'data')
const dbPath = join(dataDir, 'outcome-analytic.db')

mkdirSync(dataDir, { recursive: true })

const db = new DatabaseSync(dbPath)

function groupOperationsByCategory(
  operations: ImportPayload['operations'],
): Array<{ category: string; amount: number }> {
  const grouped = new Map<string, number>()

  for (const operation of operations) {
    const category = operation.category.trim()
    grouped.set(category, (grouped.get(category) ?? 0) + operation.amount)
  }

  return Array.from(grouped.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((left, right) => left.category.localeCompare(right.category, 'ru'))
}

function ensureSchema(): void {
  const operationsTable = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'operations'",
    )
    .get() as { name: string } | undefined

  if (operationsTable) {
    const columns = db.prepare('PRAGMA table_info(operations)').all() as Array<{ name: string }>
    const hasGroupedSchema = columns.some((column) => column.name === 'month')
    const hasDescription = columns.some((column) => column.name === 'description')

    if (!hasGroupedSchema || hasDescription) {
      db.exec('DROP TABLE operations')
      db.exec('DROP TABLE import_meta')
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      file_name TEXT,
      period_month INTEGER,
      period_year INTEGER,
      imported_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS category_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_category TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (operation_category, description)
    );
  `)
}

ensureSchema()

const selectAllStmt = db.prepare(`
  SELECT id, month, year, category, amount
  FROM operations
  ORDER BY year DESC, month DESC, category ASC
`)

const selectMetaStmt = db.prepare(`
  SELECT
    file_name AS fileName,
    period_month AS periodMonth,
    period_year AS periodYear,
    imported_at AS importedAt
  FROM import_meta
  WHERE id = 1
`)

const insertOperationStmt = db.prepare(`
  INSERT INTO operations (month, year, category, amount)
  VALUES (@month, @year, @category, @amount)
`)

const upsertMetaStmt = db.prepare(`
  INSERT INTO import_meta (id, file_name, period_month, period_year, imported_at)
  VALUES (1, @fileName, @periodMonth, @periodYear, @importedAt)
  ON CONFLICT(id) DO UPDATE SET
    file_name = excluded.file_name,
    period_month = excluded.period_month,
    period_year = excluded.period_year,
    imported_at = excluded.imported_at
`)

export function getOperations(): OperationRecord[] {
  return selectAllStmt.all() as unknown as OperationRecord[]
}

export function getLastImport() {
  return selectMetaStmt.get() as
    | {
        fileName: string | null
        periodMonth: number | null
        periodYear: number | null
        importedAt: string
      }
    | undefined
}

export function replaceOperations(payload: ImportPayload): OperationRecord[] {
  const groupedOperations = groupOperationsByCategory(payload.operations)

  db.exec('BEGIN IMMEDIATE')

  try {
    db.exec('DELETE FROM operations')

    for (const operation of groupedOperations) {
      insertOperationStmt.run({
        month: payload.month,
        year: payload.year,
        category: operation.category,
        amount: operation.amount,
      })
    }

    upsertMetaStmt.run({
      fileName: payload.fileName ?? null,
      periodMonth: payload.month,
      periodYear: payload.year,
      importedAt: new Date().toISOString(),
    })

    if (payload.mappings?.length) {
      upsertCategoryMappings(payload.mappings)
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return getOperations()
}

export function clearAllData(): void {
  db.exec('DELETE FROM operations')
  db.exec('DELETE FROM import_meta')
}

const selectCategoriesStmt = db.prepare(`
  SELECT id, name, color, created_at AS createdAt
  FROM categories
  ORDER BY name ASC
`)

const selectCategoryByIdStmt = db.prepare(`
  SELECT id, name, color, created_at AS createdAt
  FROM categories
  WHERE id = ?
`)

const insertCategoryStmt = db.prepare(`
  INSERT INTO categories (name, color, created_at)
  VALUES (@name, @color, @createdAt)
`)

const updateCategoryStmt = db.prepare(`
  UPDATE categories
  SET name = @name, color = @color
  WHERE id = @id
`)

const deleteCategoryStmt = db.prepare(`
  DELETE FROM categories
  WHERE id = ?
`)

const countOperationsByCategoryStmt = db.prepare(`
  SELECT COUNT(*) AS count
  FROM operations
  WHERE category = ?
`)

const renameOperationsCategoryStmt = db.prepare(`
  UPDATE operations
  SET category = @newName
  WHERE category = @oldName
`)

const renameCategoryMappingsStmt = db.prepare(`
  UPDATE category_mappings
  SET category = @newName
  WHERE category = @oldName
`)

const selectCategoryMappingsStmt = db.prepare(`
  SELECT
    operation_category AS operationCategory,
    description,
    category
  FROM category_mappings
  ORDER BY operation_category ASC, description ASC
`)

const upsertCategoryMappingStmt = db.prepare(`
  INSERT INTO category_mappings (operation_category, description, category, updated_at)
  VALUES (@operationCategory, @description, @category, @updatedAt)
  ON CONFLICT(operation_category, description) DO UPDATE SET
    category = excluded.category,
    updated_at = excluded.updated_at
`)

export function getCategories(): CategoryRecord[] {
  return selectCategoriesStmt.all() as unknown as CategoryRecord[]
}

export function getCategoryById(id: number): CategoryRecord | undefined {
  return selectCategoryByIdStmt.get(id) as CategoryRecord | undefined
}

export function createCategory(input: CategoryInput): CategoryRecord {
  const result = insertCategoryStmt.run({
    name: input.name.trim(),
    color: input.color,
    createdAt: new Date().toISOString(),
  })

  const created = getCategoryById(Number(result.lastInsertRowid))
  if (!created) {
    throw new Error('Не удалось создать категорию.')
  }

  return created
}

export function updateCategory(
  id: number,
  input: CategoryInput,
): CategoryRecord | undefined {
  const existing = getCategoryById(id)
  if (!existing) {
    return undefined
  }

  const newName = input.name.trim()

  db.exec('BEGIN IMMEDIATE')

  try {
    if (existing.name !== newName) {
      renameOperationsCategoryStmt.run({
        oldName: existing.name,
        newName,
      })
      renameCategoryMappingsStmt.run({
        oldName: existing.name,
        newName,
      })
    }

    updateCategoryStmt.run({
      id,
      name: newName,
      color: input.color,
    })

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return getCategoryById(id)
}

export function getCategoryMappings(): CategoryMappingRecord[] {
  return selectCategoryMappingsStmt.all() as unknown as CategoryMappingRecord[]
}

export function upsertCategoryMappings(mappings: CategoryMappingInput[]): void {
  const updatedAt = new Date().toISOString()

  for (const mapping of mappings) {
    const operationCategory = mapping.operationCategory.trim()
    const description = mapping.description.trim()
    const category = mapping.category.trim()

    if (!operationCategory || !description || !category) {
      continue
    }

    upsertCategoryMappingStmt.run({
      operationCategory,
      description,
      category,
      updatedAt,
    })
  }
}

export function deleteCategory(id: number): { deleted: boolean; reason?: string } {
  const existing = getCategoryById(id)
  if (!existing) {
    return { deleted: false, reason: 'not_found' }
  }

  const usage = countOperationsByCategoryStmt.get(existing.name) as { count: number }
  if (usage.count > 0) {
    return { deleted: false, reason: 'in_use' }
  }

  deleteCategoryStmt.run(id)
  return { deleted: true }
}

export function closeDatabase(): void {
  db.close()
}
