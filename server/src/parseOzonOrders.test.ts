import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { parseExcelImportFile, parseOzonImportFile } from './parseImportFile.js'
import {
  buildOrderDescription,
  parseOzonExportFile,
  parseOzonOrdersBuffer,
} from './parseOzonOrders.js'
import { isOzonExportFile } from './ozonExportTypes.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(__dirname, '..', '..', 'scripts', 'fixtures', 'ozon-export-sample.json')
const fixtureBuffer = readFileSync(fixturePath)

test('isOzonExportFile validates export contract', () => {
  assert.equal(isOzonExportFile(JSON.parse(fixtureBuffer.toString('utf8'))), true)
  assert.equal(isOzonExportFile({ source: 'bank' }), false)
})

test('parseOzonImportFile routes ozon json fixture', () => {
  const parsed = parseOzonImportFile(fixtureBuffer)

  assert.equal(parsed.rows.length, 2)
  assert.equal(parsed.ozonExport?.orders.length, 2)
})

test('parseExcelImportFile rejects ozon json', () => {
  assert.throws(() => parseExcelImportFile(fixtureBuffer))
})

test('parseOzonOrdersBuffer maps delivered orders and skips cancelled', () => {
  const { rows, exportFile } = parseOzonOrdersBuffer(fixtureBuffer)

  assert.equal(exportFile.orders.length, 2)
  assert.equal(rows.length, 2)
  assert.equal(rows[0]?.operationCategory, 'Ozon')
  assert.equal(rows[0]?.amount, 1590.5)
  assert.match(rows[0]?.description ?? '', /87654321-0002/)
})

test('parseOzonOrdersBuffer rejects invalid json', () => {
  assert.throws(
    () => parseOzonOrdersBuffer(Buffer.from('not-json')),
    /некорректный JSON/i,
  )
})

test('parseOzonOrdersBuffer rejects non-ozon json', () => {
  assert.throws(
    () => parseOzonOrdersBuffer(Buffer.from(JSON.stringify({ hello: 'world' }))),
    /не похож на выгрузку Ozon/i,
  )
})

test('parseOzonExportFile throws when period has no orders', () => {
  const exportFile = JSON.parse(fixtureBuffer.toString('utf8'))
  exportFile.period = { from: '2020-01-01', to: '2020-01-31' }

  assert.throws(() => parseOzonExportFile(exportFile), /не найдено заказов/i)
})

test('parseOzonExportFile supports splitByItems', () => {
  const exportFile = JSON.parse(fixtureBuffer.toString('utf8'))
  exportFile.splitByItems = true
  exportFile.orders = exportFile.orders.filter(
    (order: { orderNumber: string }) => order.orderNumber === '87654321-0002',
  )

  const { rows } = parseOzonExportFile(exportFile)
  assert.equal(rows.length, 2)
  assert.match(rows[0]?.description ?? '', /Кабель USB-C|Чехол/)
})

test('buildOrderDescription formats single and multiple items', () => {
  assert.equal(
    buildOrderDescription({
      orderNumber: '1',
      date: '2026-01-01T00:00:00.000Z',
      status: 'delivered',
      totalAmount: 100,
      items: [{ name: 'Книга', quantity: 1, price: 100 }],
    }),
    'Заказ #1: Книга',
  )

  assert.equal(
    buildOrderDescription({
      orderNumber: '2',
      date: '2026-01-01T00:00:00.000Z',
      status: 'delivered',
      totalAmount: 300,
      items: [
        { name: 'A', quantity: 1, price: 100 },
        { name: 'B', quantity: 1, price: 100 },
        { name: 'C', quantity: 1, price: 100 },
      ],
    }),
    'Заказ #2: A, B и ещё 1',
  )
})
