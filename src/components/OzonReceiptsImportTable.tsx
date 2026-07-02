import { useState } from 'react'
import { ChevronDownIcon } from '../assets/icons/ChevronDownIcon'
import { DeleteIcon } from '../assets/icons/DeleteIcon'
import { RestoreIcon } from '../assets/icons/RestoreIcon'
import type { Category } from '../types/category'
import type { OzonReceipt } from '../types/ozon'
import { ozonReceiptItemLineTotal } from '../types/ozon'
import { CategorySelect } from './CategorySelect'
import './OzonReceiptsImportTable.css'

export const OZON_RECEIPT_OPERATION_CATEGORY = 'Ozon'

export interface OzonReceiptItemState {
  id: string
  description: string
  amount: number
  month: number
  year: number
  userCategory: string
  categoryFromParent: boolean
  removed: boolean
}

export interface OzonReceiptGroupState {
  id: string
  date: string
  totalAmount: number
  userCategory: string
  removed: boolean
  items: OzonReceiptItemState[]
}

function buildItemDescription(name: string, quantity: number): string {
  const label = name.trim() || 'Товар'
  if (quantity > 1) {
    return `Чек Ozon: ${label} (${quantity} шт.)`
  }

  return `Чек Ozon: ${label}`
}

export function buildOzonReceiptGroups(receipts: OzonReceipt[]): OzonReceiptGroupState[] {
  return receipts.map((receipt, receiptIndex) => {
    const parsedDate = new Date(receipt.date)
    const month = parsedDate.getMonth() + 1
    const year = parsedDate.getFullYear()

    return {
      id: `receipt-${receiptIndex}`,
      date: receipt.date,
      totalAmount: receipt.totalAmount,
      userCategory: '',
      removed: false,
      items: receipt.items.map((item, itemIndex) => ({
        id: `receipt-${receiptIndex}-item-${itemIndex}`,
        description: buildItemDescription(item.name, item.quantity),
        amount: ozonReceiptItemLineTotal(item),
        month,
        year,
        userCategory: '',
        categoryFromParent: false,
        removed: false,
      })),
    }
  })
}

export function collectOzonReceiptSaveOperations(groups: OzonReceiptGroupState[]) {
  const operations: Array<{
    month: number
    year: number
    operationCategory: string
    description: string
    category: string
    amount: number
  }> = []

  for (const group of groups) {
    if (group.removed) {
      continue
    }

    for (const item of group.items) {
      if (item.removed) {
        continue
      }

      operations.push({
        month: item.month,
        year: item.year,
        operationCategory: OZON_RECEIPT_OPERATION_CATEGORY,
        description: item.description,
        category: item.userCategory.trim(),
        amount: item.amount,
      })
    }
  }

  return operations
}

export function areAllOzonReceiptItemsCategorized(groups: OzonReceiptGroupState[]): boolean {
  for (const group of groups) {
    if (group.removed) {
      continue
    }

    for (const item of group.items) {
      if (item.removed) {
        continue
      }

      if (!item.userCategory.trim()) {
        return false
      }
    }
  }

  return true
}

export function countActiveOzonReceiptItems(groups: OzonReceiptGroupState[]): number {
  let count = 0

  for (const group of groups) {
    if (group.removed) {
      continue
    }

    for (const item of group.items) {
      if (!item.removed) {
        count += 1
      }
    }
  }

  return count
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

function formatItemDescription(description: string): string {
  return description.replace(/^Чек Ozon: /, '')
}

const amountFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
})

function isParentCategoryDisabled(group: OzonReceiptGroupState): boolean {
  return group.items.some(
    (item) => !item.removed && !item.categoryFromParent && item.userCategory.trim() !== '',
  )
}

interface OzonReceiptsImportTableProps {
  groups: OzonReceiptGroupState[]
  categories: Category[]
  categoryColors: Record<string, string>
  highlightMissingCategories?: boolean
  onGroupsChange: (groups: OzonReceiptGroupState[]) => void
  onToggleGroupRemoved?: (groupId: string) => void
  onToggleItemRemoved?: (groupId: string, itemId: string) => void
}

