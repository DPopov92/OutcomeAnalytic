import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { useEffect, useMemo, useState } from 'react'
import type { CategoryTotal } from '../utils/aggregateByCategory'

interface CategoryPieChartProps {
  items: CategoryTotal[]
}

const amountFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
})

const percentFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

const CHART_VIEW_SIZE = 300
const CHART_DISPLAY_SIZE = 360
const CHART_CENTER = CHART_VIEW_SIZE / 2
const OUTER_RADIUS = CHART_CENTER - 8
const INNER_RADIUS = OUTER_RADIUS * 0.62
const MIN_SLICE_PERCENT = 3
const LEGEND_ROW_HEIGHT = 36
const LEGEND_WIDTH = 224
const OTHER_CATEGORY = 'Прочее'

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleDegrees: number,
) {
  const angleRadians = ((angleDegrees - 90) * Math.PI) / 180

  return {
    x: centerX + radius * Math.cos(angleRadians),
    y: centerY + radius * Math.sin(angleRadians),
  }
}

function buildDonutSlicePath(
  startAngle: number,
  endAngle: number,
  isFullCircle: boolean,
): string {
  if (isFullCircle) {
    const outerTop = polarToCartesian(
      CHART_CENTER,
      CHART_CENTER,
      OUTER_RADIUS,
      0,
    )
    const outerBottom = polarToCartesian(
      CHART_CENTER,
      CHART_CENTER,
      OUTER_RADIUS,
      180,
    )
    const innerTop = polarToCartesian(
      CHART_CENTER,
      CHART_CENTER,
      INNER_RADIUS,
      0,
    )
    const innerBottom = polarToCartesian(
      CHART_CENTER,
      CHART_CENTER,
      INNER_RADIUS,
      180,
    )

    return [
      `M ${outerTop.x} ${outerTop.y}`,
      `A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 1 1 ${outerBottom.x} ${outerBottom.y}`,
      `A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 1 1 ${outerTop.x} ${outerTop.y}`,
      `M ${innerTop.x} ${innerTop.y}`,
      `A ${INNER_RADIUS} ${INNER_RADIUS} 0 1 0 ${innerBottom.x} ${innerBottom.y}`,
      `A ${INNER_RADIUS} ${INNER_RADIUS} 0 1 0 ${innerTop.x} ${innerTop.y}`,
      'Z',
    ].join(' ')
  }

  const outerStart = polarToCartesian(
    CHART_CENTER,
    CHART_CENTER,
    OUTER_RADIUS,
    startAngle,
  )
  const outerEnd = polarToCartesian(
    CHART_CENTER,
    CHART_CENTER,
    OUTER_RADIUS,
    endAngle,
  )
  const innerEnd = polarToCartesian(
    CHART_CENTER,
    CHART_CENTER,
    INNER_RADIUS,
    endAngle,
  )
  const innerStart = polarToCartesian(
    CHART_CENTER,
    CHART_CENTER,
    INNER_RADIUS,
    startAngle,
  )
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}

function consolidateSmallCategories(
  items: CategoryTotal[],
  otherColor: string,
): CategoryTotal[] {
  if (items.length === 0) {
    return []
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0)
  const main: CategoryTotal[] = []
  let otherAmount = 0

  for (const item of items) {
    if (item.percentage >= MIN_SLICE_PERCENT) {
      main.push(item)
    } else {
      otherAmount += item.amount
    }
  }

  if (otherAmount > 0) {
    main.push({
      category: OTHER_CATEGORY,
      amount: otherAmount,
      percentage: (otherAmount / total) * 100,
      color: otherColor,
    })
  }

  return main.sort((left, right) => right.amount - left.amount)
}

