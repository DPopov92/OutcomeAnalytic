import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { getDefaultPeriod, parseDayMonthYear, type Period } from './periodUtils.js'

export async function promptPeriod(): Promise<Period> {
  const defaults = getDefaultPeriod()
  const rl = createInterface({ input, output })

  try {
    console.log('[Ozon Checks] Укажите период выгрузки (ДД-ММ-ГГГГ). Enter — значение по умолчанию.')

    const fromAnswer = await rl.question(`Дата начала [${defaults.from}]: `)
    const toAnswer = await rl.question(`Дата конца [${defaults.to}]: `)

    const period: Period = {
      from: fromAnswer.trim() || defaults.from,
      to: toAnswer.trim() || defaults.to,
    }

    validatePeriodInput(period)
    return period
  } finally {
    rl.close()
  }
}

function validatePeriodInput(period: Period): void {
  const fromDate = parseDayMonthYear(period.from)
  const toDate = parseDayMonthYear(period.to)

  if (!fromDate || !toDate) {
    throw new Error('Даты периода должны быть в формате ДД-ММ-ГГГГ, например 01-06-2026.')
  }

  if (fromDate.getTime() > toDate.getTime()) {
    throw new Error('Дата начала периода не может быть позже даты конца.')
  }
}
