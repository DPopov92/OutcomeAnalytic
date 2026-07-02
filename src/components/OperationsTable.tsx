import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import type { GroupedExpense } from '../types/expense'
import { formatPeriod } from '../types/expense'
import { resolveCategoryColor } from '../utils/categoryColors'
import { CategoryBadge } from './CategoryBadge'

interface OperationsTableProps {
  operations: GroupedExpense[]
  loading?: boolean
  title?: string
  emptyMessage?: string
  categoryColors?: Record<string, string>
}

const amountFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
})

export function OperationsTable({
  operations,
  loading = false,
  title = 'Сохранённые операции',
  emptyMessage = 'Сохранённые операции появятся здесь после подтверждения загрузки файла.',
  categoryColors = {},
}: OperationsTableProps) {
  const total = operations.reduce((sum, operation) => sum + operation.amount, 0)

  if (loading) {
    return null
  }

  if (operations.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">{emptyMessage}</Typography>
      </Box>
    )
  }

  return (
    <Stack spacing={2}>
      <Stack
        spacing={1}
        sx={{
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
        }}
      >
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Всего: <strong>{operations.length}</strong> · Сумма:{' '}
          <strong>{amountFormatter.format(total)}</strong>
        </Typography>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Период</TableCell>
              <TableCell>Категория</TableCell>
              <TableCell align="right">Сумма</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {operations.map((operation) => (
              <TableRow key={operation.id} hover>
                <TableCell>{formatPeriod(operation.month, operation.year)}</TableCell>
                <TableCell>
                  <CategoryBadge
                    name={operation.category}
                    color={resolveCategoryColor(operation.category, categoryColors)}
                  />
                </TableCell>
                <TableCell align="right">{amountFormatter.format(operation.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  )
}
