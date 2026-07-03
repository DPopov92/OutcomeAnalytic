import assert from 'node:assert/strict'
import test from 'node:test'
import { buildExcelGroupsFromBatch, buildExcelGroupsFromParsedRows } from './groupOperations.js'
import type { FileOperationRecord } from './types.js'
import type { ParsedExpenseRow } from './parseExcel.js'

function makeRow(
  overrides: Partial<FileOperationRecord> & Pick<FileOperationRecord, 'date' | 'amount'>,
): FileOperationRecord {
  return {
    id: 1,
    operationCategory: 'Перевод',
    description: 'Оплата услуг',
    importBatchId: 'batch-1',
    fileName: 'expenses.xlsx',
    importedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  }
}

test('buildExcelGroupsFromBatch merges rows with the same group key', () => {
  const groups = buildExcelGroupsFromBatch([
    makeRow({ id: 1, date: '2026-06-10', amount: 100 }),
    makeRow({ id: 2, date: '2026-06-05', amount: 250 }),
    makeRow({
      id: 3,
      date: '2026-06-01',
      operationCategory: 'Покупка',
      description: 'Магазин',
      amount: 500,
    }),
  ])

  assert.equal(groups.length, 2)

  const transferGroup = groups.find((group) => group.operationCategory === 'Перевод')
  assert.ok(transferGroup)
  assert.equal(transferGroup.totalAmount, 350)
  assert.equal(transferGroup.items.length, 2)
  assert.deepEqual(
    transferGroup.items.map((item) => item.amount),
    [100, 250],
  )
  assert.deepEqual(
    transferGroup.items.map((item) => item.date),
    ['2026-06-10', '2026-06-05'],
  )

  const purchaseGroup = groups.find((group) => group.operationCategory === 'Покупка')
  assert.ok(purchaseGroup)
  assert.equal(purchaseGroup.totalAmount, 500)
  assert.equal(purchaseGroup.items.length, 1)
})

test('buildExcelGroupsFromBatch sorts groups and items consistently', () => {
  const groups = buildExcelGroupsFromBatch([
    makeRow({
      id: 1,
      date: '2026-05-01',
      operationCategory: 'Б',
      description: 'Описание B',
      amount: 10,
    }),
    makeRow({
      id: 2,
      date: '2026-06-01',
      operationCategory: 'А',
      description: 'Описание A',
      amount: 20,
    }),
    makeRow({
      id: 3,
      date: '2026-06-02',
      operationCategory: 'А',
      description: 'Описание A',
      amount: 30,
    }),
  ])

  assert.equal(groups.length, 2)
  assert.equal(groups[0]?.year, 2026)
  assert.equal(groups[0]?.month, 6)
  assert.equal(groups[0]?.operationCategory, 'А')
  assert.equal(groups[0]?.totalAmount, 50)
  assert.deepEqual(
    groups[0]?.items.map((item) => item.date),
    ['2026-06-02', '2026-06-01'],
  )

  assert.equal(groups[1]?.month, 5)
  assert.equal(groups[1]?.operationCategory, 'Б')
})

test('buildExcelGroupsFromParsedRows preserves operation time', () => {
  const parsedRows: ParsedExpenseRow[] = [
    {
      date: new Date(2026, 5, 10, 13, 53),
      operationCategory: 'Перевод',
      description: 'Оплата услуг',
      amount: 100,
    },
    {
      date: new Date(2026, 5, 10, 9, 15),
      operationCategory: 'Перевод',
      description: 'Оплата услуг',
      amount: 250,
    },
  ]

  const stagedRows: FileOperationRecord[] = [
    makeRow({ id: 1, date: '2026-06-10', amount: 100 }),
    makeRow({ id: 2, date: '2026-06-10', amount: 250 }),
  ]

  const groups = buildExcelGroupsFromParsedRows(parsedRows, stagedRows)

  assert.equal(groups.length, 1)
  assert.equal(groups[0]?.items.length, 2)
  assert.deepEqual(
    groups[0]?.items.map((item) => item.time),
    ['13:53', '09:15'],
  )
})
