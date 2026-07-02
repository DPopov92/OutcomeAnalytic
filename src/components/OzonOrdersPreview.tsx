import { useState } from 'react'
import { ChevronDownIcon } from '../assets/icons/ChevronDownIcon'
import type { OzonExportOrder } from '../types/ozon'
import './OzonOrdersPreview.css'

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

export function OzonOrdersPreview({ orders }: OzonOrdersPreviewProps) {
  const [expanded, setExpanded] = useState(true)

  return (
    <section className="ozon-orders-preview">
      <button
        type="button"
        className="ozon-orders-preview-toggle"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
      >
        <span>Исходные заказы Ozon ({orders.length})</span>
        <ChevronDownIcon className={expanded ? 'expanded' : undefined} />
      </button>

      {expanded && (
        <div className="ozon-orders-preview-table-wrap">
          <table className="ozon-orders-preview-table">
            <thead>
              <tr>
                <th>Номер</th>
                <th>Дата</th>
                <th>Статус</th>
                <th>Товаров</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.orderNumber}>
                  <td>{order.orderNumber}</td>
                  <td>{formatDate(order.date)}</td>
                  <td>{formatStatus(order.status)}</td>
                  <td>{order.items.length}</td>
                  <td>{formatAmount(order.totalAmount)} ₽</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
