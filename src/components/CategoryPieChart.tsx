import { useEffect, useRef, useState } from 'react'
import type { CategoryTotal } from '../utils/aggregateByCategory'
import './CategoryPieChart.css'

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
const CHART_RADIUS = CHART_CENTER - 8

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

function buildSlicePath(
  startAngle: number,
  endAngle: number,
  isFullCircle: boolean,
): string {
  if (isFullCircle) {
    const top = polarToCartesian(CHART_CENTER, CHART_CENTER, CHART_RADIUS, 0)
    const bottom = polarToCartesian(
      CHART_CENTER,
      CHART_CENTER,
      CHART_RADIUS,
      180,
    )

    return [
      `M ${CHART_CENTER} ${CHART_CENTER}`,
      `L ${top.x} ${top.y}`,
      `A ${CHART_RADIUS} ${CHART_RADIUS} 0 1 1 ${bottom.x} ${bottom.y}`,
      `A ${CHART_RADIUS} ${CHART_RADIUS} 0 1 1 ${top.x} ${top.y}`,
      'Z',
    ].join(' ')
  }

  const start = polarToCartesian(
    CHART_CENTER,
    CHART_CENTER,
    CHART_RADIUS,
    endAngle,
  )
  const end = polarToCartesian(
    CHART_CENTER,
    CHART_CENTER,
    CHART_RADIUS,
    startAngle,
  )
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0

  return [
    `M ${CHART_CENTER} ${CHART_CENTER}`,
    `L ${start.x} ${start.y}`,
    `A ${CHART_RADIUS} ${CHART_RADIUS} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    'Z',
  ].join(' ')
}

export function CategoryPieChart({ items }: CategoryPieChartProps) {
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

    function syncChartSize() {
      const legendHeight = legend.offsetHeight
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
      path: buildSlicePath(startAngle, endAngle, items.length === 1),
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
    <div className="category-pie-chart">
      <div className="category-pie-chart-aside">
        <div
          className="category-pie-chart-visual"
          ref={visualRef}
          style={{
            width: visualSize,
            height: visualSize,
          }}
        >
        <svg
          className="category-pie-chart-svg"
          viewBox={`0 0 ${MIN_CHART_SIZE} ${MIN_CHART_SIZE}`}
          role="img"
          aria-label="Круговая диаграмма расходов по категориям"
        >
          {slices.map((slice) => {
            const isActive = activeCategory === slice.category
            const isDimmed = activeCategory !== null && !isActive

            return (
              <path
                key={slice.category}
                d={slice.path}
                fill={slice.color}
                stroke="var(--surface)"
                strokeWidth="2"
                className={[
                  'category-pie-chart-slice',
                  isActive ? 'is-active' : '',
                  isDimmed ? 'is-dimmed' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onMouseEnter={(event) => handleSliceEnter(slice.category, event)}
                onMouseMove={handleSliceMove}
                onMouseLeave={handleSliceLeave}
              />
            )
          })}
        </svg>

        {activeSlice && tooltipPosition && (
          <div
            className="category-pie-chart-tooltip"
            style={{
              left: tooltipPosition.x,
              top: tooltipPosition.y,
            }}
            role="tooltip"
          >
            <span
              className="category-pie-chart-tooltip-swatch"
              style={{ backgroundColor: activeSlice.color }}
              aria-hidden="true"
            />
            <div className="category-pie-chart-tooltip-content">
              <strong className="category-pie-chart-tooltip-name">
                {activeSlice.category}
              </strong>
              <span className="category-pie-chart-tooltip-amount">
                {amountFormatter.format(activeSlice.amount)}
              </span>
              <span className="category-pie-chart-tooltip-percent">
                {percentFormatter.format(activeSlice.percentage)}%
              </span>
            </div>
          </div>
        )}

        <div className="category-pie-chart-center">
          <span className="category-pie-chart-center-label">Всего</span>
          <strong className="category-pie-chart-center-value">
            {amountFormatter.format(totalAmount)}
          </strong>
        </div>
        </div>
      </div>

      <ul className="category-pie-chart-legend" ref={legendRef}>
        {items.map((item) => (
          <li
            key={item.category}
            className={[
              'category-pie-chart-legend-item',
              activeCategory === item.category ? 'is-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onMouseEnter={() => setActiveCategory(item.category)}
            onMouseLeave={() => setActiveCategory(null)}
          >
            <span
              className="category-pie-chart-legend-swatch"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            <span className="category-pie-chart-legend-name">{item.category}</span>
            <div className="category-pie-chart-legend-meta">
              <span className="category-pie-chart-legend-amount">
                {amountFormatter.format(item.amount)}
              </span>
              <span className="category-pie-chart-legend-percent">
                {percentFormatter.format(item.percentage)}%
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
