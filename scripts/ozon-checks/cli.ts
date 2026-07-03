import { downloadOzonReceiptsForPeriod, saveOzonSession } from './download.js'
import { promptPeriod } from './promptPeriod.js'
import { parseDayMonthYear, type Period } from './periodUtils.js'
import type { OzonBrowserChannel } from './browser.js'

interface CliOptions {
  from?: string
  to?: string
  login: boolean
  headed: boolean
  outputPath?: string
  browser?: OzonBrowserChannel
}

function parseBrowser(value: string | undefined): OzonBrowserChannel | undefined {
  if (!value) {
    return undefined
  }

  if (value === 'chrome' || value === 'msedge' || value === 'chromium') {
    return value
  }

  throw new Error('Браузер должен быть chrome, msedge или chromium.')
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    login: false,
    headed: true,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--login') {
      options.login = true
      options.headed = true
      continue
    }

    if (arg === '--headed') {
      options.headed = true
      continue
    }

    if (arg === '--headless') {
      options.headed = false
      continue
    }

    if (arg === '--from') {
      options.from = argv[index + 1]
      index += 1
      continue
    }

    if (arg === '--to') {
      options.to = argv[index + 1]
      index += 1
      continue
    }

    if (arg === '--output') {
      options.outputPath = argv[index + 1]
      index += 1
      continue
    }

    if (arg === '--browser') {
      options.browser = parseBrowser(argv[index + 1])
      index += 1
      continue
    }

    if (arg?.startsWith('--from=')) {
      options.from = arg.slice('--from='.length)
      continue
    }

    if (arg?.startsWith('--to=')) {
      options.to = arg.slice('--to='.length)
      continue
    }

    if (arg?.startsWith('--output=')) {
      options.outputPath = arg.slice('--output='.length)
      continue
    }

    if (arg?.startsWith('--browser=')) {
      options.browser = parseBrowser(arg.slice('--browser='.length))
    }
  }

  return options
}

function printHelp(): void {
  console.log(`Usage:
  npm run ozon:checks:login [-- --browser chrome|msedge|chromium]
  npm run ozon:checks [-- --from ДД-ММ-ГГГГ --to ДД-MM-ГГГГ] [--output path/to/file.json] [--headless] [--browser chrome]

Examples:
  npm run ozon:checks:login
  npm run ozon:checks
  npm run ozon:checks -- --from 01-06-2026 --to 30-06-2026
  npm run ozon:checks -- --from 01-07-2026 --to 31-07-2026 --output ./exports/july.json

Tip:
  Если Ozon не открывается, запускайте команду во внешнем терминале Windows
  (PowerShell / cmd), а не через встроенный терминал IDE.
`)
}

function resolvePeriod(options: CliOptions): Promise<Period> {
  if (options.from && options.to) {
    validatePeriod({ from: options.from, to: options.to })
    return Promise.resolve({ from: options.from, to: options.to })
  }

  if (options.from || options.to) {
    throw new Error('Укажите обе даты периода: --from ДД-ММ-ГГГГ --to ДД-ММ-ГГГГ')
  }

  return promptPeriod()
}

function validatePeriod(period: Period): void {
  const fromDate = parseDayMonthYear(period.from)
  const toDate = parseDayMonthYear(period.to)

  if (!fromDate || !toDate) {
    throw new Error('Даты периода должны быть в формате ДД-ММ-ГГГГ, например 01-06-2026.')
  }

  if (fromDate.getTime() > toDate.getTime()) {
    throw new Error('Дата начала периода не может быть позже даты конца.')
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))

  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp()
    return
  }

  if (options.login) {
    await saveOzonSession({ browser: options.browser })
    return
  }

  const period = await resolvePeriod(options)

  const result = await downloadOzonReceiptsForPeriod({
    period,
    headed: options.headed,
    outputPath: options.outputPath,
    browser: options.browser,
  })

  console.log(`[Ozon Checks] Готово: ${result.receiptsFile.receipts.length} чек(ов)`)
  console.log(`[Ozon Checks] Период: ${period.from} — ${period.to}`)
  console.log(`[Ozon Checks] Файл: ${result.outputPath}`)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[Ozon Checks] Ошибка: ${message}`)
  process.exitCode = 1
})
