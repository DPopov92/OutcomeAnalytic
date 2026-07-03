import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  collectUniqueCategories,
  type CategorySegment,
  type MonthStack,
} from '../utils/aggregateByMonth'

interface CategoryStackedBarChartProps {
  stacks: MonthStack[]
}

interface SegmentTooltip {
  monthLabel: string
  segment: CategorySegment
  percentage: number
  x: number
  y: number
}

const amountFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const percentFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

const CHART_HEIGHT = 320
const PADDING_LEFT = 72
const PADDING_RIGHT = 16
const PADDING_TOP = 16
const PADDING_BOTTOM = 56
const MIN_BAR_WIDTH = 44
const BAR_GAP = 12
const SCROLL_THRESHOLD = 12

function formatShortPeriod(month: number, year: number): string {
  const shortMonths = [
    'Янв',
    'Фев',
    'Мар',
    'Апр',
    'Май',
    'Июн',
    'Июл',
    'Авг',
    'Сен',
    'Окт',
    'Ноя',
    'Дек',
  ]
  const monthName = shortMonths[month - 1] ?? String(month)
  const shortYear = String(year).slice(-2)
  return `${monthName} '${shortYear}`
}

function buildYAxisTicks(maxValue: number): number[] {
  if (maxValue === 0) {
    return [0]
  }

  const step = maxValue / 4
  return [0, step, step * 2, step * 3, maxValue]
}

