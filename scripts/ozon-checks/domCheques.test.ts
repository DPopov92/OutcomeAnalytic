import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  extractOrderNumberFromRowText,
  extractReceiptDateText,
  monthOverlapsPeriod,
  parseChequesWidgetsHtml,
  parseMonthTitleText,
  parseReceiptRowDate,
} from './domCheques.js'

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'cheques-widget.html')

test('parseMonthTitleText parses Russian month titles', () => {
  assert.deepEqual(parseMonthTitleText('Июнь 2026'), {
    year: 2026,
    monthIndex: 5,
    key: '2026-06',
  })
  assert.deepEqual(parseMonthTitleText('май 2026'), {
    year: 2026,
    monthIndex: 4,
    key: '2026-05',
  })
  assert.equal(parseMonthTitleText('не месяц'), null)
})

test('monthOverlapsPeriod includes only months intersecting the period', () => {
  const period = { from: '01-06-2026', to: '30-06-2026' }
  const june = parseMonthTitleText('Июнь 2026')
  const may = parseMonthTitleText('Май 2026')
  const july = parseMonthTitleText('Июль 2026')

  assert.ok(june)
  assert.ok(may)
  assert.ok(july)
  assert.equal(monthOverlapsPeriod(june, period), true)
  assert.equal(monthOverlapsPeriod(may, period), false)
  assert.equal(monthOverlapsPeriod(july, period), false)
})

test('parseChequesWidgetsHtml extracts June receipts from fixture', async () => {
  const html = await readFile(fixturePath, 'utf8')
  const period = { from: '01-06-2026', to: '30-06-2026' }
  const rows = parseChequesWidgetsHtml(html, period)

  assert.equal(rows.length, 31)
  assert.equal(rows[0]?.monthTitle, 'Июнь 2026')
  assert.match(rows[0]?.rowText ?? '', /30 июня 2026/)
})

test('extractOrderNumberFromRowText parses Ozon order id', () => {
  assert.equal(
    extractOrderNumberFromRowText('Заказ №36246682-0288 30 июня 2026 в 19:15'),
    '36246682-0288',
  )
  assert.equal(
    extractOrderNumberFromRowText('/my/orderdetails/?order=36246682-0291'),
    '36246682-0291',
  )
})

test('extractReceiptDateText pulls date from Ozon span text', () => {
  assert.equal(extractReceiptDateText('1 июня 2026 в 14:24'), '1 июня 2026 в 14:24')
  assert.equal(parseReceiptRowDate('1 июня 2026 в 14:24')?.getDate(), 1)
})

test('parseChequesWidgetsHtml ignores months outside the period', async () => {
  const html = await readFile(fixturePath, 'utf8')
  const period = { from: '01-07-2026', to: '31-07-2026' }
  const rows = parseChequesWidgetsHtml(html, period)

  assert.equal(rows.length, 2)
  assert.equal(rows[0]?.monthTitle, 'Июль 2026')
})
