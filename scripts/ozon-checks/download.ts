import { readFile } from 'node:fs/promises'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Download, Locator, Page, Response } from 'playwright'
import {
  extractPdfTextPreview,
  parseOzonReceiptPdfBufferAsync,
} from '../../server/src/parseOzonReceiptPdf.js'
import type { OzonReceipt, OzonReceiptsFile } from '../../server/src/ozonReceiptTypes.js'
import {
  getSessionPaths,
  launchOzonContext,
  openOzonPage,
  type OzonBrowserChannel,
} from './browser.js'
import {
  collectReceiptDownloadTargets,
  logChequesWidgetStats,
  scrollChequesWidget,
  waitForChequesWidget,
  type ReceiptDownloadTarget,
} from './domCheques.js'
import { parsePeriod, receiptMatchesPeriod, type Period } from './periodUtils.js'

const E_CHECK_URL = 'https://www.ozon.ru/my/e-check'
const OZON_HOME_URL = 'https://www.ozon.ru/'

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
    const receipts = await collectReceiptsForPeriod(page, options.period)
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
      options.outputPath ?? join(process.cwd(), `ozon-receipts-${parsedPeriod.key}.json`)
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, `${JSON.stringify(receiptsFile, null, 2)}\n`, 'utf8')

    return { outputPath, receiptsFile }
  } finally {
    await context.close()
  }
}

async function collectReceiptsForPeriod(page: Page, period: Period): Promise<OzonReceipt[]> {
  await gotoOzon(page, E_CHECK_URL)
  await ensureLoggedIn(page)
  await page.waitForTimeout(2_000)

  await waitForChequesWidget(page)
  await scrollChequesWidget(page, period)
  await logChequesWidgetStats(page, period)

  const targets = await collectReceiptDownloadTargets(page, period)
  console.log(
    `[Ozon Checks] Найдено чеков в DOM за ${period.from} — ${period.to}: ${targets.length}`,
  )

  if (targets.length === 0) {
    throw new Error(
      `Виджет [data-widget="cheques"] найден, но чеки за период ${period.from} — ${period.to} не обнаружены. Проверьте период или выполните npm run ozon:checks:login.`,
    )
  }

  return filterReceiptsByPeriod(await downloadReceiptsFromTargets(page, targets, period), period)
}

async function downloadReceiptsFromTargets(
  page: Page,
  targets: ReceiptDownloadTarget[],
  period: Period,
): Promise<OzonReceipt[]> {
  const receipts: OzonReceipt[] = []

  for (const [index, target] of targets.entries()) {
    const orderLabel = target.orderNumber ? `заказ ${target.orderNumber}, ` : ''
    console.log(
      `[Ozon Checks] Скачивание ${index + 1}/${targets.length}, ${orderLabel}${target.dateLabel}`,
    )

    const buffer = await clickAndCapturePdf(page, target.button)
    if (!buffer) {
      console.warn(`[Ozon Checks] Не удалось скачать PDF: ${target.dateLabel}`)
      continue
    }

    const receipt = await parseOzonReceiptPdfBufferAsync(buffer)
    if (receipt) {
      receipt.date = target.date.toISOString()

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

  return dedupeReceipts(receipts)
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
