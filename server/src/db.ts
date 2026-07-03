import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { groupFileOperations, buildGroupKey, buildExcelGroupsFromParsedRows } from './groupOperations.js'
import { parseExcelImportFile, parseOzonImportFile } from './parseImportFile.js'
import { toDateKey } from './parseExcel.js'
import type { ParsedExpenseRow } from './parseExcel.js'
import type {
  CategoryInput,
  CategoryMappingInput,
  CategoryMappingRecord,
  CategoryRecord,
  FileOperationRecord,
  GroupedPreviewRecord,
  ImportPayload,
  ManualOperationInput,
  OperationRecord,
  UploadResult,
} from './types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appEnv = process.env.APP_ENV ?? 'development'
const dbSubdir = appEnv === 'production' ? 'prod' : 'dev'
const dataDir = join(__dirname, '..', 'data', dbSubdir)
const dbPath = join(dataDir, 'outcome-analytic.db')

mkdirSync(dataDir, { recursive: true })

const db = new DatabaseSync(dbPath)

function ensureSchema(): void {
  const operationsTable = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'operations'",
    )
    .get() as { name: string } | undefined

  if (operationsTable) {
    const columns = db.prepare('PRAGMA table_info(operations)').all() as Array<{
      name: string
    }>
    const hasMonth = columns.some((column) => column.name === 'month')
    const hasDate = columns.some((column) => column.name === 'date')
    const tableSql = db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'operations'",
      )
      .get() as { sql: string } | undefined
    const hasLegacyUniqueConstraint = tableSql?.sql.includes(
      'UNIQUE (date, operation_category, description)',
    )

    if ((hasMonth && !hasDate) || hasLegacyUniqueConstraint) {
      db.exec('DROP TABLE operations')
      db.exec('DROP TABLE import_meta')
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      operation_category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      import_batch_id TEXT NOT NULL,
      file_name TEXT,
      imported_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS grouped_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      operation_category TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      UNIQUE (month, year, operation_category, description)
    );

    CREATE TABLE IF NOT EXISTS import_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      file_name TEXT,
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

const selectGroupedOperationsStmt = db.prepare(`
  SELECT
    MIN(id) AS id,
    month,
    year,
    category,
    SUM(amount) AS amount
  FROM grouped_operations
  GROUP BY month, year, category
  ORDER BY year DESC, month DESC, category ASC
`)

const selectMetaStmt = db.prepare(`
  SELECT
    file_name AS fileName,
    imported_at AS importedAt
  FROM import_meta
  WHERE id = 1
`)

const insertFileOperationStmt = db.prepare(`
  INSERT INTO operations (
    date,
    operation_category,
    description,
    amount,
    import_batch_id,
    file_name,
    imported_at
  )
  VALUES (
    @date,
    @operationCategory,
    @description,
    @amount,
    @importBatchId,
    @fileName,
    @importedAt
  )
`)

const selectFileOperationsByBatchStmt = db.prepare(`
  SELECT
    id,
    date,
    operation_category AS operationCategory,
    description,
    amount,
    import_batch_id AS importBatchId,
    file_name AS fileName,
    imported_at AS importedAt
  FROM operations
  WHERE import_batch_id = ?
  ORDER BY date DESC, operation_category ASC, description ASC
`)

const deleteImportBatchStmt = db.prepare(`
  DELETE FROM operations
  WHERE import_batch_id = ?
`)

const existsGroupedOperationStmt = db.prepare(`
  SELECT 1
  FROM grouped_operations
  WHERE month = ?
    AND year = ?
    AND operation_category = ?
    AND description = ?
  LIMIT 1
`)

const upsertMetaStmt = db.prepare(`
  INSERT INTO import_meta (id, file_name, imported_at)
  VALUES (1, @fileName, @importedAt)
  ON CONFLICT(id) DO UPDATE SET
    file_name = excluded.file_name,
    imported_at = excluded.imported_at
`)

const upsertGroupedOperationStmt = db.prepare(`
  INSERT INTO grouped_operations (
    month,
    year,
    operation_category,
    description,
    category,
    amount
  )
  VALUES (
    @month,
    @year,
    @operationCategory,
    @description,
    @category,
    @amount
  )
  ON CONFLICT(month, year, operation_category, description) DO UPDATE SET
    category = excluded.category,
    amount = excluded.amount
`)

export function getOperations(): OperationRecord[] {
  return selectGroupedOperationsStmt.all() as unknown as OperationRecord[]
}

export function getLastImport() {
  return selectMetaStmt.get() as
    | {
        fileName: string | null
        importedAt: string
      }
    | undefined
}

