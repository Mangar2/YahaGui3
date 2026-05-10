import { useEffect, useMemo, useRef, useState, type JSX, type MouseEvent as ReactMouseEvent } from 'react';
import type { MessageHistoryEntry, MessageReason, MessageScalar, MessageTreeNode } from '../../../domain/messages/interfaces';

interface DetailLineChartProps {
  activeNode: MessageTreeNode | null;
}

type ChartRangePreset = 'all' | '1d' | '7d' | '30d';

interface ChartPoint {
  timestampMs: number;
  value: number;
  timeLabel: string;
  reasonLabel: string;
}

interface ChartBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface ChartRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const RANGE_OPTIONS: readonly { key: ChartRangePreset; label: string }[] = [
  { key: '1d', label: '24h' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: 'all', label: 'Alles' },
] as const;

const CHART_HEIGHT = 270;
const CHART_PADDING = { top: 20, right: 16, bottom: 34, left: 56 } as const;

/**
 * Renders a responsive line chart for detail history with adaptive time-axis formatting.
 * @param props Component props.
 * @returns {JSX.Element} Chart section.
 */
export function DetailLineChart(props: DetailLineChartProps): JSX.Element {
  const { activeNode } = props;
  const [rangePreset, setRangePreset] = useState<ChartRangePreset>('7d');
  const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(680);

  useEffect((): (() => void) => {
    const host = containerRef.current;
    if (!host) {
      return (): void => {
        return;
      };
    }

    const observer = new ResizeObserver((entries: ResizeObserverEntry[]): void => {
      const nextWidth = Math.floor(entries[0]?.contentRect.width ?? 680);
      setContainerWidth(nextWidth > 0 ? nextWidth : 680);
    });
    observer.observe(host);

    return (): void => {
      observer.disconnect();
    };
  }, []);

  const allPoints = useMemo((): ChartPoint[] => {
    return buildChartPoints(activeNode);
  }, [activeNode]);

  const filteredPoints = useMemo((): ChartPoint[] => {
    return filterPointsByRange(allPoints, rangePreset);
  }, [allPoints, rangePreset]);

  useEffect((): void => {
    setHoveredPoint(null);
    setHoverX(0);
  }, [rangePreset, filteredPoints.length]);

  const innerRect = useMemo((): ChartRect => {
    const width = Math.max(120, containerWidth - CHART_PADDING.left - CHART_PADDING.right);
    const height = Math.max(120, CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom);
    return {
      left: CHART_PADDING.left,
      top: CHART_PADDING.top,
      width,
      height,
    };
  }, [containerWidth]);

  const chartBounds = useMemo((): ChartBounds | null => {
    return calculateBounds(filteredPoints);
  }, [filteredPoints]);

  const xTicks = useMemo((): number[] => {
    if (!chartBounds) {
      return [];
    }
    const tickAmount = clamp(Math.floor(innerRect.width / 110), 2, 9);
    return createTicks(chartBounds.minX, chartBounds.maxX, tickAmount);
  }, [chartBounds, innerRect.width]);

  const yTicks = useMemo((): number[] => {
    if (!chartBounds) {
      return [];
    }
    const maxTickAmount = clamp(Math.floor(innerRect.height / 48), 3, 8);
    return createNiceYAxisTicks(chartBounds.minY, chartBounds.maxY, maxTickAmount);
  }, [chartBounds, innerRect.height]);

  const linePath = useMemo((): string => {
    if (!chartBounds || filteredPoints.length === 0) {
      return '';
    }
    return buildLinePath(filteredPoints, chartBounds, innerRect);
  }, [chartBounds, filteredPoints, innerRect]);

  const areaPath = useMemo((): string => {
    if (!chartBounds || filteredPoints.length === 0) {
      return '';
    }
    return buildAreaPath(filteredPoints, chartBounds, innerRect);
  }, [chartBounds, filteredPoints, innerRect]);

  /**
   * Tracks pointer movement and snaps tooltip to nearest sample.
   * @param event Pointer move event.
   */
  function handleMouseMove(event: ReactMouseEvent<SVGRectElement>): void {
    if (!chartBounds || filteredPoints.length === 0) {
      return;
    }

    const targetRect = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - targetRect.left;
    const clampedX = clamp(pointerX, 0, innerRect.width);
    const nearest = findNearestPoint(filteredPoints, chartBounds, innerRect, clampedX);
    setHoveredPoint(nearest);
    setHoverX(scaleX(nearest.timestampMs, chartBounds, innerRect));
  }

  /**
   * Clears hover decoration when pointer leaves chart area.
   */
  function handleMouseLeave(): void {
    setHoveredPoint(null);
  }

  const rangeSummary = buildRangeSummary(filteredPoints);
  const xSpanMs = chartBounds ? chartBounds.maxX - chartBounds.minX : 0;
  const pointRadius = filteredPoints.length > 160 ? 0 : 2.4;
  const svgRenderKey = useMemo((): string => {
    const firstPoint = filteredPoints[0];
    const lastPoint = filteredPoints[filteredPoints.length - 1];
    const firstTimestamp = firstPoint ? String(firstPoint.timestampMs) : 'none';
    const lastTimestamp = lastPoint ? String(lastPoint.timestampMs) : 'none';
    const boundsKey = chartBounds
      ? `${String(chartBounds.minX)}-${String(chartBounds.maxX)}-${String(chartBounds.minY)}-${String(chartBounds.maxY)}`
      : 'no-bounds';
    return `${rangePreset}-${String(containerWidth)}-${String(filteredPoints.length)}-${firstTimestamp}-${lastTimestamp}-${boundsKey}`;
  }, [chartBounds, containerWidth, filteredPoints, rangePreset]);

  return (
    <section className="detail-line-chart" aria-label="Zeitverlauf">
      <header className="detail-line-chart-header">
        <h3>Line Chart</h3>
        <div className="detail-line-chart-controls" role="group" aria-label="Zeitbereich Auswahl">
          {RANGE_OPTIONS.map((option): JSX.Element => {
            const isActive = option.key === rangePreset;
            return (
              <button
                key={option.key}
                type="button"
                className={`detail-line-chart-range-button${isActive ? ' is-active' : ''}`}
                aria-pressed={isActive}
                onClick={(): void => {
                  setRangePreset(option.key);
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </header>

      <p className="detail-line-chart-summary">{rangeSummary}</p>

      <div className="detail-line-chart-canvas" ref={containerRef}>
        {filteredPoints.length === 0 ? (
          <p className="detail-line-chart-empty">Keine numerischen Verlaufspunkte verfuegbar.</p>
        ) : (
          <svg
            key={svgRenderKey}
            viewBox={`0 0 ${String(containerWidth)} ${String(CHART_HEIGHT)}`}
            role="img"
            aria-label="Historischer Werteverlauf"
          >
            <defs>
              <linearGradient id="detail-chart-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(21, 128, 61, 0.3)" />
                <stop offset="100%" stopColor="rgba(21, 128, 61, 0.02)" />
              </linearGradient>
            </defs>

            <g transform={`translate(${String(innerRect.left)} ${String(innerRect.top)})`}>
              <rect x={0} y={0} width={innerRect.width} height={innerRect.height} className="detail-line-chart-plot-bg" />

              {yTicks.map((tickValue): JSX.Element => {
                const y = scaleY(tickValue, chartBounds, innerRect);
                return (
                  <g key={`y-${String(tickValue)}`}>
                    <line className="detail-line-chart-grid" x1={0} x2={innerRect.width} y1={y} y2={y} />
                    <text className="detail-line-chart-axis-text" x={-10} y={y + 4} textAnchor="end">
                      {formatYAxisLabel(tickValue)}
                    </text>
                  </g>
                );
              })}

              {xTicks.map((tickValue): JSX.Element => {
                const x = scaleX(tickValue, chartBounds, innerRect);
                return (
                  <g key={`x-${String(tickValue)}`}>
                    <line className="detail-line-chart-grid detail-line-chart-grid-x" x1={x} x2={x} y1={0} y2={innerRect.height} />
                    <text className="detail-line-chart-axis-text" x={x} y={innerRect.height + 18} textAnchor="middle">
                      {formatXAxisLabel(tickValue, xSpanMs)}
                    </text>
                  </g>
                );
              })}

              {areaPath.length > 0 ? <path className="detail-line-chart-area" d={areaPath} /> : null}
              {linePath.length > 0 ? <path className="detail-line-chart-line" d={linePath} /> : null}

              {pointRadius > 0
                ? filteredPoints.map((point: ChartPoint, index: number): JSX.Element => {
                    return (
                      <circle
                        key={`${String(point.timestampMs)}-${String(point.value)}-${String(index)}`}
                        className="detail-line-chart-point"
                        cx={scaleX(point.timestampMs, chartBounds, innerRect)}
                        cy={scaleY(point.value, chartBounds, innerRect)}
                        r={pointRadius}
                      />
                    );
                  })
                : null}

              {hoveredPoint ? (
                <>
                  <line className="detail-line-chart-hover-line" x1={hoverX} x2={hoverX} y1={0} y2={innerRect.height} />
                  <circle
                    className="detail-line-chart-hover-point"
                    cx={hoverX}
                    cy={scaleY(hoveredPoint.value, chartBounds, innerRect)}
                    r={4}
                  />
                </>
              ) : null}

              <rect
                x={0}
                y={0}
                width={innerRect.width}
                height={innerRect.height}
                fill="transparent"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              />
            </g>
          </svg>
        )}

        {hoveredPoint ? (
          <div className="detail-line-chart-tooltip" role="status" aria-live="polite">
            <p>{hoveredPoint.timeLabel}</p>
            <p>Wert: {formatYAxisLabel(hoveredPoint.value)}</p>
            <p>{hoveredPoint.reasonLabel}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Converts node value and history entries into sorted numeric chart points.
 * @param activeNode Currently selected node.
 * @returns {ChartPoint[]} Sorted chart points.
 */
function buildChartPoints(activeNode: MessageTreeNode | null): ChartPoint[] {
  if (!activeNode) {
    return [];
  }

  const result: ChartPoint[] = [];
  const headEntry: MessageHistoryEntry = {
    time: activeNode.time,
    value: activeNode.value,
    reason: activeNode.reason,
  };
  pushChartPoint(result, headEntry);

  const historyEntries = Array.isArray(activeNode.history) ? activeNode.history : [];
  for (const entry of historyEntries) {
    pushChartPoint(result, entry);
  }

  result.sort((left: ChartPoint, right: ChartPoint): number => left.timestampMs - right.timestampMs);
  return result;
}

/**
 * Converts one history entry into a chart point and appends it when valid.
 * @param result Mutable result list.
 * @param entry History entry candidate.
 */
function pushChartPoint(result: ChartPoint[], entry: MessageHistoryEntry): void {
  if (!entry.time) {
    return;
  }

  const timestampMs = Date.parse(entry.time);
  if (!Number.isFinite(timestampMs)) {
    return;
  }

  const numericValue = parseNumericValue(entry.value);
  if (numericValue === null) {
    return;
  }

  result.push({
    timestampMs,
    value: numericValue,
    timeLabel: formatDetailedTime(entry.time),
    reasonLabel: buildReasonLabel(entry.reason),
  });
}

/**
 * Converts scalar payload values to numeric values for charting.
 * @param value Message value from backend.
 * @returns {number | null} Numeric value when conversion is possible.
 */
function parseNumericValue(value: MessageScalar | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (typeof value === 'string') {
    const normalizedValue = value.trim().replace(',', '.');
    if (normalizedValue.length === 0) {
      return null;
    }
    const numericValue = Number(normalizedValue);
    return Number.isFinite(numericValue) ? numericValue : null;
  }
  return null;
}

/**
 * Filters points by active range preset while preserving chronological order.
 * @param points Full point list.
 * @param rangePreset Selected range preset.
 * @returns {ChartPoint[]} Filtered points.
 */
function filterPointsByRange(points: ChartPoint[], rangePreset: ChartRangePreset): ChartPoint[] {
  if (points.length === 0 || rangePreset === 'all') {
    return points;
  }

  const rangeMs = getRangeDurationMs(rangePreset);
  const maxTimestamp = points[points.length - 1]?.timestampMs;
  if (maxTimestamp === undefined) {
    return points;
  }

  const minAllowed = maxTimestamp - rangeMs;
  return points.filter((point: ChartPoint): boolean => point.timestampMs >= minAllowed);
}

/**
 * Maps range preset keys to their duration in milliseconds.
 * @param rangePreset Selected range key.
 * @returns {number} Duration in milliseconds.
 */
function getRangeDurationMs(rangePreset: Exclude<ChartRangePreset, 'all'>): number {
  const day = 24 * 60 * 60 * 1000;
  if (rangePreset === '1d') {
    return day;
  }
  if (rangePreset === '7d') {
    return 7 * day;
  }
  return 30 * day;
}

/**
 * Calculates padded axis bounds for X and Y values.
 * @param points Visible chart points.
 * @returns {ChartBounds | null} Bounds object or null when no data exists.
 */
function calculateBounds(points: ChartPoint[]): ChartBounds | null {
  if (points.length === 0) {
    return null;
  }

  const firstTimestamp = points[0]?.timestampMs;
  const lastTimestamp = points[points.length - 1]?.timestampMs;
  if (firstTimestamp === undefined || lastTimestamp === undefined) {
    return null;
  }

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minY = Math.min(minY, point.value);
    maxY = Math.max(maxY, point.value);
  }

  const xPadding = Math.max(60 * 1000, (lastTimestamp - firstTimestamp) * 0.03);

  const yLowerBound = Math.min(minY, maxY);
  const yUpperBound = Math.max(minY, maxY);

  return {
    minX: firstTimestamp - xPadding,
    maxX: lastTimestamp + xPadding,
    minY: yLowerBound,
    maxY: yUpperBound,
  };
}

/**
 * Builds readable Y-axis ticks using rounded "nice" step values.
 * @param minValue Minimum numeric value in the visible range.
 * @param maxValue Maximum numeric value in the visible range.
 * @param maxTickAmount Upper bound for tick amount based on available chart height.
 * @returns {number[]} Rounded Y-axis ticks.
 */
function createNiceYAxisTicks(minValue: number, maxValue: number, maxTickAmount: number): number[] {
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
    return [];
  }

  const safeMaxTickAmount = Math.max(3, maxTickAmount);
  const span = Math.abs(maxValue - minValue);

  if (span < Number.EPSILON) {
    const absoluteValue = Math.abs(minValue);
    const fallbackStep = absoluteValue > 0 ? niceNumber(absoluteValue * 0.25, true) : 1;
    return [minValue - fallbackStep, minValue, minValue + fallbackStep];
  }

  const roughStep = span / (safeMaxTickAmount - 1);
  const niceStep = niceNumber(roughStep, true);
  const niceMin = Math.floor(minValue / niceStep) * niceStep;
  const niceMax = Math.ceil(maxValue / niceStep) * niceStep;

  const ticks: number[] = [];
  const maxLoopCount = 256;
  let cursor = niceMin;
  let loopCounter = 0;
  while (cursor <= niceMax + niceStep * 0.5 && loopCounter < maxLoopCount) {
    ticks.push(roundToStepPrecision(cursor, niceStep));
    cursor += niceStep;
    loopCounter += 1;
  }

  if (ticks.length >= 2) {
    return ticks;
  }
  return [niceMin, niceMax];
}

/**
 * Calculates a rounded step size based on classic nice-number scaling.
 * @param value Raw step value.
 * @param roundStep Whether rounding (true) or ceiling (false) should be applied.
 * @returns {number} Nice rounded step size.
 */
function niceNumber(value: number, roundStep: boolean): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  let niceFraction = 1;

  if (roundStep) {
    if (fraction < 1.5) {
      niceFraction = 1;
    } else if (fraction < 3) {
      niceFraction = 2;
    } else if (fraction < 7) {
      niceFraction = 5;
    } else {
      niceFraction = 10;
    }
  } else if (fraction <= 1) {
    niceFraction = 1;
  } else if (fraction <= 2) {
    niceFraction = 2;
  } else if (fraction <= 5) {
    niceFraction = 5;
  } else {
    niceFraction = 10;
  }

  return niceFraction * 10 ** exponent;
}

/**
 * Rounds tick values according to step precision to avoid floating-point artifacts.
 * @param value Tick candidate value.
 * @param step Step width used for axis ticks.
 * @returns {number} Rounded tick value.
 */
function roundToStepPrecision(value: number, step: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) {
    return value;
  }

  const stepExponent = Math.floor(Math.log10(step));
  const decimals = Math.max(0, -stepExponent + 1);
  return Number(value.toFixed(decimals));
}

/**
 * Creates a path string for the line itself.
 * @param points Visible chart points.
 * @param bounds Axis bounds.
 * @param rect Inner chart rectangle.
 * @returns {string} SVG path string.
 */
function buildLinePath(points: ChartPoint[], bounds: ChartBounds, rect: ChartRect): string {
  return points
    .map((point: ChartPoint, index: number): string => {
      const x = scaleX(point.timestampMs, bounds, rect);
      const y = scaleY(point.value, bounds, rect);
      return `${index === 0 ? 'M' : 'L'} ${String(x)} ${String(y)}`;
    })
    .join(' ');
}

/**
 * Creates a filled area path below the line.
 * @param points Visible chart points.
 * @param bounds Axis bounds.
 * @param rect Inner chart rectangle.
 * @returns {string} SVG area path string.
 */
function buildAreaPath(points: ChartPoint[], bounds: ChartBounds, rect: ChartRect): string {
  if (points.length === 0) {
    return '';
  }

  const linePath = buildLinePath(points, bounds, rect);
  const firstX = scaleX(points[0]?.timestampMs ?? bounds.minX, bounds, rect);
  const lastX = scaleX(points[points.length - 1]?.timestampMs ?? bounds.maxX, bounds, rect);
  return `${linePath} L ${String(lastX)} ${String(rect.height)} L ${String(firstX)} ${String(rect.height)} Z`;
}

/**
 * Scales a timestamp to chart X coordinate.
 * @param timestampMs Timestamp in milliseconds.
 * @param bounds Axis bounds.
 * @param rect Inner chart rectangle.
 * @returns {number} X coordinate.
 */
function scaleX(timestampMs: number, bounds: ChartBounds, rect: ChartRect): number {
  const denominator = Math.max(1, bounds.maxX - bounds.minX);
  const factor = (timestampMs - bounds.minX) / denominator;
  return factor * rect.width;
}

/**
 * Scales a numeric value to chart Y coordinate.
 * @param value Numeric value.
 * @param bounds Axis bounds.
 * @param rect Inner chart rectangle.
 * @returns {number} Y coordinate.
 */
function scaleY(value: number, bounds: ChartBounds, rect: ChartRect): number {
  const denominator = Math.max(1, bounds.maxY - bounds.minY);
  const factor = (value - bounds.minY) / denominator;
  return rect.height - factor * rect.height;
}

/**
 * Generates evenly spaced ticks for an axis.
 * @param minValue Axis minimum value.
 * @param maxValue Axis maximum value.
 * @param amount Desired amount of ticks.
 * @returns {number[]} Tick positions.
 */
function createTicks(minValue: number, maxValue: number, amount: number): number[] {
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
    return [];
  }

  if (Math.abs(maxValue - minValue) < 0.000001) {
    return [minValue];
  }

  const safeAmount = Math.max(2, amount);
  const step = (maxValue - minValue) / (safeAmount - 1);
  const result: number[] = [];
  for (let index = 0; index < safeAmount; index += 1) {
    result.push(minValue + step * index);
  }
  return result;
}

/**
 * Finds the nearest point to the current pointer X coordinate.
 * @param points Visible chart points.
 * @param bounds Axis bounds.
 * @param rect Inner chart rectangle.
 * @param pointerX Pointer position on X axis.
 * @returns {ChartPoint} Closest data point.
 */
function findNearestPoint(points: ChartPoint[], bounds: ChartBounds, rect: ChartRect, pointerX: number): ChartPoint {
  const firstPoint = points[0];
  if (!firstPoint) {
    throw new Error('Nearest-point lookup requires at least one chart point.');
  }

  let nearestPoint = firstPoint;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const point of points) {
    const pointX = scaleX(point.timestampMs, bounds, rect);
    const distance = Math.abs(pointX - pointerX);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestPoint = point;
    }
  }

  return nearestPoint;
}

/**
 * Formats the X-axis label according to currently visible time span.
 * @param timestampMs Timestamp in milliseconds.
 * @param spanMs Current visible span in milliseconds.
 * @returns {string} Formatted tick label.
 */
function formatXAxisLabel(timestampMs: number, spanMs: number): string {
  const date = new Date(timestampMs);
  if (spanMs <= 6 * 60 * 60 * 1000) {
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
  if (spanMs <= 3 * 24 * 60 * 60 * 1000) {
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (spanMs <= 90 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  }
  if (spanMs <= 730 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
  }
  return date.toLocaleDateString('de-DE', { year: 'numeric' });
}

/**
 * Formats Y-axis values while keeping labels compact.
 * @param value Numeric axis value.
 * @returns {string} Formatted value label.
 */
function formatYAxisLabel(value: number): string {
  return value.toLocaleString('de-DE', {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

/**
 * Builds a summary text for point count and visible range.
 * @param points Visible chart points.
 * @returns {string} Summary text.
 */
function buildRangeSummary(points: ChartPoint[]): string {
  if (points.length === 0) {
    return 'Keine gueltigen Datenpunkte im gewaehlten Zeitraum.';
  }
  const first = points[0]?.timeLabel ?? 'unbekannt';
  const last = points[points.length - 1]?.timeLabel ?? 'unbekannt';
  return `${String(points.length)} Punkte von ${first} bis ${last}`;
}

/**
 * Formats timestamp for tooltip and summary output.
 * @param timeIso ISO-like timestamp string.
 * @returns {string} Localized date-time string.
 */
function formatDetailedTime(timeIso: string): string {
  const date = new Date(timeIso);
  if (Number.isNaN(date.getTime())) {
    return timeIso;
  }
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Converts reasons array into compact tooltip text.
 * @param reasons Optional reason list.
 * @returns {string} Reason text.
 */
function buildReasonLabel(reasons: MessageReason[] | undefined): string {
  if (!Array.isArray(reasons) || reasons.length === 0) {
    return 'Grund: Updated';
  }
  const joined = reasons.map((entry: MessageReason): string => entry.message).join(' | ');
  return `Grund: ${joined}`;
}

/**
 * Clamps a number between minimum and maximum values.
 * @param value Candidate value.
 * @param minValue Minimum allowed value.
 * @param maxValue Maximum allowed value.
 * @returns {number} Clamped value.
 */
function clamp(value: number, minValue: number, maxValue: number): number {
  return Math.min(maxValue, Math.max(minValue, value));
}