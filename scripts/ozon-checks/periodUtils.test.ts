import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getDefaultPeriod,
  parsePeriod,
  parseReceiptDateFromText,
  parseRussianReceiptDateText,
  receiptMatchesPeriod,
  textMatchesPeriod,
} from './periodUtils.js'

test('parseRussianReceiptDateText parses Ozon row date', () => {
  const date = parseRussianReceiptDateText('30 июня 2026 в 19:15')
  assert.ok(date)
  assert.equal(date.getFullYear(), 2026)
  assert.equal(date.getMonth(), 5)
  assert.equal(date.getDate(), 30)
  assert.equal(date.getHours(), 19)
  assert.equal(date.getMinutes(), 15)
})

test('parseReceiptDateFromText reads date from Ozon row with order number', () => {
  const date = parseReceiptDateFromText('1 июня 2026 в 14:24')
  assert.ok(date)
  assert.equal(date.getDate(), 1)
  assert.equal(date.getMonth(), 5)
})

test('textMatchesPeriod uses receipt row date', () => {
  const period = { from: '01-06-2026', to: '30-06-2026' }

  assert.equal(textMatchesPeriod('30 июня 2026 в 19:15 Скачать', period), true)
  assert.equal(textMatchesPeriod('1 июля 2026 в 10:00 Скачать', period), false)
})

test('receiptMatchesPeriod validates parsed receipt date', () => {
  const period = { from: '01-06-2026', to: '30-06-2026' }

  assert.equal(receiptMatchesPeriod('2026-06-15T10:00:00.000Z', period), true)
  assert.equal(receiptMatchesPeriod('2026-07-01T10:00:00.000Z', period), false)
})

test('getDefaultPeriod returns previous month bounds', () => {
  const period = getDefaultPeriod(new Date(2026, 6, 3))
  assert.equal(period.from, '01-06-2026')
  assert.equal(period.to, '30-06-2026')
})

test('parsePeriod accepts day-month-year input', () => {
  const parsed = parsePeriod({ from: '01-06-2026', to: '30-06-2026' })
  assert.equal(parsed.key, '01-06-2026_30-06-2026')
})

test('parseReceiptDateFromText prefers Russian date over dot date', () => {
  const date = parseReceiptDateFromText('Чек 30 июня 2026 в 19:15, резерв 01.07.2026')
  assert.ok(date)
  assert.equal(date.getDate(), 30)
  assert.equal(date.getMonth(), 5)
})
