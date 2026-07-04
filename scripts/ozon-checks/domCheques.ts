import type { Locator, Page } from 'playwright'
import {
  isDateInPeriod,
  parsePeriod,
  parseReceiptDateFromText,
  RUSSIAN_MONTH_NAMES,
  RUSSIAN_MONTH_STEMS,
  type MonthKey,
  type Period,
} from './periodUtils.js'

const CHEQUES_WIDGET_SELECTOR = '[data-widget="cheques"]'
const RECEIPT_DATE_IN_ROW_PATTERN =
  /(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(\d{4})\s+в\s+(\d{1,2}):(\d{2})/i
const MONTH_TITLE_SELECTOR = ':scope > h3, :scope > div:first-child'
const RECEIPT_LIST_SELECTOR = ':scope > ul > li'
const DOWNLOAD_BUTTON_SELECTOR =
  'button:has-text("Скачать"), a:has-text("Скачать"), a[download], a[href$=".pdf"]'

export interface ReceiptDownloadTarget {
  rowText: string
  date: Date
  dateLabel: string
  orderNumber: string | null
  button: Locator
}

export interface ParsedReceiptRow {
  rowText: string
  date: Date | null
  monthTitle: string
}

export function parseMonthTitleText(text: string): MonthKey | null {
  const normalized = text.replace(/\u00a0/g, ' ').trim()
  if (!normalized) {
    return null
  }

  for (let monthIndex = 0; monthIndex < RUSSIAN_MONTH_NAMES.length; monthIndex += 1) {
    const fullName = RUSSIAN_MONTH_NAMES[monthIndex] ?? ''
    const fullMatch = new RegExp(`^${fullName}\\s+(\\d{4})$`, 'i').exec(normalized)
    if (fullMatch) {
      const year = Number(fullMatch[1])
      return buildMonthKey(year, monthIndex)
    }
  }

  for (let monthIndex = 0; monthIndex < RUSSIAN_MONTH_STEMS.length; monthIndex += 1) {
    const stem = RUSSIAN_MONTH_STEMS[monthIndex] ?? ''
    const stemMatch = new RegExp(`^${stem}[а-яё]*\\s+(\\d{4})$`, 'i').exec(normalized)
    if (stemMatch) {
      const year = Number(stemMatch[1])
      return buildMonthKey(year, monthIndex)
    }
  }

  const dotMatch = /^(\d{1,2})\.(\d{4})$/.exec(normalized)
  if (dotMatch) {
    const monthIndex = Number(dotMatch[1]) - 1
    const year = Number(dotMatch[2])
    if (monthIndex >= 0 && monthIndex <= 11) {
      return buildMonthKey(year, monthIndex)
    }
  }

  return null
}

export function monthOverlapsPeriod(month: MonthKey, period: Period): boolean {
  const parsed = parsePeriod(period)
  const monthStart = new Date(month.year, month.monthIndex, 1, 0, 0, 0, 0)
  const monthEnd = new Date(month.year, month.monthIndex + 1, 0, 23, 59, 59, 999)

  return monthStart.getTime() <= parsed.to.getTime() && monthEnd.getTime() >= parsed.from.getTime()
}

export function extractReceiptDateText(value: string): string | null {
  const normalized = value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
  const match = RECEIPT_DATE_IN_ROW_PATTERN.exec(normalized)
  return match ? match[0] : null
}

export function parseReceiptRowDate(text: string): Date | null {
  const dateText = extractReceiptDateText(text)
  if (dateText) {
    return parseReceiptDateFromText(dateText)
  }

  return parseReceiptDateFromText(text)
}

async function readReceiptDateText(row: Locator): Promise<string> {
  const dateText = await row.evaluate((element) => {
    for (const node of element.querySelectorAll('span, time, div')) {
      const text = (node.textContent ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
      if (/(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(\d{4})\s+в\s+(\d{1,2}):(\d{2})/i.test(text)) {
        return text
      }
    }

    return (element.textContent ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
  })

  return dateText
}

export function extractOrderNumberFromRowText(text: string): string | null {
  const normalized = text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
  const labeledMatch = /Заказ\s*№\s*(\d+-\d+)/i.exec(normalized)
  if (labeledMatch?.[1]) {
    return labeledMatch[1]
  }

  const hrefMatch = /[?&]order=(\d+-\d+)/i.exec(normalized)
  if (hrefMatch?.[1]) {
    return hrefMatch[1]
  }

  return null
}

async function readOrderNumber(row: Locator, rowText: string): Promise<string | null> {
  const orderHref = await row
    .locator('a[href*="order="]')
    .first()
    .getAttribute('href')
    .catch(() => null)

  if (orderHref) {
    const hrefMatch = /[?&]order=([^&]+)/i.exec(orderHref)
    if (hrefMatch?.[1]) {
      return hrefMatch[1]
    }
  }

  return extractOrderNumberFromRowText(rowText)
}

export function formatReceiptDateLabel(date: Date): string {
  const day = date.getDate()
  const monthName = RUSSIAN_MONTH_NAMES[date.getMonth()]?.toLowerCase() ?? ''
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${day} ${monthName} ${year} в ${hours}:${minutes}`
}

export function buildReceiptTargetKey(rowText: string, date: Date): string {
  return `${date.toISOString()}::${rowText.replace(/\s+/g, ' ').trim()}`
}

export function parseChequesWidgetsHtml(html: string, period: Period): ParsedReceiptRow[] {
  const rows: ParsedReceiptRow[] = []
  const widgetPattern =
    /<div[^>]*data-widget="cheques"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>[\s\S]*?<ul>([\s\S]*?)<\/ul>/gi

  for (const widgetMatch of html.matchAll(widgetPattern)) {
    const monthTitle = (widgetMatch[1] ?? '').replace(/\u00a0/g, ' ').trim()
    const monthKey = parseMonthTitleText(monthTitle)
    if (!monthKey || !monthOverlapsPeriod(monthKey, period)) {
      continue
    }

    const listHtml = widgetMatch[2] ?? ''
    const rowPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi

    for (const rowMatch of listHtml.matchAll(rowPattern)) {
      const rowHtml = rowMatch[1] ?? ''
      const rowText = rowHtml
        .replace(/<[^>]+>/g, ' ')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      const dateSource = extractDateSourceFromRowHtml(rowHtml) ?? rowText
      const date = parseReceiptRowDate(dateSource)

      if (!date || !isDateInPeriod(date, period)) {
        continue
      }

      rows.push({ rowText, date, monthTitle })
    }
  }

  return rows
}

export async function waitForChequesWidget(page: Page): Promise<Locator> {
  const widget = page.locator(CHEQUES_WIDGET_SELECTOR).first()
  await widget.waitFor({ state: 'visible', timeout: 30_000 })
  return widget
}

const MIN_PAGE_SCROLL_STEPS = 12

export async function scrollChequesWidget(page: Page, period?: Period): Promise<void> {
  for (let step = 0; step < MIN_PAGE_SCROLL_STEPS; step += 1) {
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })
    await page.waitForTimeout(700)
  }

  let previousWidgetCount = 0
  let previousPeriodRowCount = 0
  let stableSteps = 0

  for (let step = 0; step < 18; step += 1) {
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })
    await page.waitForTimeout(700)

    const widgetCount = await page.locator(CHEQUES_WIDGET_SELECTOR).count()
    const periodRowCount = period ? await countPeriodReceiptRows(page, period) : 0
    const widgetCountStable = widgetCount > 0 && widgetCount === previousWidgetCount
    const periodRowsStable = !period || (periodRowCount > 0 && periodRowCount === previousPeriodRowCount)

    if (widgetCountStable && periodRowsStable) {
      stableSteps += 1
      if (stableSteps >= 3) {
        break
      }
    } else {
      stableSteps = 0
    }

    previousWidgetCount = widgetCount
    previousPeriodRowCount = periodRowCount
  }

  if (!period) {
    return
  }

  const widgets = page.locator(CHEQUES_WIDGET_SELECTOR)
  const widgetCount = await widgets.count()

  for (let widgetIndex = 0; widgetIndex < widgetCount; widgetIndex += 1) {
    const widget = widgets.nth(widgetIndex)
    const monthTitle = ((await widget.locator(MONTH_TITLE_SELECTOR).first().textContent()) ?? '')
      .replace(/\u00a0/g, ' ')
      .trim()
    const monthKey = parseMonthTitleText(monthTitle)

    if (!monthKey || !monthOverlapsPeriod(monthKey, period)) {
      continue
    }

    await widget.scrollIntoViewIfNeeded().catch(() => undefined)
    await expandMonthReceiptList(page, widget)
  }
}

export async function logChequesWidgetStats(page: Page, period: Period): Promise<void> {
  const widgets = page.locator(CHEQUES_WIDGET_SELECTOR)
  const widgetCount = await widgets.count()

  for (let widgetIndex = 0; widgetIndex < widgetCount; widgetIndex += 1) {
    const widget = widgets.nth(widgetIndex)
    const monthTitle = ((await widget.locator(MONTH_TITLE_SELECTOR).first().textContent()) ?? '')
      .replace(/\u00a0/g, ' ')
      .trim()
    const monthKey = parseMonthTitleText(monthTitle)

    if (!monthKey || !monthOverlapsPeriod(monthKey, period)) {
      continue
    }

    const rows = widget.locator(RECEIPT_LIST_SELECTOR)
    const rowCount = await rows.count()
    let datedRows = 0
    let buttonRows = 0

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const row = rows.nth(rowIndex)
      const rowText = ((await row.textContent()) ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
      const dateText = await readReceiptDateText(row)
      const date = parseReceiptRowDate(dateText)
      if (date && isDateInPeriod(date, period)) {
        datedRows += 1
        if ((await row.locator(DOWNLOAD_BUTTON_SELECTOR).count()) > 0) {
          buttonRows += 1
        }
      }
    }

    console.log(
      `[Ozon Checks] Месяц ${monthTitle}: строк ${rowCount}, в периоде ${datedRows}, с кнопкой ${buttonRows}`,
    )
  }
}

async function countPeriodReceiptRows(page: Page, period: Period): Promise<number> {
  const widgets = page.locator(CHEQUES_WIDGET_SELECTOR)
  const widgetCount = await widgets.count()
  let total = 0

  for (let widgetIndex = 0; widgetIndex < widgetCount; widgetIndex += 1) {
    const widget = widgets.nth(widgetIndex)
    const monthTitle = ((await widget.locator(MONTH_TITLE_SELECTOR).first().textContent()) ?? '')
      .replace(/\u00a0/g, ' ')
      .trim()
    const monthKey = parseMonthTitleText(monthTitle)

    if (!monthKey || !monthOverlapsPeriod(monthKey, period)) {
      continue
    }

    const rows = widget.locator(RECEIPT_LIST_SELECTOR)
    const rowCount = await rows.count()

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const rowText = ((await rows.nth(rowIndex).textContent()) ?? '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      const dateText = await readReceiptDateText(rows.nth(rowIndex))
      const date = parseReceiptRowDate(dateText)
      if (date && isDateInPeriod(date, period)) {
        total += 1
      }
    }
  }

  return total
}

async function expandMonthReceiptList(page: Page, widget: Locator): Promise<void> {
  const rows = widget.locator(RECEIPT_LIST_SELECTOR)
  let previousRowCount = 0

  for (let step = 0; step < 20; step += 1) {
    const rowCount = await rows.count()
    if (rowCount > 0) {
      await rows.nth(rowCount - 1).scrollIntoViewIfNeeded().catch(() => undefined)
      await page.waitForTimeout(400)
    }

    const nextRowCount = await rows.count()
    if (nextRowCount > 0 && nextRowCount === previousRowCount) {
      break
    }

    previousRowCount = nextRowCount
  }
}

export function dedupeTargetsByOrderNumber<T extends { orderNumber: string | null }>(
  targets: T[],
): { targets: T[]; skipped: number } {
  const seenOrderNumbers = new Set<string>()
  const kept: T[] = []
  let skipped = 0

  for (const target of targets) {
    if (target.orderNumber && seenOrderNumbers.has(target.orderNumber)) {
      skipped += 1
      continue
    }

    if (target.orderNumber) {
      seenOrderNumbers.add(target.orderNumber)
    }

    kept.push(target)
  }

  return { targets: kept, skipped }
}

export async function collectReceiptDownloadTargets(
  page: Page,
  period: Period,
): Promise<ReceiptDownloadTarget[]> {
  const widgets = page.locator(CHEQUES_WIDGET_SELECTOR)
  const widgetCount = await widgets.count()
  const targets: ReceiptDownloadTarget[] = []
  const seen = new Set<string>()

  for (let widgetIndex = 0; widgetIndex < widgetCount; widgetIndex += 1) {
    const widget = widgets.nth(widgetIndex)
    const monthTitle = ((await widget.locator(MONTH_TITLE_SELECTOR).first().textContent()) ?? '')
      .replace(/\u00a0/g, ' ')
      .trim()
    const monthKey = parseMonthTitleText(monthTitle)

    if (!monthKey || !monthOverlapsPeriod(monthKey, period)) {
      continue
    }

    const rows = widget.locator(RECEIPT_LIST_SELECTOR)
    const rowCount = await rows.count()

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const row = rows.nth(rowIndex)
      await row.scrollIntoViewIfNeeded().catch(() => undefined)
      const rowText = ((await row.textContent()) ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
      const dateText = await readReceiptDateText(row)
      const date = parseReceiptRowDate(dateText)
      const orderNumber = await readOrderNumber(row, rowText)

      if (!date || !isDateInPeriod(date, period)) {
        continue
      }

      const button = row.locator(DOWNLOAD_BUTTON_SELECTOR).first()
      if ((await button.count()) === 0) {
        continue
      }

      const dedupeKey = buildReceiptTargetKey(rowText, date)
      if (seen.has(dedupeKey)) {
        continue
      }

      seen.add(dedupeKey)
      targets.push({
        rowText,
        date,
        dateLabel: formatReceiptDateLabel(date),
        orderNumber,
        button,
      })
    }
  }

  const { targets: uniqueTargets, skipped: skippedDuplicateOrders } =
    dedupeTargetsByOrderNumber(targets)

  if (skippedDuplicateOrders > 0) {
    console.log(
      `[Ozon Checks] Пропущено чеков с повторным номером заказа: ${skippedDuplicateOrders}`,
    )
  }

  return uniqueTargets
}

function extractDateSourceFromRowHtml(rowHtml: string): string | null {
  for (const match of rowHtml.matchAll(/<span[^>]*>([^<]*)<\/span>/gi)) {
    const text = (match[1] ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
    if (extractReceiptDateText(text)) {
      return text
    }
  }

  return null
}

function buildMonthKey(year: number, monthIndex: number): MonthKey | null {
  if (!Number.isInteger(year) || monthIndex < 0 || monthIndex > 11) {
    return null
  }

  const month = String(monthIndex + 1).padStart(2, '0')
  return { year, monthIndex, key: `${year}-${month}` }
}