export function CategoryStackedBarChart({ stacks }: CategoryStackedBarChartProps) {
  const theme = useTheme()
  const chartRef = useRef<HTMLDivElement>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<SegmentTooltip | null>(null)

  const legendItems = useMemo(() => collectUniqueCategories(stacks), [stacks])

  const maxTotal = useMemo(
    () => Math.max(...stacks.map((stack) => stack.total), 0),
    [stacks],
  )

  const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM
  const barCount = stacks.length
  const plotWidth = barCount * (MIN_BAR_WIDTH + BAR_GAP) - BAR_GAP
  const svgWidth = PADDING_LEFT + plotWidth + PADDING_RIGHT
  const yAxisTicks = buildYAxisTicks(maxTotal)

  useEffect(() => {
    setActiveCategory(null)
    setTooltip(null)
  }, [stacks])

  function buildTooltipPosition(event: React.MouseEvent) {
    const rect = chartRef.current?.getBoundingClientRect()
    if (!rect) {
      return null
    }

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  function handleSegmentEnter(
    stack: MonthStack,
    segment: CategorySegment,
    event: React.MouseEvent<SVGRectElement>,
  ) {
    const percentage = stack.total > 0 ? (segment.amount / stack.total) * 100 : 0
    const position = buildTooltipPosition(event)
    setActiveCategory(segment.category)

    if (position) {
      setTooltip({
        monthLabel: stack.label,
        segment,
        percentage,
        ...position,
      })
    }
  }

  function handleSegmentMove(
    stack: MonthStack,
    segment: CategorySegment,
    event: React.MouseEvent<SVGRectElement>,
  ) {
    const position = buildTooltipPosition(event)
    if (!position) {
      return
    }

    const percentage = stack.total > 0 ? (segment.amount / stack.total) * 100 : 0
    setTooltip({
      monthLabel: stack.label,
      segment,
      percentage,
      ...position,
    })
  }

  function handleSegmentLeave() {
    setActiveCategory(null)
    setTooltip(null)
  }

  function handleLegendEnter(category: string) {
    setActiveCategory(category)
    setTooltip(null)
  }

  function handleLegendLeave() {
    setActiveCategory(null)
    setTooltip(null)
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        Расходы по месяцам
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 3,
          alignItems: { xs: 'stretch', md: 'flex-start' },
        }}
      >
        <Box
          ref={chartRef}
          sx={{
            position: 'relative',
            flex: 1,
            minWidth: 0,
            overflowX: barCount > SCROLL_THRESHOLD ? 'auto' : 'visible',
          }}
        >
          <svg
            viewBox={`0 0 ${svgWidth} ${CHART_HEIGHT}`}
            role="img"
            aria-label="Столбчатая диаграмма расходов по месяцам"
            style={{
              width: barCount > SCROLL_THRESHOLD ? svgWidth : '100%',
              minWidth: barCount > SCROLL_THRESHOLD ? svgWidth : undefined,
              height: CHART_HEIGHT,
              display: 'block',
            }}
            preserveAspectRatio="xMinYMid meet"
          >
            {yAxisTicks.map((tick) => {
              const y =
                PADDING_TOP +
                plotHeight -
                (maxTotal > 0 ? (tick / maxTotal) * plotHeight : 0)

              return (
                <g key={tick}>
                  <line
                    x1={PADDING_LEFT}
                    y1={y}
                    x2={PADDING_LEFT + plotWidth}
                    y2={y}
                    stroke={theme.palette.divider}
                    strokeWidth={1}
                    strokeDasharray={tick === 0 ? undefined : '4 4'}
                  />
                  <text
                    x={PADDING_LEFT - 8}
                    y={y + 4}
                    textAnchor="end"
                    fill={theme.palette.text.secondary}
                    fontSize={11}
                  >
                    {amountFormatter.format(tick)}
                  </text>
                </g>
              )
            })}

            {stacks.map((stack, index) => {
              const barX = PADDING_LEFT + index * (MIN_BAR_WIDTH + BAR_GAP)
              let segmentOffset = 0

              return (
                <g key={`${stack.year}-${stack.month}`}>
                  {stack.segments.map((segment) => {
                    const segmentHeight =
                      maxTotal > 0 ? (segment.amount / maxTotal) * plotHeight : 0
                    const segmentY =
                      PADDING_TOP + plotHeight - segmentOffset - segmentHeight
                    segmentOffset += segmentHeight

                    const isDimmed =
                      activeCategory !== null &&
                      activeCategory !== segment.category

                    return (
                      <rect
                        key={`${stack.year}-${stack.month}-${segment.category}`}
                        x={barX}
                        y={segmentY}
                        width={MIN_BAR_WIDTH}
                        height={Math.max(segmentHeight, 0)}
                        fill={segment.color}
                        stroke={theme.palette.background.paper}
                        strokeWidth={1}
                        rx={1}
                        style={{
                          cursor: 'pointer',
                          transition: 'opacity 0.15s ease',
                          opacity: isDimmed ? 0.45 : 1,
                        }}
                        onMouseEnter={(event) =>
                          handleSegmentEnter(stack, segment, event)
                        }
                        onMouseMove={(event) =>
                          handleSegmentMove(stack, segment, event)
                        }
                        onMouseLeave={handleSegmentLeave}
                      />
                    )
                  })}

                  <text
                    x={barX + MIN_BAR_WIDTH / 2}
                    y={CHART_HEIGHT - PADDING_BOTTOM + 20}
                    textAnchor="middle"
                    fill={theme.palette.text.secondary}
                    fontSize={11}
                  >
                    {formatShortPeriod(stack.month, stack.year)}
                  </text>

                  {tooltip?.monthLabel === stack.label && (
                    <text
                      x={barX + MIN_BAR_WIDTH / 2}
                      y={PADDING_TOP - 4}
                      textAnchor="middle"
                      fill={theme.palette.text.primary}
                      fontSize={11}
                      fontWeight={600}
                    >
                      {amountFormatter.format(stack.total)}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>

          {tooltip && (
            <Paper
              elevation={4}
              role="tooltip"
              sx={{
                position: 'absolute',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 1,
                transform: 'translate(-50%, calc(-100% - 12px))',
                left: tooltip.x,
                top: tooltip.y,
                zIndex: 1,
              }}
            >
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: 0.5,
                  bgcolor: tooltip.segment.color,
                  flexShrink: 0,
                }}
              />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {tooltip.monthLabel}
                </Typography>
                <Typography variant="subtitle2">
                  {tooltip.segment.category}
                </Typography>
                <Typography variant="body2">
                  {amountFormatter.format(tooltip.segment.amount)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {percentFormatter.format(tooltip.percentage)}% за месяц
                </Typography>
              </Box>
            </Paper>
          )}
        </Box>

        <Stack
          component="ul"
          spacing={1}
          sx={{
            listStyle: 'none',
            m: 0,
            p: 0,
            flexShrink: 0,
            width: { xs: '100%', md: 220 },
          }}
        >
          {legendItems.map((item) => (
            <Box
              component="li"
              key={item.category}
              onMouseEnter={() => handleLegendEnter(item.category)}
              onMouseLeave={handleLegendLeave}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1,
                borderRadius: 1,
                bgcolor:
                  activeCategory === item.category
                    ? 'action.selected'
                    : 'transparent',
                cursor: 'default',
              }}
            >
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: 0.5,
                  bgcolor: item.color,
                  flexShrink: 0,
                }}
              />
              <Typography variant="body2" sx={{ flex: 1 }}>
                {item.category}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>
    </Paper>
  )
}
