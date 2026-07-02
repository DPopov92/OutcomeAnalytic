import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { chromium, type BrowserContext } from 'playwright'

export type OzonBrowserChannel = 'chrome' | 'msedge' | 'chromium'

const SESSION_DIR = join(homedir(), '.outcome-analytic')
const BROWSER_PROFILE_DIR = join(SESSION_DIR, 'browser-profile')

const CONTEXT_OPTIONS = {
  locale: 'ru-RU',
  timezoneId: 'Europe/Moscow',
  viewport: null,
  extraHTTPHeaders: {
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  },
} as const

export function getSessionPaths() {
  return {
    sessionDir: SESSION_DIR,
    browserProfileDir: BROWSER_PROFILE_DIR,
    storageStatePath: join(SESSION_DIR, 'ozon-session.json'),
  }
}

export async function launchOzonContext(options: {
  headed: boolean
  channel?: OzonBrowserChannel
}): Promise<{ context: BrowserContext; channelLabel: string }> {
  await mkdir(BROWSER_PROFILE_DIR, { recursive: true })

  const channels = resolveChannelOrder(options.channel)
  let lastError: unknown

  for (const channel of channels) {
    try {
      const context = await chromium.launchPersistentContext(BROWSER_PROFILE_DIR, {
        ...CONTEXT_OPTIONS,
        headless: !options.headed,
        ...(channel === 'chromium' ? {} : { channel }),
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-first-run',
          '--no-default-browser-check',
        ],
        ignoreDefaultArgs: ['--enable-automation'],
        timeout: 60_000,
      })

      return {
        context,
        channelLabel: channel === 'chromium' ? 'Playwright Chromium' : channel,
      }
    } catch (error) {
      lastError = error
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : 'Не удалось запустить браузер.'
  throw new Error(
    `${message}\n\n` +
      'Установите Google Chrome или Microsoft Edge и повторите команду.\n' +
      'Также можно указать браузер явно: --browser chrome | msedge | chromium',
  )
}

function resolveChannelOrder(preferred?: OzonBrowserChannel): OzonBrowserChannel[] {
  if (preferred) {
    return preferred === 'chromium'
      ? ['chromium', 'chrome', 'msedge']
      : [preferred, preferred === 'chrome' ? 'msedge' : 'chrome', 'chromium']
  }

  return ['chrome', 'msedge', 'chromium']
}

export async function openOzonPage(
  context: BrowserContext,
  url: string,
): Promise<{ page: import('playwright').Page; loaded: boolean }> {
  const page = context.pages()[0] ?? (await context.newPage())

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    return { page, loaded: true }
  } catch {
    await page.goto('about:blank').catch(() => undefined)
    return { page, loaded: false }
  }
}
