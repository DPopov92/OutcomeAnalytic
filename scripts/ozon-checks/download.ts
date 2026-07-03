import { readFile } from 'node:fs/promises'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { BrowserContext, Download, Locator, Page, Response } from 'playwright'
import {
  extractPdfTextPreview,
  parseOzonReceiptPdfBufferAsync,
} from '../../server/src/parseOzonReceiptPdf.js'
import type { OzonReceipt, OzonReceiptsFile } from '../../server/src/ozonReceiptTypes.js'
import {
  extractDownloadUrlsFromComposer,
  extractReceiptsFromComposer,
  isDownloadUrl,
  normalizeUrl,
} from './composerParse.js'
import {
  getSessionPaths,
  launchOzonContext,
  openOzonPage,
  type OzonBrowserChannel,
} from './browser.js'
import {
  buildMonthClickPatterns,
  getMonthsInPeriod,
  parsePeriod,
  parseReceiptDateFromText,
  receiptMatchesPeriod,
  textMatchesPeriod,
  type Period,
} from './periodUtils.js'

const E_CHECK_URL = 'https://www.ozon.ru/my/e-check'
const OZON_HOME_URL = 'https://www.ozon.ru/'
const COMPOSER_APIS = [
  'https://www.ozon.ru/api/composer-api.bx/page/json/v2',
  'https://www.ozon.ru/api/entrypoint-api.bx/page/json/v2',
]

export interface DownloadOzonReceiptsOptions {
  period: Period
  headed?: boolean
  outputPath?: string
  browser?: OzonBrowserChannel
}

export interface DownloadOzonReceiptsResult {
  outputPath: string
  receiptsFile: OzonReceiptsFile
}

export interface SaveOzonSessionOptions {
  browser?: OzonBrowserChannel
}

export async function saveOzonSession(options: SaveOzonSessionOptions = {}): Promise<void> {
  const { storageStatePath } = getSessionPaths()
  await mkdir(getSessionPaths().sessionDir, { recursive: true })

  const { context, channelLabel } = await launchOzonContext({
    headed: true,
    channel: options.browser,
  })

  try {
    console.log(`[Ozon Checks] Браузер: ${channelLabel}`)
    console.log('[Ozon Checks] Откройте Ozon и войдите в аккаунт.')
    console.log('[Ozon Checks] После входа перейдите на страницу электронных чеков.')

    const { page, loaded } = await openOzonPage(context, OZON_HOME_URL)

    if (!loaded) {
      console.warn(
        '[Ozon Checks] Автоматически открыть Ozon не удалось.\n' +
          'В открытом окне браузера вручную перейдите на https://www.ozon.ru/my/e-check',
      )
    } else {
      console.log('[Ozon Checks] Открыта главная Ozon. Перейдите в «Электронные чеки», если нужно.')
      await page.goto(E_CHECK_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 }).catch(() => {
        console.warn(
          '[Ozon Checks] Страница чеков не открылась автоматически — перейдите вручную на /my/e-check',
        )
      })
    }

    console.log('[Ozon Checks] Когда увидите список чеков, нажмите Enter в этом терминале…')
    await waitForEnter()

    await context.storageState({ path: storageStatePath })
    console.log(`[Ozon Checks] Сессия сохранена: ${storageStatePath}`)
    console.log(`[Ozon Checks] Профиль браузера: ${getSessionPaths().browserProfileDir}`)
  } finally {
    await context.close()
  }
}

