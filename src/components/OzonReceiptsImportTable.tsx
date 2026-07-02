import Box from '@mui/material/Box'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { ChevronDownIcon } from '../assets/icons/ChevronDownIcon'
import { DeleteIcon } from '../assets/icons/DeleteIcon'
import { RestoreIcon } from '../assets/icons/RestoreIcon'
import type { Category } from '../types/category'
import type { OzonReceipt } from '../types/ozon'
import { ozonReceiptItemLineTotal } from '../types/ozon'
import { CategorySelect } from './CategorySelect'

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

const parentGridColumns = '40px 1.4fr 0.7fr 0.9fr 1.4fr 48px'
const childGridColumns = '2fr 0.9fr 1.4fr 48px'

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

const removedRowSx = {
  opacity: 0.5,
  textDecoration: 'line-through',
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
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">Нет чеков для загрузки.</Typography>
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
        <Box>
          <Typography variant="h6" component="h2">
            Чеки Ozon
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Назначьте категорию всему чеку или отдельным позициям
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Позиций: <strong>{activeItemCount}</strong> · Сумма:{' '}
          <strong>{amountFormatter.format(totalAmount)}</strong>
        </Typography>
      </Stack>

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Box
          aria-hidden="true"
          sx={{
            display: { xs: 'none', md: 'grid' },
            gridTemplateColumns: parentGridColumns,
            gap: 1,
            px: 1.5,
            py: 1,
            bgcolor: 'action.hover',
            typography: 'caption',
            fontWeight: 600,
            color: 'text.secondary',
          }}
        >
          <span />
          <span>Дата заказа</span>
          <span>Позиции</span>
          <span>Сумма</span>
          <span>Категория</span>
          {onToggleGroupRemoved && <span />}
        </Box>

        <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
          {groups.map((group) => {
            const parentDisabled = isParentCategoryDisabled(group)
            const childrenEditable = group.userCategory.trim() === ''
            const groupRemoved = group.removed
            const isExpanded = !collapsedGroups.has(group.id)
            const activeItems = group.items.filter((item) => !item.removed)

            return (
              <Box key={group.id} sx={groupRemoved ? removedRowSx : undefined}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: parentGridColumns },
                    gap: 1,
                    alignItems: 'center',
                    p: 1.5,
                  }}
                >
                  <Box>
                    <IconButton
                      size="small"
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
                        size={16}
                        strokeWidth={2}
                        style={{
                          transform: isExpanded ? 'rotate(180deg)' : undefined,
                          transition: 'transform 0.2s',
                        }}
                      />
                    </IconButton>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: { md: 'none' } }}>
                      Дата заказа
                    </Typography>
                    <Typography variant="body2">{formatDate(group.date)}</Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: { md: 'none' } }}>
                      Позиции
                    </Typography>
                    <Typography variant="body2">{group.items.length}</Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: { md: 'none' } }}>
                      Сумма
                    </Typography>
                    <Typography variant="body2">{amountFormatter.format(group.totalAmount)}</Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: { md: 'none' } }}>
                      Категория
                    </Typography>
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
                  </Box>

                  {onToggleGroupRemoved && (
                    <Box sx={{ justifySelf: { md: 'center' } }}>
                      <IconButton
                        size="small"
                        color={groupRemoved ? 'default' : 'error'}
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
                      </IconButton>
                    </Box>
                  )}
                </Box>

                <Collapse in={isExpanded}>
                  <Box sx={{ bgcolor: 'action.hover', px: 1.5, pb: 1.5 }}>
                    <Box
                      aria-hidden="true"
                      sx={{
                        display: { xs: 'none', md: 'grid' },
                        gridTemplateColumns: childGridColumns,
                        gap: 1,
                        py: 1,
                        typography: 'caption',
                        fontWeight: 600,
                        color: 'text.secondary',
                      }}
                    >
                      <span>Описание</span>
                      <span>Сумма</span>
                      <span>Категория</span>
                      {onToggleItemRemoved && <span />}
                    </Box>

                    {group.items.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                        В чеке нет позиций.
                      </Typography>
                    ) : (
                      group.items.map((item) => {
                        const itemRemoved = groupRemoved || item.removed

                        return (
                          <Box
                            key={item.id}
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: { xs: '1fr', md: childGridColumns },
                              gap: 1,
                              alignItems: 'center',
                              py: 1,
                              borderTop: 1,
                              borderColor: 'divider',
                              ...(itemRemoved ? removedRowSx : undefined),
                            }}
                          >
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ display: { md: 'none' } }}>
                                Описание
                              </Typography>
                              <Typography variant="body2">
                                {formatItemDescription(item.description)}
                              </Typography>
                            </Box>

                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ display: { md: 'none' } }}>
                                Сумма
                              </Typography>
                              <Typography variant="body2">{amountFormatter.format(item.amount)}</Typography>
                            </Box>

                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ display: { md: 'none' } }}>
                                Категория
                              </Typography>
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
                            </Box>

                            {onToggleItemRemoved && (
                              <Box sx={{ justifySelf: { md: 'center' } }}>
                                <IconButton
                                  size="small"
                                  color={itemRemoved ? 'default' : 'error'}
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
                                </IconButton>
                              </Box>
                            )}
                          </Box>
                        )
                      })
                    )}

                    {!groupRemoved && activeItems.length > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pt: 1 }}>
                        {activeItems.length}{' '}
                        {activeItems.length === 1 ? 'позиция' : 'позиций'} в чеке
                      </Typography>
                    )}
                  </Box>
                </Collapse>
              </Box>
            )
          })}
        </Stack>
      </Paper>
    </Stack>
  )
}
