import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { parseOzonReceiptPdfText } from './parseOzonReceiptPdf.js'
import {
  buildReceiptDescription,
  parseOzonReceiptsBuffer,
  parseOzonReceiptsFile,
} from './parseOzonReceipts.js'
import { isOzonReceiptsFile } from './ozonReceiptTypes.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const receiptsFixturePath = join(
  __dirname,
  '..',
  '..',
  'scripts',
  'fixtures',
  'ozon-receipts-sample.json',
)
const receiptTextFixturePath = join(
  __dirname,
  '..',
  '..',
  'scripts',
  'fixtures',
  'ozon-receipt-text-sample.txt',
)

test('isOzonReceiptsFile validates receipts export contract', () => {
  const fixture = JSON.parse(readFileSync(receiptsFixturePath, 'utf8'))
  assert.equal(isOzonReceiptsFile(fixture), true)
  assert.equal(isOzonReceiptsFile({ source: 'ozon', exportedAt: 'x', receipts: [] }), true)
  assert.equal(isOzonReceiptsFile({ source: 'bank' }), false)
})

test('parseOzonReceiptPdfText extracts date, total and items', () => {
  const text = readFileSync(receiptTextFixturePath, 'utf8')
  const receipt = parseOzonReceiptPdfText(text)

  assert.ok(receipt)
  assert.equal(receipt.totalAmount, 2499)
  assert.equal(receipt.items.length, 1)
  assert.equal(receipt.items[0]?.name, 'Наушники беспроводные XYZ')
  assert.equal(receipt.items[0]?.quantity, 1)
  assert.equal(receipt.items[0]?.price, 2499)
  assert.match(receipt.date, /2026-03-15/)
})

test('parseOzonReceiptPdfText parses quantity and unit price', () => {
  const fixturePath = join(
    __dirname,
    '..',
    '..',
    'scripts',
    'fixtures',
    'ozon-receipt-text-multi-qty.txt',
  )
  const receipt = parseOzonReceiptPdfText(readFileSync(fixturePath, 'utf8'))

  assert.ok(receipt)
  assert.equal(receipt.totalAmount, 1590.5)
  assert.equal(receipt.items.length, 2)
  assert.equal(receipt.items[0]?.quantity, 2)
  assert.equal(receipt.items[0]?.price, 395.25)
  assert.equal(receipt.items[1]?.quantity, 1)
  assert.equal(receipt.items[1]?.price, 800)
})

test('parseOzonReceiptsBuffer maps receipts to expense rows', () => {
  const { rows, receiptsFile } = parseOzonReceiptsBuffer(readFileSync(receiptsFixturePath))

  assert.equal(receiptsFile.receipts.length, 2)
  assert.equal(rows.length, 2)
  assert.equal(rows[0]?.operationCategory, 'Ozon')
  assert.equal(rows[0]?.amount, 1590.5)
  assert.match(rows[0]?.description ?? '', /Кабель USB-C|Чехол/)
})

test('parseOzonReceiptsFile supports splitByItems', () => {
  const receiptsFile = JSON.parse(readFileSync(receiptsFixturePath, 'utf8'))
  receiptsFile.receipts = receiptsFile.receipts.filter(
    (receipt: { totalAmount: number }) => receipt.totalAmount === 1590.5,
  )

  const { rows } = parseOzonReceiptsFile(receiptsFile, { splitByItems: true })
  assert.equal(rows.length, 2)
  assert.equal(rows[0]?.amount, 790.5)
  assert.equal(rows[1]?.amount, 800)
  assert.match(rows[0]?.description ?? '', /Кабель USB-C/)
  assert.match(rows[1]?.description ?? '', /Чехол/)
})

test('buildReceiptDescription formats single and multiple items', () => {
  assert.equal(
    buildReceiptDescription({
      totalAmount: 100,
      date: '2026-01-01T00:00:00.000Z',
      items: [{ name: 'Книга', quantity: 1, price: 100 }],
    }),
    'Чек Ozon: Книга',
  )

  assert.equal(
    buildReceiptDescription({
      totalAmount: 300,
      date: '2026-01-01T00:00:00.000Z',
      items: [
        { name: 'A', quantity: 1, price: 100 },
        { name: 'B', quantity: 1, price: 100 },
        { name: 'C', quantity: 1, price: 100 },
      ],
    }),
    'Чек Ozon: A, B и ещё 1',
  )
})