export async function downloadOzonReceiptsForPeriod(
  options: DownloadOzonReceiptsOptions,
): Promise<DownloadOzonReceiptsResult> {
  const parsedPeriod = parsePeriod(options.period)

  const { context, channelLabel } = await launchOzonContext({
    headed: options.headed !== false,
    channel: options.browser,
  })

  console.log(`[Ozon Checks] Браузер: ${channelLabel}`)
  console.log(`[Ozon Checks] Период: ${options.period.from} — ${options.period.to}`)
  console.log('[Ozon Checks] Собираю чеки…')

  try {
    const page = context.pages()[0] ?? (await context.newPage())
    console.log('[Ozon Checks] Открываю страницу электронных чеков…')
    const receipts = await collectReceiptsForPeriod(page, context, options.period)
    console.log(
      `[Ozon Checks] Распознано чеков за ${options.period.from} — ${options.period.to}: ${receipts.length}`,
    )

    if (receipts.length === 0) {
      throw new Error(
        `Не удалось получить чеки за период ${options.period.from} — ${options.period.to}. Убедитесь, что на странице /my/e-check есть чеки за этот период.`,
      )
    }

    const receiptsFile: OzonReceiptsFile = {
      source: 'ozon',
      exportedAt: new Date().toISOString(),
      period: options.period,
      receipts: receipts.sort(
        (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime(),
      ),
    }

    const outputPath =
      options.outputPath ??
      join(process.cwd(), `ozon-receipts-${parsedPeriod.key}.json`)
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, `${JSON.stringify(receiptsFile, null, 2)}\n`, 'utf8')

    return { outputPath, receiptsFile }
  } finally {
    await context.close()
  }
}

async function collectReceiptsForPeriod(
  page: Page,
  context: BrowserContext,
  period: Period,
): Promise<OzonReceipt[]> {
  const composerPayloads: unknown[] = []
  const months = getMonthsInPeriod(period)

  page.on('response', async (response) => {
    if (!isComposerResponse(response.url())) {
      return
    }

    try {
      composerPayloads.push(await response.json())
    } catch {
      // ignore non-json responses
    }
  })

  await gotoOzon(page, E_CHECK_URL)
  await ensureLoggedIn(page)

  for (const month of months) {
    console.log(`[Ozon Checks] Выбираю месяц ${month}…`)
    const monthSelected = await selectMonth(page, month)
    if (!monthSelected) {
      console.warn(`[Ozon Checks] Вкладка месяца ${month} не найдена — фильтрую чеки по дате в строке.`)
    }
    await autoScroll(page)
    await page.waitForTimeout(1_500)
  }

  for (const month of months) {
    for (const payload of await fetchComposerPayloads(page, month)) {
      composerPayloads.push(payload)
    }
  }

  let receipts = filterReceiptsByPeriod(
    dedupeReceipts(
      composerPayloads.flatMap((payload) => extractReceiptsFromComposer(payload)),
    ),
    period,
  )

  if (receipts.length > 0) {
    console.log(`[Ozon Checks] Из API: ${receipts.length} чек(ов)`)
    return receipts
  }

  const downloadUrls = dedupeUrls(
    composerPayloads.flatMap((payload) => extractDownloadUrlsFromComposer(payload)),
  )

  console.log(`[Ozon Checks] Ссылок на PDF: ${downloadUrls.length}`)
  if (downloadUrls.length > 0) {
    receipts = filterReceiptsByPeriod(
      await downloadAndParseReceipts(context, downloadUrls, period),
      period,
    )
    if (receipts.length > 0) {
      return receipts
    }
  }

  console.log('[Ozon Checks] Скачиваю PDF через кнопки на странице…')
  return filterReceiptsByPeriod(await downloadReceiptsViaButtons(page, period), period)
}