export function CategoryPieChart({ items }: CategoryPieChartProps) {
  const theme = useTheme()
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const chartItems = useMemo(
    () => consolidateSmallCategories(items, theme.palette.grey[500]),
    [items, theme.palette.grey],
  )

  useEffect(() => {
    setActiveCategory(null)
  }, [items])

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0)

  let currentAngle = 0
  const slices = chartItems.map((item) => {
    const sliceAngle = (item.percentage / 100) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + sliceAngle
    currentAngle = endAngle

    return {
      ...item,
      startAngle,
      endAngle,
      path: buildDonutSlicePath(startAngle, endAngle, chartItems.length === 1),
    }
  })

  const activeSlice = slices.find((slice) => slice.category === activeCategory)

  const containerHeight = useMemo(() => {
    const legendHeight =
      chartItems.length * LEGEND_ROW_HEIGHT +
      Math.max(0, chartItems.length - 1) * 4
    return Math.max(CHART_DISPLAY_SIZE, legendHeight)
  }, [chartItems.length])

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        Расходы по категориям
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'center', md: 'stretch' },
          minHeight: { xs: 'auto', md: containerHeight },
          width: '100%',
        }}
      >
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            sx={{
              position: 'relative',
              width: CHART_DISPLAY_SIZE,
              height: CHART_DISPLAY_SIZE,
              maxWidth: '100%',
              flexShrink: 0,
            }}
          >
          <svg
            viewBox={`0 0 ${CHART_VIEW_SIZE} ${CHART_VIEW_SIZE}`}
            role="img"
            aria-label="Круговая диаграмма расходов по категориям"
            style={{ width: '100%', height: '100%', display: 'block' }}
          >
            {slices.map((slice) => {
              const isActive = activeCategory === slice.category
              const isDimmed = activeCategory !== null && !isActive

              return (
                <path
                  key={slice.category}
                  d={slice.path}
                  fill={slice.color}
                  stroke={theme.palette.background.paper}
                  strokeWidth={2}
                  style={{
                    cursor: 'pointer',
                    transition: 'opacity 0.15s ease',
                    opacity: isDimmed ? 0.45 : 1,
                  }}
                  onMouseEnter={() => setActiveCategory(slice.category)}
                  onMouseLeave={() => setActiveCategory(null)}
                />
              )
            })}
            <circle
              cx={CHART_CENTER}
              cy={CHART_CENTER}
              r={INNER_RADIUS - 2}
              fill={theme.palette.background.paper}
              stroke={theme.palette.divider}
              strokeWidth={1}
            />
          </svg>

          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: `${((INNER_RADIUS - 2) * 2 / CHART_VIEW_SIZE) * 100}%`,
              height: `${((INNER_RADIUS - 2) * 2 / CHART_VIEW_SIZE) * 100}%`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              textAlign: 'center',
              px: 1,
            }}
          >
            {activeSlice ? (
              <>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ maxWidth: '100%', fontWeight: 500 }}
                >
                  {activeSlice.category}
                </Typography>
                <Typography
                  variant="subtitle1"
                  component="p"
                  sx={{ fontWeight: 700, lineHeight: 1.2, mt: 0.25 }}
                >
                  {amountFormatter.format(activeSlice.amount)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {percentFormatter.format(activeSlice.percentage)}%
                </Typography>
              </>
            ) : (
              <>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}
                >
                  Всего
                </Typography>
                <Typography
                  variant="subtitle1"
                  component="p"
                  sx={{ fontWeight: 700, lineHeight: 1.2, mt: 0.25 }}
                >
                  {amountFormatter.format(totalAmount)}
                </Typography>
              </>
            )}
          </Box>
          </Box>
        </Box>

        <Box
          sx={{
            flexShrink: 0,
            width: { xs: '100%', md: LEGEND_WIDTH },
            maxWidth: { xs: 360, md: LEGEND_WIDTH },
            mt: { xs: 2, md: 0 },
            display: 'flex',
            justifyContent: { xs: 'center', md: 'flex-start' },
            alignItems: { xs: 'center', md: 'flex-start' },
            pl: { md: 2 },
          }}
        >
          <Box
            component="ul"
            sx={{
              listStyle: 'none',
              m: 0,
              p: 0,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
            }}
          >
          {chartItems.map((item) => (
            <Box
              component="li"
              key={item.category}
              onMouseEnter={() => setActiveCategory(item.category)}
              onMouseLeave={() => setActiveCategory(null)}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gridTemplateRows: 'auto auto',
                columnGap: 0.75,
                rowGap: 0.25,
                minWidth: 0,
                cursor: 'default',
                opacity: activeCategory === null || activeCategory === item.category ? 1 : 0.5,
                transition: 'opacity 0.15s ease',
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: item.color,
                  flexShrink: 0,
                  gridRow: 1,
                  alignSelf: 'center',
                }}
              />
              <Typography
                variant="caption"
                noWrap
                sx={{
                  gridColumn: 2,
                  gridRow: 1,
                  minWidth: 0,
                  color: 'text.primary',
                  alignSelf: 'center',
                }}
              >
                {item.category}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  gridColumn: 3,
                  gridRow: 1,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                  textAlign: 'right',
                }}
              >
                {amountFormatter.format(item.amount)}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  gridColumn: 3,
                  gridRow: 2,
                  fontVariantNumeric: 'tabular-nums',
                  textAlign: 'right',
                }}
              >
                {percentFormatter.format(item.percentage)}%
              </Typography>
            </Box>
          ))}
          </Box>
        </Box>
      </Box>
    </Paper>
  )
}
