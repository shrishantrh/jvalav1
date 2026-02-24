import { cn } from '@/lib/utils';

interface RiskScoreGaugeProps {
  score: number; // 0-100
  size?: 'sm' | 'lg';
}

export const RiskScoreGauge = ({ score, size = 'sm' }: RiskScoreGaugeProps) => {
  const getColor = (s: number) => {
    if (s >= 70) return { stroke: 'hsl(0, 70%, 50%)', label: 'Critical', glow: 'hsl(0, 70%, 50%)' };
    if (s >= 50) return { stroke: 'hsl(25, 85%, 55%)', label: 'High', glow: 'hsl(25, 85%, 55%)' };
    if (s >= 30) return { stroke: 'hsl(45, 85%, 50%)', label: 'Moderate', glow: 'hsl(45, 85%, 50%)' };
    return { stroke: 'hsl(150, 60%, 45%)', label: 'Low', glow: 'hsl(150, 60%, 45%)' };
  };

  const { stroke, label, glow } = getColor(score);
  const isLarge = size === 'lg';
  const radius = isLarge ? 52 : 28;
  const strokeWidth = isLarge ? 8 : 5;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference * 0.75; // 270 degree arc
  const viewBox = isLarge ? 120 : 66;
  const center = viewBox / 2;

  return (
    <div className="relative inline-flex flex-col items-center">
      <svg
        width={isLarge ? 140 : 66}
        height={isLarge ? 100 : 50}
        viewBox={`0 0 ${viewBox} ${viewBox * 0.75}`}
        className="overflow-visible"
      >
        {/* Background arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.25}
          strokeLinecap="round"
          transform={`rotate(135, ${center}, ${center})`}
          className="opacity-30"
        />
        {/* Score arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(135, ${center}, ${center})`}
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 ${isLarge ? 4 : 2}px ${glow})` }}
        />
        {/* Score text */}
        <text
          x={center}
          y={center - (isLarge ? 2 : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-foreground font-bold"
          style={{ fontSize: isLarge ? '22px' : '13px' }}
        >
          {score}
        </text>
        {isLarge && (
          <text
            x={center}
            y={center + 14}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground"
            style={{ fontSize: '9px' }}
          >
            {label} Risk
          </text>
        )}
      </svg>
    </div>
  );
};
