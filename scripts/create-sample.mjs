import * as XLSX from 'xlsx'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const data = [
  ['Дата', 'Категория операции', 'Сумма', 'Описание'],
  ['01 июн. 2026, 13:53', 'Продукты', 2450.5, 'Супермаркет'],
  ['03 июн. 2026, 09:15', 'Транспорт', 890, 'Такси до офиса'],
  ['05 июн. 2026, 19:40', 'Развлечения', 3200, 'Кино и ужин'],
  ['08 июн. 2026, 11:00', 'Коммунальные', 5670.25, 'Электричество и вода'],
  ['12 июн. 2026, 08:30', 'Здоровье', 1500, 'Аптека'],
]

const sheet = XLSX.utils.aoa_to_sheet(data)
const workbook = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(workbook, sheet, 'Расходы')

const outputPath = join(process.cwd(), 'sample-expenses.xlsx')
writeFileSync(outputPath, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
console.log(`Sample file created: ${outputPath}`)
