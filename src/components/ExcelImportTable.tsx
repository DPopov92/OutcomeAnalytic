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
import type { ExcelOperationGroup } from '../types/excel'
import { CategorySelect } from './CategorySelect'

export interface ExcelImportItemState {
  id: string
  date: string
  time?: string
  amount: number
  userCategory: string
  categoryFromParent: boolean
  removed: boolean
}

export interface ExcelImportGroupState {
  id: string
  month: number
  year: number
  operationCategory: string
  description: string
  totalAmount: number
  userCategory: string
  removed: boolean
  items: ExcelImportItemState[]
}

const parentGridColumns = '40px 0.9fr 1fr 1.4fr 0.9fr 1.4fr 48px'

const amountFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
})

const removedRowSx = {
  opacity: 0.5,
  textDecoration: 'line-through',
}

function formatPeriod(month: number, year: number): string {
  const parsed = new Date(year, month - 1, 1)
  return parsed.toLocaleString('ru-RU', {
    month: 'short',
    year: 'numeric',
  })
}

function formatDate(value: string): string {
  const [yearStr, monthStr, dayStr] = value.split('-')
  const parsed = new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr))
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(date: string, time?: string): string {
  const formattedDate = formatDate(date)
  if (time) {
    return `${formattedDate}, ${time}`
  }

  return formattedDate
}

function formatGroupOperationsLabel(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} операция в группе`
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${count} операции в группе`
  }

  return `${count} операций в группе`
}

const expandButtonSx = {
  border: 1,
  borderColor: 'divider',
  bgcolor: 'background.paper',
  color: 'text.primary',
  boxShadow: 1,
  '&:hover': {
    bgcolor: 'action.selected',
    borderColor: 'primary.main',
    color: 'primary.main',
  },
} as const

function resolveGroupCategory(group: ExcelImportGroupState): string {
  const parentCategory = group.userCategory.trim()
  if (parentCategory) {
    return parentCategory
  }

  for (const item of group.items) {
    if (!item.removed && item.userCategory.trim()) {
      return item.userCategory.trim()
    }
  }

  return ''
}

function getActiveItems(group: ExcelImportGroupState): ExcelImportItemState[] {
  return group.items.filter((item) => !item.removed)
}

function hasMultipleItems(group: ExcelImportGroupState): boolean {
  return group.items.length > 1
}

export function buildExcelImportGroups(groups: ExcelOperationGroup[]): ExcelImportGroupState[] {
  return groups.map((group, groupIndex) => ({
    id: `excel-group-${groupIndex}`,
    month: group.month,
    year: group.year,
    operationCategory: group.operationCategory,
    description: group.description,
    totalAmount: group.totalAmount,
    userCategory: '',
    removed: false,
    items: group.items.map((item, itemIndex) => ({
      id: `excel-group-${groupIndex}-item-${itemIndex}`,
      date: item.date,
      time: item.time,
      amount: item.amount,
      userCategory: '',
      categoryFromParent: false,
      removed: false,
    })),
  }))
}

export function collectExcelSaveOperations(groups: ExcelImportGroupState[]) {
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

    const activeItems = getActiveItems(group)
    if (activeItems.length === 0) {
      continue
    }

    const category = resolveGroupCategory(group)
    const amount = activeItems.reduce((sum, item) => sum + item.amount, 0)

    operations.push({
      month: group.month,
      year: group.year,
      operationCategory: group.operationCategory,
      description: group.description,
      category,
      amount,
    })
  }

  return operations
}

export function areAllExcelItemsCategorized(groups: ExcelImportGroupState[]): boolean {
  for (const group of groups) {
    if (group.removed) {
      continue
    }

    const activeItems = getActiveItems(group)
    if (activeItems.length === 0) {
      continue
    }

    if (activeItems.length === 1 || group.userCategory.trim()) {
      if (!group.userCategory.trim()) {
        return false
      }
      continue
    }

    for (const item of activeItems) {
      if (!item.userCategory.trim()) {
        return false
      }
    }
  }

  return true
}

export function countActiveExcelGroups(groups: ExcelImportGroupState[]): number {
  return groups.filter((group) => {
    if (group.removed) {
      return false
    }

    return group.items.some((item) => !item.removed)
  }).length
}

function isParentCategoryDisabled(group: ExcelImportGroupState): boolean {
  if (!hasMultipleItems(group)) {
    return false
  }

  return group.items.some(
    (item) => !item.removed && !item.categoryFromParent && item.userCategory.trim() !== '',
  )
}

interface ExcelImportTableProps {
  groups: ExcelImportGroupState[]
  categories: Category[]
  categoryColors: Record<string, string>
  highlightMissingCategories?: boolean
  onGroupsChange: (groups: ExcelImportGroupState[]) => void
  onToggleGroupRemoved?: (groupId: string) => void
  onToggleItemRemoved?: (groupId: string, itemId: string) => void
}

