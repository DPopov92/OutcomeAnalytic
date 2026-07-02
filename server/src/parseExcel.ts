import * as XLSX from 'xlsx'

export const REQUIRED_COLUMNS = [
  'Дата',
  'Категория операции',
  'Сумма',
  'Описание',
] as const

export interface ParsedExpenseRow {
  date: Date
  operationCategory: string
  amount: number
  description: string
}

const COLUMN_ALIASES: Record<(typeof REQUIRED_COLUMNS)[number], string[]> = {
  Дата: ['дата', 'date'],
  'Категория операции': ['категория операции', 'категория', 'category'],
  Сумма: ['сумма', 'amount'],
  Описание: ['описание', 'description'],
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function findColumnIndex(
  headers: string[],
  columnName: (typeof REQUIRED_COLUMNS)[number],
): number {
  const aliases = COLUMN_ALIASES[columnName]
  return headers.findIndex((header) => aliases.includes(header))
}

const RUSSIAN_MONTHS: Record<string, number> = {
  янв: 0,
  январ: 0,
  января: 0,
  январь: 0,
  фев: 1,
  февр: 1,
  февраля: 1,
  февраль: 1,
  мар: 2,
  марта: 2,
  март: 2,
  апр: 3,
  апреля: 3,
  апрель: 3,
  май: 4,
  мая: 4,
  июн: 5,
  июня: 5,
  июл: 6,
  июля: 6,
  авг: 7,
  августа: 7,
  август: 7,
  сен: 8,
  сент: 8,
  сентября: 8,
  сентябрь: 8,
  окт: 9,
  октября: 9,
  октябрь: 9,
  ноя: 10,
  нояб: 10,
  ноября: 10,
  ноябрь: 10,
  дек: 11,
  декабря: 11,
  декабрь: 11,
}

function normalizeRussianMonth(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, '')
}

function resolveRussianMonth(value: string): number | null {
  const normalized = normalizeRussianMonth(value)

  if (normalized in RUSSIAN_MONTHS) {
    return RUSSIAN_MONTHS[normalized]
  }

  const prefixMatch = Object.entries(RUSSIAN_MONTHS).find(([key]) =>
    normalized.startsWith(key),
  )

  return prefixMatch ? prefixMatch[1] : null
}

function parseRussianDateString(value: string): Date | null {
  const trimmed = value.trim()

  const russianMatch = trimmed.match(
    /^(\d{1,2})\s+([а-яёa-z]+\.?)\s+(\d{4})(?:,?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/i,
  )

  if (russianMatch) {
    const [, dayRaw, monthRaw, yearRaw, hoursRaw, minutesRaw, secondsRaw] =
      russianMatch
    const month = resolveRussianMonth(monthRaw)

    if (month !== null) {
      const date = new Date(
        Number(yearRaw),
        month,
        Number(dayRaw),
        hoursRaw ? Number(hoursRaw) : 0,
        minutesRaw ? Number(minutesRaw) : 0,
        secondsRaw ? Number(secondsRaw) : 0,
      )

      if (!Number.isNaN(date.getTime())) {
        return date
      }
    }
  }

  return null
}

function parseNumericDateString(value: string): Date | null {
  const parts = value.trim().split(/[./-]/)
  if (parts.length === 3) {
    const [day, month, year] = parts.map(Number)
    if (day && month && year) {
      const fullYear = year < 100 ? 2000 + year : year
      const date = new Date(fullYear, month - 1, day)
      if (!Number.isNaN(date.getTime())) {
        return date
      }
    }
  }

  return null
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) {
      return new Date(
        parsed.y,
        parsed.m - 1,
        parsed.d,
        parsed.H,
        parsed.M,
        Math.floor(parsed.S),
      )
    }
  }

  if (typeof value === 'string' && value.trim()) {
    const russianDate = parseRussianDateString(value)
    if (russianDate) {
      return russianDate
    }

    const numericDate = parseNumericDateString(value)
    if (numericDate) {
      return numericDate
    }

    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return null
}

function parseAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/\s/g, '').replace(',', '.')
    const parsed = Number.parseFloat(normalized)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function isEmptyRow(row: unknown[]): boolean {
  return row.every(
    (cell) => cell === undefined || cell === null || String(cell).trim() === '',
  )
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseExpenseExcel(file: Buffer | ArrayBuffer): ParsedExpenseRow[] {
  const buffer =
    file instanceof Buffer
      ? file
      : Buffer.from(file instanceof ArrayBuffer ? new Uint8Array(file) : file)
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = workbook.SheetNames[0]

  if (!sheetName) {
    throw new Error('Файл не содержит листов с данными.')
  }

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  })

  if (rows.length < 2) {
    throw new Error('Файл должен содержать заголовок и хотя бы одну операцию.')
  }

  const headerRow = rows[0].map(normalizeHeader)
  const columnIndexes = Object.fromEntries(
    REQUIRED_COLUMNS.map((column) => [column, findColumnIndex(headerRow, column)]),
  ) as Record<(typeof REQUIRED_COLUMNS)[number], number>

  const missingColumns = REQUIRED_COLUMNS.filter(
    (column) => columnIndexes[column] === -1,
  )

  if (missingColumns.length > 0) {
    throw new Error(
      `Не найдены обязательные колонки: ${missingColumns.join(', ')}. ` +
        `Ожидаются: ${REQUIRED_COLUMNS.join(', ')}.`,
    )
  }

  const operations: ParsedExpenseRow[] = []

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]
    if (!Array.isArray(row) || isEmptyRow(row)) {
      continue
    }

    const date = parseDate(row[columnIndexes['Дата']])
    const operationCategory = String(
      row[columnIndexes['Категория операции']] ?? '',
    ).trim()
    const amount = parseAmount(row[columnIndexes['Сумма']])
    const description = String(row[columnIndexes['Описание']] ?? '').trim()

    if (!date) {
      throw new Error(`Строка ${rowIndex + 1}: некорректная дата.`)
    }

    if (!operationCategory) {
      throw new Error(`Строка ${rowIndex + 1}: категория операции не указана.`)
    }

    if (amount === null) {
      throw new Error(`Строка ${rowIndex + 1}: некорректная сумма.`)
    }

    operations.push({
      date,
      operationCategory,
      amount,
      description,
    })
  }

  if (operations.length === 0) {
    throw new Error('В файле не найдено ни одной операции.')
  }

  return operations.sort((a, b) => b.date.getTime() - a.date.getTime())
}
