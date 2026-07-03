import Box from '@mui/material/Box'
import Collapse from '@mui/material/Collapse'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { ChevronDownIcon } from '../assets/icons/ChevronDownIcon'
import type { OzonExportOrder } from '../types/ozon'

interface OzonOrdersPreviewProps {
  orders: OzonExportOrder[]
}

function formatDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatAmount(value: number): string {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function formatStatus(status: string): string {
  const normalized = status.trim().toLowerCase()

  const labels: Record<string, string> = {
    delivered: 'Доставлен',
    cancelled: 'Отменён',
    canceled: 'Отменён',
    awaiting: 'В обработке',
    unknown: 'Неизвестно',
  }

  return labels[normalized] ?? status
}

const expandChevronSx = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  border: 1,
  borderColor: 'divider',
  bgcolor: 'background.paper',
  color: 'text.primary',
  borderRadius: 1,
  boxShadow: 1,
  p: 0.5,
} as const

export function OzonOrdersPreview({ orders }: OzonOrdersPreviewProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Paper variant="outlined" sx={{ mb: 2 }}>
      <Box
        component="button"
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          width: '100%',
          p: 1.5,
          border: 'none',
          bgcolor: 'transparent',
          cursor: 'pointer',
          color: 'text.primary',
          font: 'inherit',
          '&:hover .ozon-orders-expand-chevron': {
            bgcolor: 'action.selected',
            borderColor: 'primary.main',
            color: 'primary.main',
          },
        }}
      >
        <Typography variant="subtitle2">
          Исходные заказы Ozon ({orders.length})
        </Typography>
        <Box className="ozon-orders-expand-chevron" sx={expandChevronSx}>
          <ChevronDownIcon
            size={18}
            strokeWidth={2.5}
            style={{
              transform: expanded ? 'rotate(180deg)' : undefined,
              transition: 'transform 0.2s',
            }}
          />
        </Box>
      </Box>

      <Collapse in={expanded}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Номер</TableCell>
                <TableCell>Дата</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Товаров</TableCell>
                <TableCell align="right">Сумма</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.orderNumber} hover>
                  <TableCell>{order.orderNumber}</TableCell>
                  <TableCell>{formatDate(order.date)}</TableCell>
                  <TableCell>{formatStatus(order.status)}</TableCell>
                  <TableCell>{order.items.length}</TableCell>
                  <TableCell align="right">{formatAmount(order.totalAmount)} ₽</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Collapse>
    </Paper>
  )
}
