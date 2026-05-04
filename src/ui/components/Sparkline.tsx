import { useMemo } from 'react';

type SparkStatus = 'good' | 'warn' | 'bad' | 'unknown' | 'neutral';

const STROKE: Record<SparkStatus, string> = {
  good:    'stroke-[var(--status-success)]',
  warn:    'stroke-[var(--status-warning)]',
  bad:     'stroke-[var(--status-danger)]',
  unknown: 'stroke-muted-foreground/50',
  neutral: 'stroke-foreground/55',
};

const FILL: Record<SparkStatus, string> = {
  good:    'fill-[var(--status-success)]',
  warn:    'fill-[var(--status-warning)]',
  bad:     'fill-[var(--status-danger)]',
  unknown: 'fill-muted-foreground/40',
  neutral: 'fill-foreground/40',
};

interface Props {
  /** 시계열 값. null = 결측 (점 끊김). */
  data: readonly (number | null)[];
  width?: number;
  height?: number;
  status?: SparkStatus;
  /** 채움 영역 (밑면). */
  fill?: boolean;
  /** 0~1 범위에서 임계 가로선. */
  threshold?: number;
  /** [min, max] 강제 — 미지정 시 데이터 자동. */
  domain?: readonly [number, number];
  /** 끝점 dot. */
  endDot?: boolean;
  className?: string;
  /** 부모 컨테이너 100% width/height 로 늘림. true 면 width/height props 는 viewBox 기준값 (좌표계). */
  fillContainer?: boolean;
  /** 보존 — 직접 색을 강제하고 싶을 때 (legacy). */
  color?: string;
}

export function Sparkline({
  data,
  width = 80,
  height = 20,
  status = 'neutral',
  fill = false,
  threshold,
  domain,
  endDot = false,
  className,
  fillContainer = false,
  color,
}: Props) {
  const { path, areaPath, points, lastPoint, thresholdY, hasData } = useMemo(() => {
    const cleaned = data.filter((v): v is number => v !== null && Number.isFinite(v));
    if (cleaned.length < 2) {
      return { path: '', areaPath: '', points: [], lastPoint: null, thresholdY: null, hasData: false };
    }
    const min = domain ? domain[0] : Math.min(...cleaned);
    const max = domain ? domain[1] : Math.max(...cleaned);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);

    const pts: { x: number; y: number; v: number }[] = [];
    let p = '';
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      if (v === null || !Number.isFinite(v)) continue;
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      pts.push({ x, y, v });
      p += (p === '' ? 'M' : 'L') + `${x.toFixed(1)},${y.toFixed(1)} `;
    }
    const area = pts.length >= 2
      ? `${p} L${pts[pts.length - 1].x.toFixed(1)},${height} L${pts[0].x.toFixed(1)},${height} Z`
      : '';
    const tY = threshold !== undefined
      ? height - ((threshold - min) / range) * height
      : null;

    return {
      path: p.trim(),
      areaPath: area,
      points: pts,
      lastPoint: pts[pts.length - 1] ?? null,
      thresholdY: tY,
      hasData: true,
    };
  }, [data, width, height, threshold, domain]);

  if (!hasData) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className={`block ${className ?? ''}`}
        style={fillContainer
          ? { width: '100%', height: '100%' }
          : { width: '100%', height: `${height}px` }}
      >
        <line
          x1={0} y1={height / 2} x2={width} y2={height / 2}
          className="stroke-muted-foreground/20"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
      </svg>
    );
  }

  const strokeCls = color ? '' : STROKE[status];
  const fillCls = color ? '' : FILL[status];
  const strokeStyle = color ? { stroke: color } : undefined;
  const fillStyle = color ? { fill: color } : undefined;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={`block ${className ?? ''}`}
      style={{ width: '100%', height: className?.includes('h-') ? undefined : `${height}px` }}
    >
      {fill && (
        <path
          d={areaPath}
          className={fillCls}
          style={fillStyle ? { ...fillStyle, opacity: 0.18 } : { opacity: 0.18 }}
        />
      )}
      {thresholdY !== null && (
        <line
          x1={0} y1={thresholdY} x2={width} y2={thresholdY}
          className="stroke-foreground/30"
          strokeWidth={0.75}
          strokeDasharray="2 2"
        />
      )}
      <path
        d={path}
        fill="none"
        className={strokeCls}
        style={strokeStyle}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {endDot && lastPoint && (
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={2}
          className={fillCls}
          style={fillStyle}
        />
      )}
      {points.length === 1 && (
        <circle cx={points[0].x} cy={points[0].y} r={1.5} className={fillCls} style={fillStyle} />
      )}
    </svg>
  );
}
