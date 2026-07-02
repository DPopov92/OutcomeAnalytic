import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { useEffect, useRef, useState } from 'react'
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

const MIN_CHART_SIZE = 300
const MAX_CHART_SIZE = 480
const CHART_CENTER = MIN_CHART_SIZE / 2
const OUTER_RADIUS = CHART_CENTER - 8
const INNER_RADIUS = OUTER_RADIUS * 0.62

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

export function CategoryPieChart({ items }: CategoryPieChartProps) {
  const theme = useTheme()
  const visualRef = useRef<HTMLDivElement>(null)
  const legendRef = useRef<HTMLUListElement>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number
    y: number
  } | null>(null)
  const [visualSize, setVisualSize] = useState(MIN_CHART_SIZE)

  useEffect(() => {
    setActiveCategory(null)
    setTooltipPosition(null)
  }, [items])

  useEffect(() => {
    const legend = legendRef.current
    if (!legend) {
      return
    }

    const legendEl = legend

    function syncChartSize() {
      const legendHeight = legendEl.offsetHeight
      const nextSize = Math.max(
        MIN_CHART_SIZE,
        Math.min(legendHeight, MAX_CHART_SIZE),
      )
      setVisualSize(nextSize)
    }

    syncChartSize()

    const observer = new ResizeObserver(syncChartSize)
    observer.observe(legend)

    return () => {
      observer.disconnect()
    }
  }, [items])

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0)

  let currentAngle = 0
  const slices = items.map((item) => {
    const sliceAngle = (item.percentage / 100) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + sliceAngle
    currentAngle = endAngle

    return {
      ...item,
      startAngle,
      endAngle,
      path: buildDonutSlicePath(startAngle, endAngle, items.length === 1),
    }
  })

  const activeSlice = slices.find((slice) => slice.category === activeCategory)

  function updateTooltipPosition(event: React.MouseEvent) {
    const rect = visualRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }

    setTooltipPosition({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    })
  }

  function handleSliceEnter(
    category: string,
    event: React.MouseEvent<SVGPathElement>,
  ) {
    setActiveCategory(category)
    updateTooltipPosition(event)
  }

  function handleSliceMove(event: React.MouseEvent<SVGPathElement>) {
    updateTooltipPosition(event)
  }

  function handleSliceLeave() {
    setActiveCategory(null)
    setTooltipPosition(null)
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        Расходы по категориям
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 3,
          alignItems: { xs: 'center', md: 'flex-start' },
        }}
      >
        <Box
          ref={visualRef}
          sx={{
            position: 'relative',
            width: visualSize,
            height: visualSize,
            flexShrink: 0,
          }}
        >
          <svg
            viewBox={`0 0 ${MIN_CHART_SIZE} ${MIN_CHART_SIZE}`}
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
                  onMouseEnter={(event) => handleSliceEnter(slice.category, event)}
                  onMouseMove={handleSliceMove}
                  onMouseLeave={handleSliceLeave}
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

          {activeSlice && tooltipPosition && (
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
                left: tooltipPosition.x,
                top: tooltipPosition.y,
                zIndex: 1,
              }}
            >
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: activeSlice.color,
                  flexShrink: 0,
                }}
              />
              <Box>
                <Typography variant="subtitle2">{activeSlice.category}</Typography>
                <Typography variant="body2">{amountFormatter.format(activeSlice.amount)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {percentFormatter.format(activeSlice.percentage)}%
                </Typography>
              </Box>
            </Paper>
          )}

          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: `${((INNER_RADIUS - 2) * 2 / MIN_CHART_SIZE) * 100}%`,
              height: `${((INNER_RADIUS - 2) * 2 / MIN_CHART_SIZE) * 100}%`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              textAlign: 'center',
              px: 1,
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}
            >
              Всего
            </Typography>
            <Typography variant="h6" component="p" sx={{ fontWeight: 700, lineHeight: 1.2, mt: 0.25 }}>
              {amountFormatter.format(totalAmount)}
            </Typography>
          </Box>
        </Box>

        <Stack
          component="ul"
          ref={legendRef}
          spacing={1}
          sx={{ listStyle: 'none', m: 0, p: 0, flex: 1, width: '100%' }}
        >
          {items.map((item) => (
            <Box
              component="li"
              key={item.category}
              onMouseEnter={() => setActiveCategory(item.category)}
              onMouseLeave={() => setActiveCategory(null)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1,
                borderRadius: 1,
                bgcolor: activeCategory === item.category ? 'action.selected' : 'transparent',
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
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2">{amountFormatter.format(item.amount)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {percentFormatter.format(item.percentage)}%
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      </Box>
    </Paper>
  )
}
