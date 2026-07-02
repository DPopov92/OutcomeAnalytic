import { parseExpenseExcel } from './parseExcel.js'
import { parseOzonOrdersBuffer } from './parseOzonOrders.js'
import { parseOzonReceiptsBuffer } from './parseOzonReceipts.js'
import type { OzonExportFile } from './ozonExportTypes.js'
import { isOzonExportFile } from './ozonExportTypes.js'
import type { OzonReceiptsFile } from './ozonReceiptTypes.js'
import { isOzonReceiptsFile } from './ozonReceiptTypes.js'
import type { ParsedExpenseRow } from './parseExcel.js'

export interface ParsedExcelImport {
  rows: ParsedExpenseRow[]
}

export interface ParsedOzonImport {
  rows: ParsedExpenseRow[]
  ozonExport?: OzonExportFile
  ozonReceipts?: OzonReceiptsFile
}

export function parseExcelImportFile(fileBuffer: Buffer): ParsedExcelImport {
  return {
    rows: parseExpenseExcel(fileBuffer),
  }
}

export function parseOzonImportFile(fileBuffer: Buffer): ParsedOzonImport {
  let parsed: unknown

  try {
    parsed = JSON.parse(fileBuffer.toString('utf8'))
  } catch {
    throw new Error('Файл не похож на выгрузку Ozon: некорректный JSON.')
  }

  if (isOzonReceiptsFile(parsed)) {
    const { rows, receiptsFile } = parseOzonReceiptsBuffer(fileBuffer, {
      splitByItems: true,
    })
    return {
      rows,
      ozonReceipts: receiptsFile,
    }
  }

  if (isOzonExportFile(parsed)) {
    const { rows, exportFile } = parseOzonOrdersBuffer(fileBuffer)
    return {
      rows,
      ozonExport: exportFile,
    }
  }

  throw new Error(
    'Файл не похож на выгрузку Ozon. Ожидается JSON с массивом receipts или orders и полем source: "ozon".',
  )
}