async function downloadReceiptsViaButtons(page: Page, period: Period): Promise<OzonReceipt[]> {
  const receipts: OzonReceipt[] = []
  const downloadButtons = page.locator(
    [
      'a[href$=".pdf"]',
      'a[download]',
      'a:has-text("Скачать")',
      'button:has-text("Скачать")',
      '[aria-label*="Скачать" i]',
      '[aria-label*="PDF" i]',
    ].join(', '),
  )

  const count = await downloadButtons.count()
  let matched = 0

  for (let index = 0; index < count; index += 1) {
    const button = downloadButtons.nth(index)
    if (!(await button.isVisible().catch(() => false))) {
      continue
    }

    const rowText = await readReceiptRowText(button)
    const rowDate = parseReceiptDateFromText(rowText)
    if (!textMatchesPeriod(rowText, period)) {
      continue
    }

    matched += 1
    console.log(`[Ozon Checks] Скачивание ${matched} (строка ${index + 1}/${count})`)
    const buffer = await clickAndCapturePdf(page, button)
    if (!buffer) {
      continue
    }

    const receipt = await parseOzonReceiptPdfBufferAsync(buffer)
    if (receipt) {
      if (rowDate) {
        receipt.date = rowDate.toISOString()
      }

      if (receiptMatchesPeriod(receipt.date, period)) {
        receipts.push(receipt)
      } else {
        console.warn(
          `[Ozon Checks] Пропуск чека вне периода ${period.from} — ${period.to}: ${receipt.date}`,
        )
      }
      continue
    }

    const preview = await extractPdfTextPreview(buffer)
    console.warn(`[Ozon Checks] Не удалось распознать PDF. Фрагмент: ${preview}`)
    await sleep(350)
  }

  console.log(
    `[Ozon Checks] Кнопок «Скачать» всего: ${count}, подходит за ${period.from} — ${period.to}: ${matched}`,
  )
  return dedupeReceipts(receipts)
}

async function readReceiptRowText(button: Locator): Promise<string> {
  return button.evaluate((element) => {
    let node: HTMLElement | null = element as HTMLElement

    for (let depth = 0; depth < 10 && node; depth += 1) {
      const text = node.textContent ?? ''
      const normalized = text.replace(/\s+/g, ' ').trim()
      if (/(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+\d{4}/i.test(normalized)) {
        return normalized
      }
      if (normalized.length >= 20) {
        return normalized
      }
      node = node.parentElement
    }

    return (element.textContent ?? '').replace(/\s+/g, ' ').trim()
  })
}

async function clickAndCapturePdf(page: Page, button: Locator): Promise<Buffer | null> {
  const downloadPromise = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null)
  const responsePromise = page
    .waitForResponse((response) => isPdfResponse(response), { timeout: 15_000 })
    .catch(() => null)

  try {
    await button.click({ timeout: 8_000 })
  } catch {
    return null
  }

  const download = await downloadPromise
  if (download) {
    return readDownloadBuffer(download)
  }

  const response = await responsePromise
  if (response) {
    return Buffer.from(await response.body())
  }

  return null
}

async function readDownloadBuffer(download: Download): Promise<Buffer> {
  const savedPath = await download.path().catch(() => null)
  if (savedPath) {
    return readFile(savedPath)
  }

  const stream = await download.createReadStream()
  if (!stream) {
    throw new Error('Не удалось прочитать скачанный PDF.')
  }

  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}

function isPdfResponse(response: Response): boolean {
  const contentType = response.headers()['content-type'] ?? ''
  return (
    response.ok() &&
    (contentType.includes('pdf') ||
      contentType.includes('octet-stream') ||
      response.url().toLowerCase().includes('.pdf'))
  )
}

async function downloadAndParseReceipts(
  context: BrowserContext,
  pdfUrls: string[],
  period: Period,
): Promise<OzonReceipt[]> {
  const receipts: OzonReceipt[] = []

  for (const [index, pdfUrl] of pdfUrls.entries()) {
    console.log(`[Ozon Checks] PDF ${index + 1}/${pdfUrls.length}`)
    const response = await context.request.get(pdfUrl, {
      headers: {
        accept: 'application/pdf,application/octet-stream,*/*',
        referer: E_CHECK_URL,
      },
    })

    if (!response.ok()) {
      console.warn(`[Ozon Checks] Пропуск PDF (${response.status()}): ${pdfUrl}`)
      continue
    }

    const buffer = Buffer.from(await response.body())
    const receipt = await parseOzonReceiptPdfBufferAsync(buffer)
    if (!receipt) {
      const preview = await extractPdfTextPreview(buffer)
      console.warn(`[Ozon Checks] Не удалось распознать PDF: ${pdfUrl}. Фрагмент: ${preview}`)
      continue
    }

    if (receiptMatchesPeriod(receipt.date, period)) {
      receipts.push(receipt)
    }
    await sleep(250)
  }

  return dedupeReceipts(receipts)
}

