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

const RUSSIAN_GENITIVE_MONTHS: Record<string, number> = {
  января: 0,
  февраля: 1,
  марта: 2,
  апреля: 3,
  мая: 4,
  июня: 5,
  июля: 6,
  августа: 7,
  сентября: 8,
  октября: 9,
  ноября: 10,
  декабря: 11,
}

export interface Period {
  from: string
  to: string
}

export interface ParsedPeriod {
  from: Date
  to: Date
  key: string
}

export interface MonthKey {
  year: number
  monthIndex: number
  key: string
}

const DAY_MONTH_YEAR_PATTERN = /^(\d{1,2})-(\d{1,2})-(\d{4})$/

export function formatDayMonthYear(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

export function parseDayMonthYear(value: string): Date | null {
  const match = DAY_MONTH_YEAR_PATTERN.exec(value.trim())
  if (!match) {
    return null
  }

  const day = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const year = Number(match[3])

  if (
    !Number.isInteger(day) ||
    !Number.isInteger(monthIndex) ||
    !Number.isInteger(year) ||
    monthIndex < 0 ||
    monthIndex > 11 ||
    day < 1 ||
    day > 31
  ) {
    return null
  }

  const date = new Date(year, monthIndex, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

export function parsePeriod(period: Period): ParsedPeriod {
  const fromDate = parseDayMonthYear(period.from)
  const toDate = parseDayMonthYear(period.to)

  if (!fromDate || !toDate) {
    throw new Error('Период должен быть в формате ДД-ММ-ГГГГ, например 01-06-2026.')
  }

  if (fromDate.getTime() > toDate.getTime()) {
    throw new Error('Дата начала периода не может быть позже даты конца.')
  }

  return {
    from: startOfDay(fromDate),
    to: endOfDay(toDate),
    key: `${period.from}_${period.to}`,
  }
}

export function getDefaultPeriod(referenceDate = new Date()): Period {
  const currentYear = referenceDate.getFullYear()
  const currentMonthIndex = referenceDate.getMonth()
  const previousMonthIndex = currentMonthIndex === 0 ? 11 : currentMonthIndex - 1
  const previousYear = currentMonthIndex === 0 ? currentYear - 1 : currentYear
  const lastDay = new Date(previousYear, previousMonthIndex + 1, 0).getDate()

  return {
    from: formatDayMonthYear(new Date(previousYear, previousMonthIndex, 1)),
    to: formatDayMonthYear(new Date(previousYear, previousMonthIndex, lastDay)),
  }
}

export function getMonthsInPeriod(period: Period): string[] {
  const parsed = parsePeriod(period)
  const months: string[] = []
  const cursor = new Date(parsed.from.getFullYear(), parsed.from.getMonth(), 1)
  const end = new Date(parsed.to.getFullYear(), parsed.to.getMonth(), 1)

  while (cursor.getTime() <= end.getTime()) {
    const month = String(cursor.getMonth() + 1).padStart(2, '0')
    months.push(`${cursor.getFullYear()}-${month}`)
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return months
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

export function parseRussianReceiptDateText(text: string): Date | null {
  const normalized = text.replace(/\u00a0/g, ' ').trim()
  const match =
    /(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(\d{4})(?:\s+в\s+(\d{1,2}):(\d{2}))?/i.exec(
      normalized,
    )

  if (!match) {
    return null
  }

  return parseRussianReceiptDateMatch(match)
}

function parseRussianReceiptDateMatch(match: RegExpMatchArray): Date | null {
  const day = Number(match[1])
  const monthIndex = RUSSIAN_GENITIVE_MONTHS[match[2]?.toLowerCase() ?? '']
  const year = Number(match[3])
  const hours = match[4] ? Number(match[4]) : 12
  const minutes = match[5] ? Number(match[5]) : 0

  if (monthIndex == null || !Number.isInteger(day) || !Number.isInteger(year)) {
    return null
  }

  const date = new Date(year, monthIndex, day, hours, minutes, 0, 0)
  if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) {
    return null
  }

  return date
}

export function parseDotDateFromText(text: string): Date | null {
  const normalized = text.replace(/\u00a0/g, ' ')

  for (const match of normalized.matchAll(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/g)) {
    const day = Number(match[1])
    const monthIndex = Number(match[2]) - 1
    const year = parseYearToken(match[3] ?? '')

    if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) {
      continue
    }

    const date = new Date(year, monthIndex, day, 12, 0, 0, 0)
    if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) {
      continue
    }

    return date
  }

  return null
}

export function parseReceiptDateFromText(text: string): Date | null {
  return parseRussianReceiptDateText(text) ?? parseDotDateFromText(text)
}

export function isDateInPeriod(date: Date, period: Period): boolean {
  const parsed = parsePeriod(period)
  const timestamp = date.getTime()

  return timestamp >= parsed.from.getTime() && timestamp <= parsed.to.getTime()
}

export function textMatchesPeriod(text: string, period: Period): boolean {
  const parsedDate = parseReceiptDateFromText(text)
  if (parsedDate) {
    return isDateInPeriod(parsedDate, period)
  }

  return false
}

export function receiptMatchesPeriod(receiptDate: string, period: Period): boolean {
  const date = new Date(receiptDate)
  if (Number.isNaN(date.getTime())) {
    return false
  }

  return isDateInPeriod(date, period)
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function parseYearToken(value: string): number {
  const year = Number(value)
  if (value.length === 2) {
    return year >= 70 ? 1900 + year : 2000 + year
  }

  return year
}
