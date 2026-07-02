import { downloadOzonReceiptsForMonth, saveOzonSession } from './download.js'
import type { OzonBrowserChannel } from './browser.js'

interface CliOptions {
  month?: string
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

    if (arg === '--month') {
      options.month = argv[index + 1]
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

    if (arg?.startsWith('--month=')) {
      options.month = arg.slice('--month='.length)
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
  npm run ozon:checks -- --month YYYY-MM [--output path/to/file.json] [--headless] [--browser chrome]

Examples:
  npm run ozon:checks:login
  npm run ozon:checks:login -- --browser chrome
  npm run ozon:checks -- --month 2026-03
  npm run ozon:checks -- --month 2026-03 --output ./exports/march.json

Tip:
  Если Ozon не открывается, запускайте команду во внешнем терминале Windows
  (PowerShell / cmd), а не через встроенный терминал IDE.
`)
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

  if (!options.month) {
    printHelp()
    throw new Error('Укажите месяц: --month YYYY-MM')
  }

  const result = await downloadOzonReceiptsForMonth({
    month: options.month,
    headed: options.headed,
    outputPath: options.outputPath,
    browser: options.browser,
  })

  console.log(`[Ozon Checks] Готово: ${result.receiptsFile.receipts.length} чек(ов)`)
  console.log(`[Ozon Checks] Файл: ${result.outputPath}`)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[Ozon Checks] Ошибка: ${message}`)
  process.exitCode = 1
})
