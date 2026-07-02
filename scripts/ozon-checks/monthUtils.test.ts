import assert from 'node:assert/strict'
import test from 'node:test'
import { receiptMatchesMonth, textMatchesMonth } from './monthUtils.js'

test('textMatchesMonth detects dd.mm.yyyy in receipt row', () => {
  assert.equal(textMatchesMonth('Заказ от 15.06.2026, сумма 1200 ₽', '2026-06'), true)
  assert.equal(textMatchesMonth('Заказ от 15.05.2026, сумма 1200 ₽', '2026-06'), false)
})

test('receiptMatchesMonth validates parsed receipt date', () => {
  assert.equal(receiptMatchesMonth('2026-06-15T10:00:00.000Z', '2026-06'), true)
  assert.equal(receiptMatchesMonth('2026-05-15T10:00:00.000Z', '2026-06'), false)
})
