import assert from 'node:assert/strict'
import test from 'node:test'
import {
  extractDownloadUrlsFromComposer,
  extractReceiptsFromComposer,
  isDownloadUrl,
} from './composerParse.js'

test('isDownloadUrl rejects ozon cheques page routes', () => {
  assert.equal(isDownloadUrl('https://www.ozon.ru/cheques'), false)
  assert.equal(isDownloadUrl('https://www.ozon.ru/cheques-527070-e-check-desktop-2'), false)
  assert.equal(isDownloadUrl('https://www.ozon.ru/files/receipt-123.pdf'), true)
  assert.equal(isDownloadUrl('https://consumer.1-ofd.ru/v1/receipt/abc/pdf'), true)
})

test('extractReceiptsFromComposer parses receipt objects', () => {
  const payload = {
    widgetStates: {
      'e-check-1': JSON.stringify({
        cheques: [
          {
            createdAt: '2026-06-15T12:00:00+03:00',
            totalPrice: 249900,
            products: [
              { title: 'Наушники XYZ', quantity: 1, price: 249900 },
            ],
          },
        ],
      }),
    },
  }

  const receipts = extractReceiptsFromComposer(payload)
  assert.equal(receipts.length, 1)
  assert.equal(receipts[0]?.totalAmount, 2499)
  assert.equal(receipts[0]?.items[0]?.name, 'Наушники XYZ')
  assert.equal(receipts[0]?.items[0]?.quantity, 1)
  assert.equal(receipts[0]?.items[0]?.price, 2499)
})

test('extractReceiptsFromComposer derives unit price from line total', () => {
  const payload = {
    cheques: [
      {
        createdAt: '2026-06-20T10:15:00+03:00',
        totalPrice: 159050,
        products: [
          { title: 'Кабель USB-C 2м', quantity: 2, totalPrice: 79050 },
          { title: 'Чехол для телефона', quantity: 1, price: 80000 },
        ],
      },
    ],
  }

  const receipts = extractReceiptsFromComposer(payload)
  assert.equal(receipts.length, 1)
  assert.equal(receipts[0]?.totalAmount, 1590.5)
  assert.equal(receipts[0]?.items[0]?.quantity, 2)
  assert.equal(receipts[0]?.items[0]?.price, 395.25)
  assert.equal(receipts[0]?.items[1]?.quantity, 1)
  assert.equal(receipts[0]?.items[1]?.price, 800)
})

test('extractDownloadUrlsFromComposer keeps only real download links', () => {
  const payload = {
    cheques: [
      { downloadUrl: 'https://www.ozon.ru/cheques' },
      { pdfUrl: 'https://www.ozon.ru/api/receipt/download/abc.pdf' },
    ],
  }

  const urls = extractDownloadUrlsFromComposer(payload)
  assert.equal(urls.length, 1)
  assert.match(urls[0] ?? '', /abc\.pdf/)
})
