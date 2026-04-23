interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

export function Sparkline({ values, width = 64, height = 20, color = '#6B7280', className }: SparklineProps) {
  if (!values.length) return <svg width={width} height={height} className={className} />;
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;
  
  const points = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * (width - pad * 2) + pad;
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