export function OzonReceiptsImportTable({
  groups,
  categories,
  categoryColors,
  highlightMissingCategories = false,
  onGroupsChange,
  onToggleGroupRemoved,
  onToggleItemRemoved,
}: OzonReceiptsImportTableProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())

  const activeItemCount = countActiveOzonReceiptItems(groups)
  const totalAmount = groups.reduce((sum, group) => {
    if (group.removed) {
      return sum
    }

    return (
      sum +
      group.items.reduce((itemSum, item) => (item.removed ? itemSum : itemSum + item.amount), 0)
    )
  }, 0)

  function updateGroup(groupId: string, updater: (group: OzonReceiptGroupState) => OzonReceiptGroupState) {
    onGroupsChange(groups.map((group) => (group.id === groupId ? updater(group) : group)))
  }

  function toggleGroupExpanded(groupId: string) {
    setCollapsedGroups((current) => {
      const next = new Set(current)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  function handleParentCategoryChange(groupId: string, userCategory: string) {
    updateGroup(groupId, (group) => {
      if (!userCategory.trim()) {
        return {
          ...group,
          userCategory: '',
          items: group.items.map((item) => ({
            ...item,
            userCategory: '',
            categoryFromParent: false,
          })),
        }
      }

      return {
        ...group,
        userCategory,
        items: group.items.map((item) => ({
          ...item,
          userCategory,
          categoryFromParent: true,
        })),
      }
    })
  }

  function handleChildCategoryChange(groupId: string, itemId: string, userCategory: string) {
    updateGroup(groupId, (group) => ({
      ...group,
      userCategory: '',
      items: group.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              userCategory,
              categoryFromParent: false,
            }
          : item,
      ),
    }))
  }

  if (groups.length === 0) {
    return (
      <div className="table-empty">
        <p>Нет чеков для загрузки.</p>
      </div>
    )
  }

  return (
    <div className="table-section compact ozon-receipts-import-table">
      <div className="table-header">
        <div>
          <h2>Чеки Ozon</h2>
          <p className="table-period">
            Назначьте категорию всему чеку или отдельным позициям
          </p>
        </div>
        <p>
          Позиций: <strong>{activeItemCount}</strong> · Сумма:{' '}
          <strong>{amountFormatter.format(totalAmount)}</strong>
        </p>
      </div>

      <div className="table-wrapper">
        <div className="ozon-receipt-groups">
          <div className="ozon-receipt-parent-header" aria-hidden="true">
          <span className="ozon-receipt-col-expand" />
          <span className="ozon-receipt-col-date">Дата заказа</span>
          <span className="ozon-receipt-col-positions">Позиции</span>
          <span className="ozon-receipt-col-amount">Сумма</span>
          <span className="ozon-receipt-col-category">Категория</span>
          {onToggleGroupRemoved && <span className="ozon-receipt-col-actions" />}
        </div>

        {groups.map((group) => {
          const parentDisabled = isParentCategoryDisabled(group)
          const childrenEditable = group.userCategory.trim() === ''
          const groupRemoved = group.removed
          const isExpanded = !collapsedGroups.has(group.id)
          const activeItems = group.items.filter((item) => !item.removed)

          return (
            <article
              key={group.id}
              className={`ozon-receipt-group${
                groupRemoved ? ' ozon-receipt-group-removed' : ''
              }${isExpanded ? ' ozon-receipt-group-expanded' : ''}`}
            >
              <div
                className={`ozon-receipt-parent-row${
                  groupRemoved ? ' import-preview-row-removed' : ''
                }`}
              >
                <div className="ozon-receipt-col-expand">
                  <button
                    type="button"
                    className="ozon-receipt-expand-btn"
                    aria-expanded={isExpanded}
                    aria-label={
                      isExpanded
                        ? `Свернуть чек от ${formatDate(group.date)}`
                        : `Развернуть чек от ${formatDate(group.date)}`
                    }
                    title={isExpanded ? 'Свернуть позиции' : 'Развернуть позиции'}
                    onClick={() => toggleGroupExpanded(group.id)}
                  >
                    <ChevronDownIcon
                      className={isExpanded ? 'expanded' : undefined}
                      size={16}
                      strokeWidth={2}
                    />
                  </button>
                </div>

                <div className="ozon-receipt-col-date">
                  <span className="ozon-receipt-parent-label">Дата заказа</span>
                  <span className="ozon-receipt-parent-value">{formatDate(group.date)}</span>
                </div>

                <div className="ozon-receipt-col-positions">
                  <span className="ozon-receipt-parent-label">Позиции</span>
                  <span className="ozon-receipt-parent-value">{group.items.length}</span>
                </div>

                <div className="ozon-receipt-col-amount">
                  <span className="ozon-receipt-parent-label">Сумма</span>
                  <span className="ozon-receipt-parent-value">
                    {amountFormatter.format(group.totalAmount)}
                  </span>
                </div>

                <div className="ozon-receipt-col-category">
                  <span className="ozon-receipt-parent-label">Категория</span>
                  {!groupRemoved && (
                    <CategorySelect
                      value={group.userCategory}
                      categories={categories}
                      categoryColors={categoryColors}
                      disabled={parentDisabled}
                      clearable
                      hasError={
                        highlightMissingCategories &&
                        !parentDisabled &&
                        !group.userCategory.trim() &&
                        group.items.some(
                          (item) => !item.removed && !item.userCategory.trim(),
                        )
                      }
                      onChange={(userCategory) =>
                        handleParentCategoryChange(group.id, userCategory)
                      }
                    />
                  )}
                </div>

                {onToggleGroupRemoved && (
                  <div className="ozon-receipt-col-actions">
                    <button
                      type="button"
                      className={groupRemoved ? 'row-restore-btn' : 'row-delete-btn'}
                      onClick={() => onToggleGroupRemoved(group.id)}
                      aria-label={
                        groupRemoved
                          ? `Вернуть чек от ${formatDate(group.date)}`
                          : `Исключить чек от ${formatDate(group.date)}`
                      }
                      title={groupRemoved ? 'Вернуть чек' : 'Исключить чек'}
                    >
                      {groupRemoved ? (
                        <RestoreIcon size={16} strokeWidth={2} />
                      ) : (
                        <DeleteIcon size={16} strokeWidth={2} />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {isExpanded && (
                <div className="ozon-receipt-children">
                  <div className="ozon-receipt-child-header" aria-hidden="true">
                    <span className="ozon-receipt-col-description">Описание</span>
                    <span className="ozon-receipt-col-amount">Сумма</span>
                    <span className="ozon-receipt-col-category">Категория</span>
                    {onToggleItemRemoved && <span className="ozon-receipt-col-actions" />}
                  </div>

                  {group.items.length === 0 ? (
                    <p className="ozon-receipt-children-empty">В чеке нет позиций.</p>
                  ) : (
                    group.items.map((item) => {
                      const itemRemoved = groupRemoved || item.removed

                      return (
                        <div
                          key={item.id}
                          className={`ozon-receipt-child-row${
                            itemRemoved ? ' import-preview-row-removed' : ''
                          }`}
                        >
                          <div className="ozon-receipt-col-description">
                            <span className="ozon-receipt-child-label">Описание</span>
                            <span className="ozon-receipt-child-value">
                              {formatItemDescription(item.description)}
                            </span>
                          </div>

                          <div className="ozon-receipt-col-amount">
                            <span className="ozon-receipt-child-label">Сумма</span>
                            <span className="ozon-receipt-child-value">
                              {amountFormatter.format(item.amount)}
                            </span>
                          </div>

                          <div className="ozon-receipt-col-category">
                            <span className="ozon-receipt-child-label">Категория</span>
                            {!itemRemoved && (
                              <CategorySelect
                                value={item.userCategory}
                                categories={categories}
                                categoryColors={categoryColors}
                                disabled={!childrenEditable}
                                clearable
                                hasError={
                                  highlightMissingCategories && !item.userCategory.trim()
                                }
                                onChange={(userCategory) =>
                                  handleChildCategoryChange(group.id, item.id, userCategory)
                                }
                              />
                            )}
                          </div>

                          {onToggleItemRemoved && (
                            <div className="ozon-receipt-col-actions">
                              <button
                                type="button"
                                className={itemRemoved ? 'row-restore-btn' : 'row-delete-btn'}
                                onClick={() => onToggleItemRemoved(group.id, item.id)}
                                disabled={groupRemoved}
                                aria-label={
                                  itemRemoved
                                    ? `Вернуть позицию: ${item.description}`
                                    : `Исключить позицию: ${item.description}`
                                }
                                title={itemRemoved ? 'Вернуть позицию' : 'Исключить позицию'}
                              >
                                {itemRemoved ? (
                                  <RestoreIcon size={16} strokeWidth={2} />
                                ) : (
                                  <DeleteIcon size={16} strokeWidth={2} />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}

                  {!groupRemoved && activeItems.length > 0 && (
                    <p className="ozon-receipt-children-summary">
                      {activeItems.length}{' '}
                      {activeItems.length === 1 ? 'позиция' : 'позиций'} в чеке
                    </p>
                  )}
                </div>
              )}
            </article>
          )
        })}
        </div>
      </div>
    </div>
  )
}
