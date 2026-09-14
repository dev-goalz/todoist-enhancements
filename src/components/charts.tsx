import { useId, useState, type ReactNode } from 'react';

/**
 * The chart pieces the Insights pages are built from.
 *
 * One categorical palette is used everywhere, assigned in a fixed order and
 * never cycled, so a colour always means the same entity. Every mark has a
 * hover read-out, and horizontal bars carry their value as a direct label,
 * which is what keeps the lighter hues readable.
 */

/** Categorical slots, in fixed order. Validated for colour-vision separation. */
export const SERIES = [
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100',
  '#e87ba4', '#008300', '#4a3aa7', '#e34948',
] as const;

export const seriesColor = (index: number): string => SERIES[index % SERIES.length];

/* ------------------------------------------------------------------ */

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** A small trailing mark, such as a trend or a unit. */
  trailing?: ReactNode;
  tone?: 'neutral' | 'accent';
}

/** A single number that answers one question. No plot, so no hover layer. */
export function StatTile({ label, value, hint, trailing, tone = 'neutral' }: StatTileProps) {
  return (
    <div className={`stat${tone === 'accent' ? ' accent' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value}
        {trailing && <span className="stat-trailing">{trailing}</span>}
      </div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  /** Marks the current period, drawn in the accent colour. */
  current?: boolean;
}

interface BarsProps {
  data: BarDatum[];
  height?: number;
  /** How the hovered value is phrased. */
  format?: (value: number, datum: BarDatum) => string;
  /** Only some labels are printed, so the axis never collides with itself. */
  labelEvery?: number;
  emptyLabel?: string;
}

/** Change over time. One series, so no legend: the card title names it. */
export function Bars({
  data, height = 120, format, labelEvery = 1, emptyLabel,
}: BarsProps) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();

  if (data.length === 0) return <p className="chart-empty">{emptyLabel}</p>;

  const max = Math.max(1, ...data.map((d) => d.value));
  const shown = hover === null ? null : data[hover];

  return (
    <div className="chart">
      <div className="chart-plot" style={{ height }} role="img" aria-labelledby={id}>
        {data.map((datum, index) => (
          <button
            key={datum.key}
            className={`bar${datum.current ? ' current' : ''}${hover === index ? ' hovered' : ''}`}
            style={{ height: `${Math.max(2, (datum.value / max) * 100)}%` }}
            onMouseEnter={() => setHover(index)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(index)}
            onBlur={() => setHover(null)}
            aria-label={`${datum.label}: ${format ? format(datum.value, datum) : datum.value}`}
          />
        ))}
      </div>

      <div className="chart-axis">
        {data.map((datum, index) => (
          <span key={datum.key}>{index % labelEvery === 0 ? datum.label : ''}</span>
        ))}
      </div>

      <p className="chart-readout" id={id} aria-live="polite">
        {shown
          ? `${shown.label} · ${format ? format(shown.value, shown) : shown.value}`
          : ' '}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export interface RankedDatum {
  key: string;
  label: string;
  value: number;
  /** Overrides the palette when the entity already owns a colour. */
  color?: string;
}

interface RankedBarsProps {
  data: RankedDatum[];
  format?: (value: number) => string;
  max?: number;
  emptyLabel?: string;
  /** Caps the list and folds the rest into one row. */
  limit?: number;
  otherLabel?: string;
}

/**
 * Magnitude across named things.
 *
 * Values are printed beside every bar, which is what lets the lighter hues in
 * the palette carry meaning without relying on colour alone.
 */
export function RankedBars({
  data, format, max, emptyLabel, limit, otherLabel = 'Other',
}: RankedBarsProps) {
  if (data.length === 0) return <p className="chart-empty">{emptyLabel}</p>;

  let rows = data;
  if (limit && data.length > limit) {
    const head = data.slice(0, limit);
    const tail = data.slice(limit);
    rows = [
      ...head,
      {
        key: 'other',
        label: otherLabel,
        value: tail.reduce((a, b) => a + b.value, 0),
        color: 'var(--faint)',
      },
    ];
  }

  const ceiling = max ?? Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className="ranked">
      {rows.map((row, index) => (
        <div className="rankedrow" key={row.key}>
          <span className="rankedlabel" title={row.label}>{row.label}</span>
          <span className="rankedtrack">
            <i
              style={{
                width: `${Math.max(2, (row.value / ceiling) * 100)}%`,
                background: row.color ?? seriesColor(index),
              }}
            />
          </span>
          <b className="rankedvalue">{format ? format(row.value) : row.value}</b>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface RingProps {
  percentage: number;
  label: string;
  caption?: string;
  color?: string;
}

/** A single proportion, stated as a number with the arc as support. */
export function Ring({ percentage, label, caption, color }: RingProps) {
  const safe = Math.max(0, Math.min(100, percentage));
  return (
    <div className="ringstat">
      <div
        className="ring"
        style={{ '--ring': `${safe}%`, '--ringcolor': color ?? SERIES[0] } as React.CSSProperties}
      >
        <div><strong>{safe}%</strong></div>
      </div>
      <div className="ringtext">
        <span className="stat-label">{label}</span>
        {caption && <span className="stat-hint">{caption}</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface CardProps {
  title: string;
  subtitle?: string;
  span?: 3 | 4 | 6 | 8 | 12;
  trailing?: ReactNode;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, span = 6, trailing, children }: CardProps) {
  return (
    <section className={`card w${span}`}>
      <div className="chead-row">
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="psub">{subtitle}</p>}
        </div>
        {trailing}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */

export interface SliceDatum {
  key: string;
  label: string;
  value: number;
  /** Overrides the palette when the entity already owns a colour. */
  color?: string;
}

interface DonutProps {
  data: SliceDatum[];
  /** Printed in the hole, above the caption. */
  total?: ReactNode;
  caption?: string;
  emptyLabel?: string;
  /** Slices beyond this fold into one "other" row. */
  limit?: number;
  otherLabel?: string;
  format?: (value: number) => string;
}

/**
 * A part-to-whole split.
 *
 * The arc carries the shape of the split and the legend carries the numbers:
 * every slice is named, valued and given its share in text, so the reading
 * never depends on telling two hues apart. Segments are separated by a 2px
 * surface gap rather than a stroke, which keeps thin slices legible.
 */
export function Donut({
  data, total, caption, emptyLabel, limit, otherLabel = 'Other', format,
}: DonutProps) {
  const [hover, setHover] = useState<string | null>(null);

  const rows = foldTail(data, limit, otherLabel);
  const sum = rows.reduce((acc, row) => acc + row.value, 0);
  if (rows.length === 0 || sum === 0) return <p className="chart-empty">{emptyLabel}</p>;

  // A 42-radius circle in a 100 box: the arc is drawn as a dashed stroke, so
  // the gap between slices is simply a shortened dash.
  const R = 42;
  const C = 2 * Math.PI * R;
  const GAP = 2;

  let offset = 0;
  const arcs = rows.map((row, index) => {
    const length = (row.value / sum) * C;
    const arc = {
      ...row,
      color: row.color ?? seriesColor(index),
      share: Math.round((row.value / sum) * 100),
      dash: Math.max(1, length - GAP),
      rest: C - Math.max(1, length - GAP),
      offset,
    };
    offset -= length;
    return arc;
  });

  return (
    <div className="donut">
      <div className="donutplot">
        <svg viewBox="0 0 100 100" role="img" aria-label={caption ?? ''}>
          <circle className="donuttrack" cx="50" cy="50" r={R} />
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx="50"
              cy="50"
              r={R}
              stroke={arc.color}
              strokeDasharray={`${arc.dash} ${arc.rest}`}
              strokeDashoffset={arc.offset}
              className={`donutarc${hover && hover !== arc.key ? ' dim' : ''}`}
              onMouseEnter={() => setHover(arc.key)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        {total !== undefined && (
          <div className="donutcentre">
            <strong>{total}</strong>
            {caption && <span>{caption}</span>}
          </div>
        )}
      </div>

      <ul className="legend">
        {arcs.map((arc) => (
          <li
            key={arc.key}
            className={hover && hover !== arc.key ? 'dim' : undefined}
            onMouseEnter={() => setHover(arc.key)}
            onMouseLeave={() => setHover(null)}
          >
            <i style={{ background: arc.color }} />
            <span className="legendname" title={arc.label}>{arc.label}</span>
            <b>{format ? format(arc.value) : arc.value}</b>
            <span className="legendshare">{arc.share}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Caps a list and sums whatever is left into one trailing row. */
function foldTail<T extends { key: string; label: string; value: number; color?: string }>(
  data: T[], limit: number | undefined, otherLabel: string,
): Array<{ key: string; label: string; value: number; color?: string }> {
  const rows = data.filter((row) => row.value > 0);
  if (!limit || rows.length <= limit) return rows;
  const tail = rows.slice(limit);
  return [
    ...rows.slice(0, limit),
    {
      key: 'other',
      label: otherLabel,
      value: tail.reduce((acc, row) => acc + row.value, 0),
      color: 'var(--faint)',
    },
  ];
}

/* ------------------------------------------------------------------ */

interface SplitBarProps {
  data: SliceDatum[];
  format?: (value: number) => string;
}

/**
 * One horizontal bar split into its parts, with every part named underneath.
 *
 * This is the Figma focus-score mark: the bar shows the balance at a glance
 * and the legend states it, which is what lets the grey P4 segment carry
 * meaning without relying on its hue.
 */
export function SplitBar({ data, format }: SplitBarProps) {
  const sum = data.reduce((acc, row) => acc + row.value, 0);
  return (
    <div className="split">
      <div className="splitbar">
        {sum === 0
          ? <i style={{ width: '100%', background: 'var(--c-track)' }} />
          : data
            .filter((row) => row.value > 0)
            .map((row, index) => (
              <i
                key={row.key}
                style={{
                  width: `${(row.value / sum) * 100}%`,
                  background: row.color ?? seriesColor(index),
                }}
                title={`${row.label}: ${format ? format(row.value) : row.value}`}
              />
            ))}
      </div>
      <ul className="legend inline">
        {data.map((row, index) => (
          <li key={row.key}>
            <i style={{ background: row.color ?? seriesColor(index) }} />
            <span className="legendname">{row.label}</span>
            <b>{format ? format(row.value) : row.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export interface CompareDatum extends BarDatum {
  /** The same slot one period earlier, drawn as a dot above the bar. */
  previous?: number;
}

interface CompareBarsProps {
  data: CompareDatum[];
  height?: number;
  format?: (value: number) => string;
  labelEvery?: number;
  emptyLabel?: string;
  /** Names the two marks, which is what keeps them apart. */
  currentLabel: string;
  previousLabel: string;
}

/**
 * This period against the one before it.
 *
 * Both series share one axis — never two scales. The current period is a
 * filled bar and the earlier one a dot at the same height, so the comparison
 * is read as a position, not as a second colour.
 */
export function CompareBars({
  data, height = 150, format, labelEvery = 1, emptyLabel,
  currentLabel, previousLabel,
}: CompareBarsProps) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();

  if (data.length === 0) return <p className="chart-empty">{emptyLabel}</p>;

  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.previous ?? 0)));
  const shown = hover === null ? null : data[hover];
  const fmt = (value: number) => (format ? format(value) : String(value));

  return (
    <div className="chart">
      <div className="chart-plot compare" style={{ height }} role="img" aria-labelledby={id}>
        {data.map((datum, index) => (
          <button
            key={datum.key}
            className={`slot${hover === index ? ' hovered' : ''}`}
            onMouseEnter={() => setHover(index)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(index)}
            onBlur={() => setHover(null)}
            aria-label={
              `${datum.label}: ${currentLabel} ${fmt(datum.value)}`
              + (datum.previous === undefined ? '' : `, ${previousLabel} ${fmt(datum.previous)}`)
            }
          >
            <i
              className={`bar${datum.current ? ' current' : ''}`}
              style={{ height: `${Math.max(2, (datum.value / max) * 100)}%` }}
            />
            {datum.previous !== undefined && (
              <s className="ghostdot" style={{ bottom: `${(datum.previous / max) * 100}%` }} />
            )}
          </button>
        ))}
      </div>

      <div className="chart-axis">
        {data.map((datum, index) => (
          <span key={datum.key}>{index % labelEvery === 0 ? datum.label : ''}</span>
        ))}
      </div>

      <ul className="legend inline">
        <li><i className="swatch-bar" /><span className="legendname">{currentLabel}</span></li>
        <li><i className="swatch-dot" /><span className="legendname">{previousLabel}</span></li>
      </ul>

      <p className="chart-readout" id={id} aria-live="polite">
        {shown
          ? `${shown.label} · ${currentLabel} ${fmt(shown.value)}`
            + (shown.previous === undefined ? '' : ` · ${previousLabel} ${fmt(shown.previous)}`)
          : ' '}
      </p>
    </div>
  );
}