export function uploadParsedOperations(
  parsed: ParsedExpenseRow[],
  fileName: string,
): UploadResult {
  const batchId = randomUUID()
  const importedAt = new Date().toISOString()
  let inserted = 0
  let skipped = 0

  const groupedRows = new Map<
    string,
    {
      month: number
      year: number
      operationCategory: string
      description: string
      rows: ParsedExpenseRow[]
    }
  >()

  for (const row of parsed) {
    const date = toDateKey(row.date)
    const [yearStr, monthStr] = date.split('-')
    const year = Number(yearStr)
    const month = Number(monthStr)
    const operationCategory = row.operationCategory.trim()
    const description = row.description.trim()
    const key = buildGroupKey(month, year, operationCategory, description)
    const existing = groupedRows.get(key)

    if (existing) {
      existing.rows.push(row)
      continue
    }

    groupedRows.set(key, {
      month,
      year,
      operationCategory,
      description,
      rows: [row],
    })
  }

  db.exec('BEGIN IMMEDIATE')

  try {
    for (const group of groupedRows.values()) {
      const alreadySaved = existsGroupedOperationStmt.get(
        group.month,
        group.year,
        group.operationCategory,
        group.description,
      )

      if (alreadySaved) {
        skipped += 1
        continue
      }

      for (const row of group.rows) {
        insertFileOperationStmt.run({
          date: toDateKey(row.date),
          operationCategory: row.operationCategory.trim(),
          description: row.description.trim(),
          amount: row.amount,
          importBatchId: batchId,
          fileName,
          importedAt,
        })
      }

      inserted += 1
    }

    if (inserted > 0) {
      upsertMetaStmt.run({
        fileName,
        importedAt,
      })
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return {
    batchId,
    fileName,
    inserted,
    skipped,
  }
}

export function uploadExcelFileOperations(
  fileBuffer: Buffer,
  fileName: string,
): UploadResult {
  const parsedImport = parseExcelImportFile(fileBuffer)
  const result = uploadParsedOperations(parsedImport.rows, fileName)

  const stagedRows =
    result.inserted > 0
      ? (selectFileOperationsByBatchStmt.all(result.batchId) as unknown as FileOperationRecord[])
      : []

  return {
    ...result,
    source: 'excel',
    excelGroups:
      stagedRows.length > 0
        ? buildExcelGroupsFromParsedRows(parsedImport.rows, stagedRows)
        : undefined,
  }
}

export function uploadOzonFileOperations(
  fileBuffer: Buffer,
  fileName: string,
): UploadResult {
  const parsedImport = parseOzonImportFile(fileBuffer)
  const result = uploadParsedOperations(parsedImport.rows, fileName)

  return {
    ...result,
    source: 'ozon',
    ozonOrders: parsedImport.ozonExport?.orders,
    ozonReceipts: parsedImport.ozonReceipts?.receipts,
  }
}

export function cancelImportBatch(batchId: string): void {
  deleteImportBatchStmt.run(batchId)
}

export function getImportPreview(batchId: string): GroupedPreviewRecord[] {
  const rows = selectFileOperationsByBatchStmt.all(batchId) as unknown as FileOperationRecord[]
  return groupFileOperations(rows)
}

export function addManualOperation(input: ManualOperationInput): OperationRecord[] {
  return saveGroupedOperations({
    operations: [
      {
        month: input.month,
        year: input.year,
        operationCategory: input.operationCategory.trim(),
        description: input.description.trim(),
        category: input.category.trim(),
        amount: input.amount,
      },
    ],
    mappings: [
      {
        operationCategory: input.operationCategory.trim(),
        description: input.description.trim(),
        category: input.category.trim(),
      },
    ],
  })
}

export function saveGroupedOperations(payload: ImportPayload): OperationRecord[] {
  db.exec('BEGIN IMMEDIATE')

  try {
    for (const operation of payload.operations) {
      upsertGroupedOperationStmt.run({
        month: operation.month,
        year: operation.year,
        operationCategory: operation.operationCategory.trim(),
        description: operation.description.trim(),
        category: operation.category.trim(),
        amount: operation.amount,
      })
    }

    if (payload.fileName) {
      upsertMetaStmt.run({
        fileName: payload.fileName,
        importedAt: new Date().toISOString(),
      })
    }

    if (payload.mappings?.length) {
      upsertCategoryMappings(payload.mappings)
    }

    if (payload.batchId?.trim()) {
      deleteImportBatchStmt.run(payload.batchId.trim())
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
  db.exec('DELETE FROM grouped_operations')
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

const countGroupedOperationsByCategoryStmt = db.prepare(`
  SELECT COUNT(*) AS count
  FROM grouped_operations
  WHERE category = ?
`)

const renameGroupedOperationsCategoryStmt = db.prepare(`
  UPDATE grouped_operations
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
      renameGroupedOperationsCategoryStmt.run({
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

  const usage = countGroupedOperationsByCategoryStmt.get(existing.name) as {
    count: number
  }
  if (usage.count > 0) {
    return { deleted: false, reason: 'in_use' }
  }

  deleteCategoryStmt.run(id)
  return { deleted: true }
}

export function closeDatabase(): void {
  db.close()
}
