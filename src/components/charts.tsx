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

interface HeatRowProps {
  /** 24 values, one per hour. */
  hours: number[];
  format?: (value: number, hour: number) => string;
}

/** When work actually happens, as one sequential ramp of a single hue. */
export function HourHeat({ hours, format }: HeatRowProps) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...hours);

  return (
    <div className="chart">
      <div className="heatrow">
        {hours.map((value, hour) => (
          <button
            key={hour}
            className="heatcell"
            style={{ opacity: value === 0 ? 0.12 : 0.25 + (value / max) * 0.75 }}
            onMouseEnter={() => setHover(hour)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(hour)}
            onBlur={() => setHover(null)}
            aria-label={format ? format(value, hour) : `${hour}h: ${value}`}
          />
        ))}
      </div>
      <div className="chart-axis heataxis">
        {hours.map((_, hour) => (
          <span key={hour}>{hour % 6 === 0 ? `${hour}h` : ''}</span>
        ))}
      </div>
      <p className="chart-readout" aria-live="polite">
        {hover === null
          ? ' '
          : format
            ? format(hours[hover], hover)
            : `${hover}h · ${hours[hover]}`}
      </p>
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