export function ExcelImportTable({
  groups,
  categories,
  categoryColors,
  highlightMissingCategories = false,
  onGroupsChange,
  onToggleGroupRemoved,
  onToggleItemRemoved,
}: ExcelImportTableProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set())

  const activeGroupCount = countActiveExcelGroups(groups)
  const totalAmount = groups.reduce((sum, group) => {
    if (group.removed) {
      return sum
    }

    return (
      sum +
      group.items.reduce((itemSum, item) => (item.removed ? itemSum : itemSum + item.amount), 0)
    )
  }, 0)

  function updateGroup(groupId: string, updater: (group: ExcelImportGroupState) => ExcelImportGroupState) {
    onGroupsChange(groups.map((group) => (group.id === groupId ? updater(group) : group)))
  }

  function toggleGroupExpanded(groupId: string) {
    setExpandedGroups((current) => {
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
        <Typography color="text.secondary">Нет операций для загрузки.</Typography>
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
            Операции из Excel
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Назначьте категорию группе или отдельным строкам при дублировании
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Групп: <strong>{activeGroupCount}</strong> · Сумма:{' '}
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
          <span>Период</span>
          <span>Категория операции</span>
          <span>Описание</span>
          <span>Сумма</span>
          <span>Ваша категория</span>
          {onToggleGroupRemoved && <span />}
        </Box>

        <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
          {groups.map((group) => {
            const parentDisabled = isParentCategoryDisabled(group)
            const childrenEditable = group.userCategory.trim() === ''
            const groupRemoved = group.removed
            const expandable = hasMultipleItems(group)
            const isExpanded = expandable && expandedGroups.has(group.id)
            const activeItems = getActiveItems(group)
            const activeAmount = activeItems.reduce((sum, item) => sum + item.amount, 0)
            const groupLabel = `${formatPeriod(group.month, group.year)} · ${group.description}`

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
                    {expandable ? (
                      <IconButton
                        size="small"
                        aria-expanded={isExpanded}
                        aria-label={
                          isExpanded
                            ? `Свернуть группу: ${groupLabel}`
                            : `Развернуть группу: ${groupLabel}`
                        }
                        title={isExpanded ? 'Свернуть операции' : 'Развернуть операции'}
                        onClick={() => toggleGroupExpanded(group.id)}
                        sx={expandButtonSx}
                      >
                        <ChevronDownIcon
                          size={18}
                          strokeWidth={2.5}
                          style={{
                            transform: isExpanded ? 'rotate(180deg)' : undefined,
                            transition: 'transform 0.2s',
                          }}
                        />
                      </IconButton>
                    ) : null}
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: { md: 'none' } }}>
                      Период
                    </Typography>
                    <Typography variant="body2">{formatPeriod(group.month, group.year)}</Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: { md: 'none' } }}>
                      Категория операции
                    </Typography>
                    <Typography variant="body2">{group.operationCategory}</Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: { md: 'none' } }}>
                      Описание
                    </Typography>
                    <Typography variant="body2">{group.description}</Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: { md: 'none' } }}>
                      Сумма
                    </Typography>
                    <Typography variant="body2">{amountFormatter.format(activeAmount)}</Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: { md: 'none' } }}>
                      Ваша категория
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
                          !group.userCategory.trim() &&
                          (expandable
                            ? !parentDisabled &&
                              group.items.some(
                                (item) => !item.removed && !item.userCategory.trim(),
                              )
                            : true)
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
                            ? `Вернуть группу: ${groupLabel}`
                            : `Исключить группу: ${groupLabel}`
                        }
                        title={groupRemoved ? 'Вернуть группу' : 'Исключить группу'}
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

                {expandable && (
                  <Collapse in={isExpanded}>
                    <Box sx={{ bgcolor: 'action.hover', px: 1.5, pb: 1.5 }}>
                      <Box
                        aria-hidden="true"
                        sx={{
                          display: { xs: 'none', md: 'grid' },
                          gridTemplateColumns: parentGridColumns,
                          gap: 1,
                          py: 1,
                          typography: 'caption',
                          fontWeight: 600,
                          color: 'text.secondary',
                        }}
                      >
                        <span />
                        <Box sx={{ gridColumn: '2 / 5' }}>Дата и время</Box>
                        <span>Сумма</span>
                        <span>Ваша категория</span>
                        {onToggleItemRemoved && <span />}
                      </Box>

                      {group.items.map((item) => {
                        const itemRemoved = groupRemoved || item.removed

                        return (
                          <Box
                            key={item.id}
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: { xs: '1fr', md: parentGridColumns },
                              gap: 1,
                              alignItems: 'center',
                              py: 1,
                              borderTop: 1,
                              borderColor: 'divider',
                              ...(itemRemoved ? removedRowSx : undefined),
                            }}
                          >
                            <Box />

                            <Box sx={{ gridColumn: { xs: 'auto', md: '2 / 5' } }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: { md: 'none' } }}>
                                Дата и время
                              </Typography>
                              <Typography variant="body2">
                                {formatDateTime(item.date, item.time)}
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
                                Ваша категория
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
                                      ? `Вернуть операцию от ${formatDateTime(item.date, item.time)}`
                                      : `Исключить операцию от ${formatDateTime(item.date, item.time)}`
                                  }
                                  title={itemRemoved ? 'Вернуть операцию' : 'Исключить операцию'}
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
                      })}

                      {!groupRemoved && activeItems.length > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pt: 1 }}>
                          {formatGroupOperationsLabel(activeItems.length)}
                        </Typography>
                      )}
                    </Box>
                  </Collapse>
                )}
              </Box>
            )
          })}
        </Stack>
      </Paper>
    </Stack>
  )
}
