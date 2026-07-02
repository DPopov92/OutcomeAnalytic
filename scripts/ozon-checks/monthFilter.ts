import type { OzonReceipt } from '../../server/src/ozonReceiptTypes.js'

export const RUSSIAN_MONTHS = [
  'январ',
  'феврал',
  'март',
  'апрел',
  'ма',
  'июн',
  'июл',
  'август',
  'сентябр',
  'октябр',
  'ноябр',
  'декабр',
]

export const RUSSIAN_MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

export function parseMonthKey(month: string): { year: number; monthIndex: number } {
  const [yearText, monthText] = month.split('-')
  return {
    year: Number(yearText),
    monthIndex: Number(monthText) - 1,
  }
}

export function buildMonthMatchers(month: string): RegExp[] {
  const { year, monthIndex } = parseMonthKey(month)
  const yearText = String(year)
  const monthText = String(monthIndex + 1).padStart(2, '0')
  const stem = RUSSIAN_MONTHS[monthIndex]
  const fullName = RUSSIAN_MONTH_NAMES[monthIndex]

  if (!stem || !fullName) {
    throw new Error(`Некорректный месяц: ${month}`)
  }

  return [
    new RegExp(`${fullName}\\s+${yearText}`, 'i'),
    new RegExp(`${stem}[a-zа-я]*\\s*${yearText}`, 'i'),
    new RegExp(`${monthText}\\.${yearText}`),
    new RegExp(`${monthText}\\s*\\/\\s*${yearText}`),
    new RegExp(`${yearText}-${monthText}`),
  ]
}

export function textContainsMonthDate(text: string, month: string): boolean {
  const { year, monthIndex } = parseMonthKey(month)
  const normalized = text.replace(/\u00a0/g, ' ')

  for (const match of normalized.matchAll(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/g)) {
    const receiptMonth = Number(match[2])
    const receiptYear = parseYear(match[3] ?? '')

    if (receiptYear === year && receiptMonth - 1 === monthIndex) {
      return true
    }
  }

  return buildMonthMatchers(month).some((pattern) => pattern.test(normalized))
}

export function filterReceiptsByMonth(receipts: OzonReceipt[], month: string): OzonReceipt[] {
  const { year, monthIndex } = parseMonthKey(month)

  return receipts.filter((receipt) => {
    const date = new Date(receipt.date)
    if (Number.isNaN(date.getTime())) {
      return false
    }

    return date.getFullYear() === year && date.getMonth() === monthIndex
  })
}

function parseYear(value: string): number {
  const year = Number(value)
  if (!Number.isFinite(year)) {
    return Number.NaN
  }

  if (year < 100) {
    return year >= 70 ? 1900 + year : 2000 + year
  }

  return year
}
