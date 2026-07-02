export const RUSSIAN_MONTH_STEMS = [
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
] as const

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
] as const

export interface MonthKey {
  year: number
  monthIndex: number
  key: string
}

export function parseMonthKey(month: string): MonthKey | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month.trim())
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1

  if (!Number.isInteger(year) || monthIndex < 0 || monthIndex > 11) {
    return null
  }

  return { year, monthIndex, key: month }
}

export function buildMonthClickPatterns(month: string): RegExp[] {
  const parsed = parseMonthKey(month)
  if (!parsed) {
    return []
  }

  const { year, monthIndex } = parsed
  const monthNumber = String(monthIndex + 1).padStart(2, '0')
  const stem = RUSSIAN_MONTH_STEMS[monthIndex] ?? ''
  const fullName = RUSSIAN_MONTH_NAMES[monthIndex] ?? ''

  return [
    new RegExp(`${fullName}\\s+${year}`, 'i'),
    new RegExp(`${stem}[a-zа-я]*\\s+${year}`, 'i'),
    new RegExp(`${monthNumber}\\.${year}`, 'i'),
    new RegExp(`${monthNumber}\\s*\\/\\s*${year}`, 'i'),
    new RegExp(`${year}-${monthNumber}`, 'i'),
  ]
}

export function textMatchesMonth(text: string, month: string): boolean {
  const parsed = parseMonthKey(month)
  if (!parsed) {
    return false
  }

  const normalized = text.replace(/\u00a0/g, ' ')

  for (const match of normalized.matchAll(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/g)) {
    const day = Number(match[1])
    const monthNumber = Number(match[2])
    const year = parseYearToken(match[3] ?? '')

    if (
      year === parsed.year &&
      monthNumber - 1 === parsed.monthIndex &&
      day >= 1 &&
      day <= 31
    ) {
      return true
    }
  }

  const stem = RUSSIAN_MONTH_STEMS[parsed.monthIndex] ?? ''
  if (new RegExp(`${stem}[a-zа-я]*\\s*${parsed.year}`, 'i').test(normalized)) {
    return true
  }

  const fullName = RUSSIAN_MONTH_NAMES[parsed.monthIndex] ?? ''
  if (new RegExp(`${fullName}\\s+${parsed.year}`, 'i').test(normalized)) {
    return true
  }

  return false
}

export function receiptMatchesMonth(receiptDate: string, month: string): boolean {
  const parsed = parseMonthKey(month)
  if (!parsed) {
    return true
  }

  const date = new Date(receiptDate)
  if (Number.isNaN(date.getTime())) {
    return false
  }

  return date.getFullYear() === parsed.year && date.getMonth() === parsed.monthIndex
}

function parseYearToken(value: string): number {
  const year = Number(value)
  if (value.length === 2) {
    return year >= 70 ? 1900 + year : 2000 + year
  }

  return year
}