async function fetchComposerPayloads(page: Page, month: string): Promise<unknown[]> {
  const payloads: unknown[] = []
  const paths = [
    '/my/e-check',
    `/my/e-check?month=${month}`,
    `/my/e-check?selectedMonth=${month}`,
  ]

  for (const apiBase of COMPOSER_APIS) {
    for (const path of paths) {
      const response = await page.request.get(`${apiBase}?url=${encodeURIComponent(path)}`, {
        headers: buildComposerHeaders(),
      })

      if (!response.ok()) {
        continue
      }

      try {
        payloads.push(await response.json())
      } catch {
        // ignore invalid json
      }
    }
  }

  return payloads
}

async function gotoOzon(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForTimeout(2_000)
}

async function ensureLoggedIn(page: Page): Promise<void> {
  const url = page.url()
  if (url.includes('/login') || url.includes('signin')) {
    throw new Error(
      'Требуется авторизация. Запустите npm run ozon:checks:login и войдите в аккаунт Ozon.',
    )
  }
}

async function selectMonth(page: Page, month: string): Promise<boolean> {
  const patterns = buildMonthClickPatterns(month)
  const candidates = [
    ...patterns.flatMap((pattern) => [
      page.getByRole('button', { name: pattern }),
      page.getByRole('tab', { name: pattern }),
      page.locator('button, a, [role="button"], [role="tab"], div, span').filter({ hasText: pattern }),
    ]),
  ]

  for (const candidate of candidates) {
    const element = candidate.first()
    if ((await element.count()) > 0 && (await element.isVisible().catch(() => false))) {
      await element.click({ timeout: 10_000 })
      await page.waitForTimeout(1_500)
      return true
    }
  }

  return false
}

function filterReceiptsByPeriod(receipts: OzonReceipt[], period: Period): OzonReceipt[] {
  const filtered = receipts.filter((receipt) => receiptMatchesPeriod(receipt.date, period))

  if (filtered.length !== receipts.length) {
    console.log(
      `[Ozon Checks] Фильтр ${period.from} — ${period.to}: оставлено ${filtered.length} из ${receipts.length}`,
    )
  }

  return filtered
}

function dedupeReceipts(receipts: OzonReceipt[]): OzonReceipt[] {
  const seen = new Map<string, OzonReceipt>()

  for (const receipt of receipts) {
    const key = `${receipt.date}::${receipt.totalAmount}::${receipt.items
      .map((item) => `${item.name}:${item.quantity}:${item.price}`)
      .join('|')}`
    seen.set(key, receipt)
  }

  return [...seen.values()]
}

function dedupeUrls(urls: string[]): string[] {
  return [...new Set(urls.map((url) => normalizeUrl(url)).filter(isDownloadUrl))]
}

function isComposerResponse(url: string): boolean {
  return url.includes('composer-api.bx/page/json/v2') || url.includes('entrypoint-api.bx/page/json/v2')
}

function buildComposerHeaders(): Record<string, string> {
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    'x-o3-app-name': 'dweb_client',
  }
}

async function autoScroll(page: Page): Promise<void> {
  let previousHeight = 0

  for (let step = 0; step < 8; step += 1) {
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })
    await page.waitForTimeout(700)

    const currentHeight = await page.evaluate(() => document.body.scrollHeight)
    if (currentHeight <= previousHeight) {
      break
    }

    previousHeight = currentHeight
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function waitForEnter(): Promise<void> {
  return new Promise((resolve) => {
    process.stdin.resume()
    process.stdin.once('data', () => {
      process.stdin.pause()
      resolve()
    })
  })
}
