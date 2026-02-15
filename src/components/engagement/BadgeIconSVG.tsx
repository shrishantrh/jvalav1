// Custom SVG badge icons replacing Apple emojis
// Each badge gets a unique mini-illustration in the app's pink-purple style

interface BadgeIconSVGProps {
  badgeId: string;
  size?: number;
  className?: string;
}

// Map badge IDs to SVG path generators
const BADGE_ICONS: Record<string, (s: number) => JSX.Element> = {
  // ── MILESTONE ──
  first_log: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-gold)" opacity={0.9}/>
      <path d={`M${s*0.5} ${s*0.22}l${s*0.06} ${s*0.14}h${s*0.15}l-${s*0.12} ${s*0.1} ${s*0.05} ${s*0.14}-${s*0.14}-${s*0.09}-${s*0.14} ${s*0.09} ${s*0.05}-${s*0.14}-${s*0.12}-${s*0.1}h${s*0.15}z`} fill="white"/>
    </g>
  ),
  logs_10: (s) => (
    <g>
      <rect x={s*0.25} y={s*0.2} width={s*0.5} height={s*0.6} rx={s*0.06} fill="url(#grad-pink)"/>
      <line x1={s*0.35} y1={s*0.35} x2={s*0.65} y2={s*0.35} stroke="white" strokeWidth={s*0.04} strokeLinecap="round"/>
      <line x1={s*0.35} y1={s*0.48} x2={s*0.65} y2={s*0.48} stroke="white" strokeWidth={s*0.04} strokeLinecap="round"/>
      <line x1={s*0.35} y1={s*0.61} x2={s*0.55} y2={s*0.61} stroke="white" strokeWidth={s*0.04} strokeLinecap="round"/>
    </g>
  ),
  logs_25: (s) => (
    <g>
      <rect x={s*0.22} y={s*0.18} width={s*0.56} height={s*0.64} rx={s*0.06} fill="url(#grad-purple)"/>
      <rect x={s*0.32} y={s*0.3} width={s*0.12} height={s*0.12} rx={s*0.02} fill="white" opacity={0.9}/>
      <rect x={s*0.48} y={s*0.3} width={s*0.12} height={s*0.12} rx={s*0.02} fill="white" opacity={0.7}/>
      <rect x={s*0.32} y={s*0.46} width={s*0.12} height={s*0.12} rx={s*0.02} fill="white" opacity={0.7}/>
      <rect x={s*0.48} y={s*0.46} width={s*0.12} height={s*0.12} rx={s*0.02} fill="white" opacity={0.5}/>
      <rect x={s*0.32} y={s*0.62} width={s*0.28} height={s*0.04} rx={s*0.02} fill="white" opacity={0.6}/>
    </g>
  ),
  logs_50: (s) => (
    <g>
      <polygon points={`${s/2},${s*0.15} ${s*0.62},${s*0.38} ${s*0.58},${s*0.55} ${s*0.42},${s*0.55} ${s*0.38},${s*0.38}`} fill="url(#grad-gold)"/>
      <circle cx={s/2} cy={s*0.6} r={s*0.2} fill="url(#grad-pink)" opacity={0.9}/>
      <text x={s/2} y={s*0.66} textAnchor="middle" fill="white" fontSize={s*0.18} fontWeight="bold">50</text>
    </g>
  ),
  logs_100: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-purple)" opacity={0.9}/>
      <text x={s/2} y={s*0.56} textAnchor="middle" fill="white" fontSize={s*0.2} fontWeight="bold">100</text>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="none" stroke="white" strokeWidth={s*0.03} opacity={0.4}/>
    </g>
  ),
  logs_250: (s) => (
    <g>
      <circle cx={s/2} cy={s*0.4} r={s*0.28} fill="url(#grad-gold)"/>
      <path d={`M${s*0.35} ${s*0.65}L${s/2} ${s*0.55}L${s*0.65} ${s*0.65}L${s/2} ${s*0.85}Z`} fill="url(#grad-pink)"/>
      <text x={s/2} y={s*0.46} textAnchor="middle" fill="white" fontSize={s*0.14} fontWeight="bold">250</text>
    </g>
  ),
  logs_500: (s) => (
    <g>
      <path d={`M${s/2} ${s*0.12}L${s*0.72} ${s*0.35}L${s*0.65} ${s*0.7}L${s*0.35} ${s*0.7}L${s*0.28} ${s*0.35}Z`} fill="url(#grad-purple)"/>
      <circle cx={s/2} cy={s*0.42} r={s*0.15} fill="white" opacity={0.2}/>
      <text x={s/2} y={s*0.48} textAnchor="middle" fill="white" fontSize={s*0.12} fontWeight="bold">500</text>
    </g>
  ),
  logs_1000: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.4} fill="url(#grad-gold)" opacity={0.9}/>
      <path d={`M${s*0.35} ${s*0.25}L${s/2} ${s*0.18}L${s*0.65} ${s*0.25}L${s*0.6} ${s*0.32}L${s*0.4} ${s*0.32}Z`} fill="white" opacity={0.9}/>
      <text x={s/2} y={s*0.6} textAnchor="middle" fill="white" fontSize={s*0.14} fontWeight="bold">1K</text>
    </g>
  ),
  logs_2500: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.42} fill="url(#grad-gold)"/>
      <circle cx={s/2} cy={s/2} r={s*0.35} fill="none" stroke="white" strokeWidth={s*0.02}/>
      <circle cx={s/2} cy={s/2} r={s*0.28} fill="none" stroke="white" strokeWidth={s*0.02} opacity={0.5}/>
      <path d={`M${s*0.32} ${s*0.38}Q${s/2} ${s*0.15} ${s*0.68} ${s*0.38}`} fill="none" stroke="white" strokeWidth={s*0.04} strokeLinecap="round"/>
      <circle cx={s*0.42} cy={s*0.35} r={s*0.03} fill="white"/>
      <circle cx={s*0.58} cy={s*0.35} r={s*0.03} fill="white"/>
    </g>
  ),

  // ── STREAK ──
  streak_3: (s) => (
    <g>
      <path d={`M${s/2} ${s*0.15}Q${s*0.7} ${s*0.35} ${s*0.6} ${s*0.65}Q${s/2} ${s*0.9} ${s*0.4} ${s*0.65}Q${s*0.3} ${s*0.35} ${s/2} ${s*0.15}Z`} fill="url(#grad-fire)"/>
      <path d={`M${s/2} ${s*0.4}Q${s*0.58} ${s*0.5} ${s*0.55} ${s*0.65}Q${s/2} ${s*0.78} ${s*0.45} ${s*0.65}Q${s*0.42} ${s*0.5} ${s/2} ${s*0.4}Z`} fill="white" opacity={0.4}/>
    </g>
  ),
  streak_7: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.35} fill="url(#grad-pink)"/>
      <path d={`M${s*0.35} ${s*0.45}L${s*0.42} ${s*0.55}L${s*0.48} ${s*0.4}L${s*0.55} ${s*0.6}L${s*0.65} ${s*0.35}`} fill="none" stroke="white" strokeWidth={s*0.04} strokeLinecap="round" strokeLinejoin="round"/>
    </g>
  ),
  streak_14: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-purple)"/>
      <path d={`M${s/2} ${s*0.22}L${s/2} ${s*0.5}M${s*0.35} ${s*0.5}L${s*0.65} ${s*0.5}M${s/2} ${s*0.5}L${s*0.62} ${s*0.7}M${s/2} ${s*0.5}L${s*0.38} ${s*0.7}`} stroke="white" strokeWidth={s*0.035} strokeLinecap="round"/>
    </g>
  ),
  streak_21: (s) => (
    <g>
      <rect x={s*0.2} y={s*0.3} width={s*0.6} height={s*0.45} rx={s*0.06} fill="url(#grad-pink)"/>
      <rect x={s*0.28} y={s*0.4} width={s*0.14} height={s*0.1} rx={s*0.02} fill="white" opacity={0.8}/>
      <rect x={s*0.44} y={s*0.4} width={s*0.14} height={s*0.1} rx={s*0.02} fill="white" opacity={0.6}/>
      <rect x={s*0.28} y={s*0.54} width={s*0.14} height={s*0.1} rx={s*0.02} fill="white" opacity={0.6}/>
      <rect x={s*0.44} y={s*0.54} width={s*0.14} height={s*0.1} rx={s*0.02} fill="white" opacity={0.4}/>
      <path d={`M${s*0.62} ${s*0.54}L${s*0.66} ${s*0.6}L${s*0.72} ${s*0.5}`} stroke="white" strokeWidth={s*0.035} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </g>
  ),
  streak_30: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-gold)"/>
      <path d={`M${s*0.3} ${s*0.5}A${s*0.2} ${s*0.2} 0 1 1 ${s*0.7} ${s*0.5}`} fill="none" stroke="white" strokeWidth={s*0.04} strokeLinecap="round"/>
      <text x={s/2} y={s*0.66} textAnchor="middle" fill="white" fontSize={s*0.16} fontWeight="bold">30</text>
    </g>
  ),
  streak_60: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-purple)"/>
      <path d={`M${s*0.38} ${s*0.42}L${s*0.42} ${s*0.32}L${s*0.48} ${s*0.42}M${s*0.52} ${s*0.42}L${s*0.56} ${s*0.32}L${s*0.62} ${s*0.42}`} stroke="white" strokeWidth={s*0.03} strokeLinecap="round" fill="none"/>
      <text x={s/2} y={s*0.68} textAnchor="middle" fill="white" fontSize={s*0.14} fontWeight="bold">60</text>
    </g>
  ),
  streak_90: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.4} fill="url(#grad-gold)"/>
      <circle cx={s/2} cy={s/2} r={s*0.32} fill="none" stroke="white" strokeWidth={s*0.02}/>
      <text x={s/2} y={s*0.56} textAnchor="middle" fill="white" fontSize={s*0.16} fontWeight="bold">90</text>
    </g>
  ),
  streak_180: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-purple)"/>
      <path d={`M${s*0.35} ${s*0.5}Q${s/2} ${s*0.25} ${s*0.65} ${s*0.5}Q${s/2} ${s*0.75} ${s*0.35} ${s*0.5}Z`} fill="white" opacity={0.3}/>
      <circle cx={s*0.55} cy={s*0.4} r={s*0.04} fill="white"/>
    </g>
  ),
  streak_365: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.42} fill="url(#grad-gold)"/>
      <circle cx={s/2} cy={s/2} r={s*0.35} fill="none" stroke="white" strokeWidth={s*0.025} strokeDasharray={`${s*0.05} ${s*0.03}`}/>
      <text x={s/2} y={s*0.52} textAnchor="middle" fill="white" fontSize={s*0.12} fontWeight="bold">365</text>
      <path d={`M${s*0.35} ${s*0.65}L${s/2} ${s*0.58}L${s*0.65} ${s*0.65}`} stroke="white" strokeWidth={s*0.03} strokeLinecap="round" fill="none"/>
    </g>
  ),
  streak_comeback: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.35} fill="url(#grad-pink)"/>
      <path d={`M${s*0.6} ${s*0.35}A${s*0.12} ${s*0.12} 0 1 0 ${s*0.6} ${s*0.55}`} fill="none" stroke="white" strokeWidth={s*0.04} strokeLinecap="round"/>
      <path d={`M${s*0.55} ${s*0.55}L${s*0.6} ${s*0.55}L${s*0.6} ${s*0.48}`} stroke="white" strokeWidth={s*0.03} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </g>
  ),

  // ── CONSISTENCY ──
  perfect_week: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-pink)"/>
      {[0,1,2,3,4,5,6].map(i => {
        const angle = (i / 7) * Math.PI * 2 - Math.PI / 2;
        const cx = s/2 + Math.cos(angle) * s * 0.24;
        const cy = s/2 + Math.sin(angle) * s * 0.24;
        return <circle key={i} cx={cx} cy={cy} r={s*0.04} fill="white" opacity={0.9}/>;
      })}
    </g>
  ),
  consistency_king: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-gold)"/>
      <path d={`M${s*0.32} ${s*0.35}L${s*0.4} ${s*0.25}L${s/2} ${s*0.35}L${s*0.6} ${s*0.25}L${s*0.68} ${s*0.35}L${s*0.65} ${s*0.55}L${s*0.35} ${s*0.55}Z`} fill="white" opacity={0.9}/>
    </g>
  ),
  never_miss_monday: (s) => (
    <g>
      <rect x={s*0.22} y={s*0.25} width={s*0.56} height={s*0.5} rx={s*0.06} fill="url(#grad-pink)"/>
      <rect x={s*0.22} y={s*0.25} width={s*0.56} height={s*0.14} rx={s*0.06} fill="white" opacity={0.3}/>
      <text x={s/2} y={s*0.62} textAnchor="middle" fill="white" fontSize={s*0.18} fontWeight="bold">M</text>
    </g>
  ),
  weekend_warrior: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-purple)"/>
      <text x={s*0.38} y={s*0.52} textAnchor="middle" fill="white" fontSize={s*0.14} fontWeight="bold">S</text>
      <text x={s*0.62} y={s*0.52} textAnchor="middle" fill="white" fontSize={s*0.14} fontWeight="bold">S</text>
      <line x1={s/2} y1={s*0.3} x2={s/2} y2={s*0.7} stroke="white" strokeWidth={s*0.02} opacity={0.3}/>
    </g>
  ),
  early_bird: (s) => (
    <g>
      <circle cx={s*0.6} cy={s*0.3} r={s*0.18} fill="url(#grad-gold)" opacity={0.8}/>
      <ellipse cx={s/2} cy={s*0.6} rx={s*0.2} ry={s*0.15} fill="url(#grad-pink)"/>
      <circle cx={s*0.45} cy={s*0.55} r={s*0.03} fill="white"/>
      <path d={`M${s*0.55} ${s*0.6}L${s*0.65} ${s*0.58}`} stroke="url(#grad-gold)" strokeWidth={s*0.03} strokeLinecap="round"/>
    </g>
  ),
  night_owl: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="hsl(260 60% 25%)"/>
      <circle cx={s*0.4} cy={s*0.42} r={s*0.1} fill="url(#grad-gold)" opacity={0.9}/>
      <circle cx={s*0.6} cy={s*0.42} r={s*0.1} fill="url(#grad-gold)" opacity={0.9}/>
      <circle cx={s*0.4} cy={s*0.42} r={s*0.05} fill="hsl(260 60% 15%)"/>
      <circle cx={s*0.6} cy={s*0.42} r={s*0.05} fill="hsl(260 60% 15%)"/>
      <path d={`M${s*0.42} ${s*0.62}Q${s/2} ${s*0.68} ${s*0.58} ${s*0.62}`} stroke="url(#grad-gold)" strokeWidth={s*0.025} fill="none"/>
    </g>
  ),
  lunch_logger: (s) => (
    <g>
      <rect x={s*0.22} y={s*0.35} width={s*0.56} height={s*0.35} rx={s*0.04} fill="url(#grad-pink)"/>
      <rect x={s*0.22} y={s*0.35} width={s*0.56} height={s*0.1} rx={s*0.04} fill="white" opacity={0.3}/>
      <circle cx={s/2} cy={s*0.28} r={s*0.06} fill="url(#grad-gold)"/>
    </g>
  ),
  routine_master: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-purple)"/>
      <circle cx={s/2} cy={s/2} r={s*0.25} fill="none" stroke="white" strokeWidth={s*0.025}/>
      <line x1={s/2} y1={s/2} x2={s/2} y2={s*0.3} stroke="white" strokeWidth={s*0.03} strokeLinecap="round"/>
      <line x1={s/2} y1={s/2} x2={s*0.62} y2={s*0.55} stroke="white" strokeWidth={s*0.025} strokeLinecap="round"/>
    </g>
  ),

  // ── FEATURE ──
  detailed_first: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-pink)"/>
      <circle cx={s/2} cy={s*0.42} r={s*0.18} fill="white" opacity={0.2}/>
      <circle cx={s/2} cy={s*0.42} r={s*0.1} fill="white" opacity={0.4}/>
      <circle cx={s/2} cy={s*0.42} r={s*0.04} fill="white"/>
    </g>
  ),
  photo_first: (s) => (
    <g>
      <rect x={s*0.22} y={s*0.28} width={s*0.56} height={s*0.44} rx={s*0.06} fill="url(#grad-purple)"/>
      <circle cx={s/2} cy={s*0.48} r={s*0.12} fill="white" opacity={0.3}/>
      <circle cx={s/2} cy={s*0.48} r={s*0.07} fill="white" opacity={0.5}/>
      <rect x={s*0.55} y={s*0.3} width={s*0.12} height={s*0.08} rx={s*0.02} fill="white" opacity={0.4}/>
    </g>
  ),
  photo_10: (s) => (
    <g>
      <rect x={s*0.18} y={s*0.25} width={s*0.52} height={s*0.42} rx={s*0.05} fill="url(#grad-purple)" opacity={0.5} transform={`rotate(-8 ${s/2} ${s/2})`}/>
      <rect x={s*0.24} y={s*0.28} width={s*0.52} height={s*0.42} rx={s*0.05} fill="url(#grad-purple)"/>
      <circle cx={s*0.5} cy={s*0.47} r={s*0.1} fill="white" opacity={0.4}/>
    </g>
  ),
  voice_first: (s) => (
    <g>
      <rect x={s*0.4} y={s*0.2} width={s*0.2} height={s*0.35} rx={s*0.1} fill="url(#grad-pink)"/>
      <path d={`M${s*0.3} ${s*0.48}Q${s*0.3} ${s*0.7} ${s/2} ${s*0.7}Q${s*0.7} ${s*0.7} ${s*0.7} ${s*0.48}`} fill="none" stroke="url(#grad-pink)" strokeWidth={s*0.035} strokeLinecap="round"/>
      <line x1={s/2} y1={s*0.7} x2={s/2} y2={s*0.82} stroke="url(#grad-pink)" strokeWidth={s*0.035} strokeLinecap="round"/>
    </g>
  ),
  voice_10: (s) => (
    <g>
      <rect x={s*0.4} y={s*0.2} width={s*0.2} height={s*0.3} rx={s*0.1} fill="url(#grad-purple)"/>
      <path d={`M${s*0.32} ${s*0.45}Q${s*0.32} ${s*0.65} ${s/2} ${s*0.65}Q${s*0.68} ${s*0.65} ${s*0.68} ${s*0.45}`} fill="none" stroke="url(#grad-purple)" strokeWidth={s*0.03}/>
      {[0.25,0.35,0.45,0.55].map((x,i) => (
        <line key={i} x1={s*x+s*0.1} y1={s*0.75} x2={s*x+s*0.1} y2={s*(0.72-[0.04,0.08,0.06,0.03][i])} stroke="url(#grad-pink)" strokeWidth={s*0.03} strokeLinecap="round"/>
      ))}
    </g>
  ),
  export_pro: (s) => (
    <g>
      <rect x={s*0.25} y={s*0.2} width={s*0.5} height={s*0.6} rx={s*0.06} fill="url(#grad-pink)"/>
      <path d={`M${s/2} ${s*0.4}L${s/2} ${s*0.6}M${s*0.4} ${s*0.5}L${s/2} ${s*0.4}L${s*0.6} ${s*0.5}`} stroke="white" strokeWidth={s*0.04} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </g>
  ),
  share_master: (s) => (
    <g>
      <circle cx={s*0.35} cy={s*0.35} r={s*0.1} fill="url(#grad-pink)"/>
      <circle cx={s*0.65} cy={s*0.3} r={s*0.08} fill="url(#grad-purple)"/>
      <circle cx={s*0.55} cy={s*0.65} r={s*0.09} fill="url(#grad-pink)"/>
      <line x1={s*0.4} y1={s*0.4} x2={s*0.6} y2={s*0.33} stroke="white" strokeWidth={s*0.025} opacity={0.6}/>
      <line x1={s*0.4} y1={s*0.42} x2={s*0.52} y2={s*0.6} stroke="white" strokeWidth={s*0.025} opacity={0.6}/>
    </g>
  ),
  ai_chatter: (s) => (
    <g>
      <rect x={s*0.2} y={s*0.25} width={s*0.6} height={s*0.4} rx={s*0.08} fill="url(#grad-purple)"/>
      <path d={`M${s*0.35} ${s*0.65}L${s*0.3} ${s*0.78}L${s*0.45} ${s*0.65}`} fill="url(#grad-purple)"/>
      <circle cx={s*0.38} cy={s*0.45} r={s*0.04} fill="white"/>
      <circle cx={s/2} cy={s*0.45} r={s*0.04} fill="white" opacity={0.7}/>
      <circle cx={s*0.62} cy={s*0.45} r={s*0.04} fill="white" opacity={0.5}/>
    </g>
  ),
  wearable_connected: (s) => (
    <g>
      <rect x={s*0.32} y={s*0.18} width={s*0.36} height={s*0.64} rx={s*0.08} fill="url(#grad-purple)"/>
      <rect x={s*0.36} y={s*0.28} width={s*0.28} height={s*0.3} rx={s*0.04} fill="white" opacity={0.2}/>
      <path d={`M${s*0.4} ${s*0.45}L${s*0.46} ${s*0.38}L${s*0.52} ${s*0.48}L${s*0.58} ${s*0.35}`} stroke="white" strokeWidth={s*0.025} strokeLinecap="round" fill="none"/>
    </g>
  ),
  custom_shortcut: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.35} fill="url(#grad-pink)"/>
      <path d={`M${s/2} ${s*0.3}L${s/2} ${s*0.7}M${s*0.3} ${s/2}L${s*0.7} ${s/2}`} stroke="white" strokeWidth={s*0.05} strokeLinecap="round"/>
    </g>
  ),

  // ── TRACKING ──
  symptom_tracker: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-pink)"/>
      <circle cx={s/2} cy={s/2} r={s*0.2} fill="white" opacity={0.2}/>
      <path d={`M${s*0.4} ${s/2}L${s*0.5} ${s/2}L${s*0.55} ${s*0.35}L${s*0.6} ${s*0.6}L${s*0.65} ${s/2}`} stroke="white" strokeWidth={s*0.03} strokeLinecap="round" fill="none"/>
    </g>
  ),
  symptom_master: (s) => (
    <g>
      <rect x={s*0.22} y={s*0.22} width={s*0.56} height={s*0.56} rx={s*0.08} fill="url(#grad-purple)"/>
      <path d={`M${s*0.38} ${s/2}L${s/2} ${s/2}L${s*0.52} ${s*0.35}L${s*0.56} ${s*0.58}L${s*0.62} ${s/2}`} stroke="white" strokeWidth={s*0.03} strokeLinecap="round" fill="none"/>
      <line x1={s*0.35} y1={s*0.68} x2={s*0.65} y2={s*0.68} stroke="white" strokeWidth={s*0.025} opacity={0.5}/>
    </g>
  ),
  trigger_detective: (s) => (
    <g>
      <circle cx={s*0.45} cy={s*0.45} r={s*0.25} fill="none" stroke="url(#grad-pink)" strokeWidth={s*0.04}/>
      <line x1={s*0.62} y1={s*0.62} x2={s*0.78} y2={s*0.78} stroke="url(#grad-pink)" strokeWidth={s*0.05} strokeLinecap="round"/>
    </g>
  ),
  trigger_master: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-purple)"/>
      <circle cx={s/2} cy={s/2} r={s*0.15} fill="white" opacity={0.3}/>
      <path d={`M${s/2} ${s*0.2}L${s/2} ${s*0.32}M${s/2} ${s*0.68}L${s/2} ${s*0.8}M${s*0.2} ${s/2}L${s*0.32} ${s/2}M${s*0.68} ${s/2}L${s*0.8} ${s/2}`} stroke="white" strokeWidth={s*0.03} strokeLinecap="round"/>
    </g>
  ),
  med_tracker: (s) => (
    <g>
      <rect x={s*0.3} y={s*0.2} width={s*0.4} height={s*0.6} rx={s*0.12} fill="url(#grad-pink)"/>
      <rect x={s*0.3} y={s*0.2} width={s*0.4} height={s*0.2} rx={s*0.08} fill="white" opacity={0.3}/>
      <line x1={s/2} y1={s*0.5} x2={s/2} y2={s*0.7} stroke="white" strokeWidth={s*0.04} strokeLinecap="round"/>
      <line x1={s*0.4} y1={s*0.6} x2={s*0.6} y2={s*0.6} stroke="white" strokeWidth={s*0.04} strokeLinecap="round"/>
    </g>
  ),
  med_adherent: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-purple)"/>
      <rect x={s*0.38} y={s*0.28} width={s*0.24} height={s*0.35} rx={s*0.06} fill="white" opacity={0.3}/>
      <path d={`M${s*0.4} ${s*0.55}L${s*0.48} ${s*0.63}L${s*0.62} ${s*0.48}`} stroke="white" strokeWidth={s*0.04} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </g>
  ),
  energy_tracker: (s) => (
    <g>
      <rect x={s*0.35} y={s*0.18} width={s*0.3} height={s*0.64} rx={s*0.06} fill="url(#grad-pink)" opacity={0.3}/>
      <rect x={s*0.35} y={s*0.42} width={s*0.3} height={s*0.4} rx={s*0.06} fill="url(#grad-pink)"/>
      <path d={`M${s*0.45} ${s*0.3}L${s*0.55} ${s*0.3}L${s*0.48} ${s*0.42}L${s*0.56} ${s*0.42}L${s*0.44} ${s*0.58}`} stroke="white" strokeWidth={s*0.025} fill="none"/>
    </g>
  ),
  mood_master: (s) => (
    <g>
      <circle cx={s*0.35} cy={s*0.35} r={s*0.15} fill="url(#grad-pink)"/>
      <circle cx={s*0.65} cy={s*0.35} r={s*0.15} fill="url(#grad-purple)"/>
      <circle cx={s/2} cy={s*0.65} r={s*0.15} fill="url(#grad-gold)"/>
    </g>
  ),
  weather_watcher: (s) => (
    <g>
      <circle cx={s*0.45} cy={s*0.4} r={s*0.18} fill="url(#grad-gold)" opacity={0.8}/>
      <path d={`M${s*0.5} ${s*0.5}Q${s*0.35} ${s*0.55} ${s*0.3} ${s*0.48}Q${s*0.25} ${s*0.38} ${s*0.4} ${s*0.35}Q${s*0.5} ${s*0.28} ${s*0.6} ${s*0.35}Q${s*0.75} ${s*0.35} ${s*0.72} ${s*0.48}Q${s*0.7} ${s*0.55} ${s*0.5} ${s*0.55}Z`} fill="white" opacity={0.8}/>
    </g>
  ),
  location_tracker: (s) => (
    <g>
      <path d={`M${s/2} ${s*0.82}L${s*0.3} ${s*0.45}A${s*0.2} ${s*0.2} 0 1 1 ${s*0.7} ${s*0.45}Z`} fill="url(#grad-pink)"/>
      <circle cx={s/2} cy={s*0.38} r={s*0.08} fill="white"/>
    </g>
  ),

  // ── INSIGHT ──
  pattern_detective: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-purple)" opacity={0.8}/>
      <circle cx={s/2} cy={s/2} r={s*0.2} fill="none" stroke="white" strokeWidth={s*0.02} strokeDasharray={`${s*0.04} ${s*0.03}`}/>
      <circle cx={s/2} cy={s*0.38} r={s*0.04} fill="white"/>
      <circle cx={s*0.6} cy={s*0.55} r={s*0.04} fill="white" opacity={0.7}/>
      <circle cx={s*0.4} cy={s*0.6} r={s*0.04} fill="white" opacity={0.5}/>
    </g>
  ),
  health_analyst: (s) => (
    <g>
      <rect x={s*0.2} y={s*0.25} width={s*0.6} height={s*0.5} rx={s*0.06} fill="url(#grad-pink)"/>
      <path d={`M${s*0.3} ${s*0.65}L${s*0.4} ${s*0.5}L${s/2} ${s*0.55}L${s*0.6} ${s*0.35}L${s*0.7} ${s*0.4}`} stroke="white" strokeWidth={s*0.03} strokeLinecap="round" fill="none"/>
    </g>
  ),
  data_scientist: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.4} fill="url(#grad-purple)"/>
      <circle cx={s/2} cy={s/2} r={s*0.22} fill="white" opacity={0.15}/>
      <path d={`M${s*0.35} ${s*0.55}L${s*0.42} ${s*0.4}L${s/2} ${s*0.5}L${s*0.58} ${s*0.32}L${s*0.65} ${s*0.45}`} stroke="white" strokeWidth={s*0.03} strokeLinecap="round" fill="none"/>
      <circle cx={s*0.35} cy={s*0.55} r={s*0.03} fill="white"/>
      <circle cx={s*0.58} cy={s*0.32} r={s*0.03} fill="white"/>
    </g>
  ),
  insight_seeker: (s) => (
    <g>
      <circle cx={s/2} cy={s*0.38} r={s*0.22} fill="url(#grad-gold)" opacity={0.9}/>
      <path d={`M${s*0.44} ${s*0.6}L${s/2} ${s*0.55}L${s*0.56} ${s*0.6}L${s/2} ${s*0.78}Z`} fill="url(#grad-gold)"/>
    </g>
  ),
  chart_reader: (s) => (
    <g>
      <rect x={s*0.2} y={s*0.2} width={s*0.6} height={s*0.6} rx={s*0.04} fill="url(#grad-purple)" opacity={0.3}/>
      {[0.3,0.42,0.54,0.66].map((x,i) => (
        <rect key={i} x={s*x} y={s*(0.7-[0.15,0.25,0.2,0.35][i])} width={s*0.08} height={s*[0.15,0.25,0.2,0.35][i]} rx={s*0.02} fill="url(#grad-pink)"/>
      ))}
    </g>
  ),
  prediction_pro: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-purple)"/>
      <path d={`M${s*0.35} ${s*0.55}L${s*0.45} ${s*0.4}L${s*0.55} ${s*0.5}L${s*0.65} ${s*0.35}`} stroke="white" strokeWidth={s*0.03} strokeLinecap="round" fill="none"/>
      <path d={`M${s*0.65} ${s*0.35}L${s*0.78} ${s*0.25}`} stroke="white" strokeWidth={s*0.03} strokeLinecap="round" strokeDasharray={`${s*0.03} ${s*0.02}`} fill="none"/>
    </g>
  ),

  // ── ENGAGEMENT ──
  profile_complete: (s) => (
    <g>
      <circle cx={s/2} cy={s*0.35} r={s*0.15} fill="url(#grad-pink)"/>
      <path d={`M${s*0.3} ${s*0.75}Q${s*0.3} ${s*0.55} ${s/2} ${s*0.55}Q${s*0.7} ${s*0.55} ${s*0.7} ${s*0.75}`} fill="url(#grad-pink)" opacity={0.6}/>
      <path d={`M${s*0.42} ${s*0.62}L${s*0.48} ${s*0.68}L${s*0.58} ${s*0.56}`} stroke="white" strokeWidth={s*0.035} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </g>
  ),
  settings_explorer: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.35} fill="url(#grad-purple)" opacity={0.3}/>
      <circle cx={s/2} cy={s/2} r={s*0.2} fill="none" stroke="url(#grad-purple)" strokeWidth={s*0.04}/>
      {[0,60,120,180,240,300].map(deg => {
        const rad = (deg * Math.PI) / 180;
        return <circle key={deg} cx={s/2 + Math.cos(rad)*s*0.28} cy={s/2 + Math.sin(rad)*s*0.28} r={s*0.05} fill="url(#grad-purple)"/>;
      })}
    </g>
  ),
  theme_changer: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-pink)"/>
      <path d={`M${s/2} ${s*0.2}A${s*0.3} ${s*0.3} 0 0 1 ${s/2} ${s*0.8}`} fill="url(#grad-purple)"/>
    </g>
  ),
  reminder_set: (s) => (
    <g>
      <circle cx={s/2} cy={s*0.38} r={s*0.22} fill="url(#grad-gold)"/>
      <path d={`M${s*0.3} ${s*0.55}Q${s*0.3} ${s*0.42} ${s/2} ${s*0.42}Q${s*0.7} ${s*0.42} ${s*0.7} ${s*0.55}`} fill="url(#grad-gold)" opacity={0.6}/>
      <rect x={s*0.45} y={s*0.58} width={s*0.1} height={s*0.06} rx={s*0.02} fill="url(#grad-gold)"/>
      <line x1={s/2} y1={s*0.28} x2={s/2} y2={s*0.38} stroke="white" strokeWidth={s*0.025} strokeLinecap="round"/>
      <line x1={s/2} y1={s*0.38} x2={s*0.58} y2={s*0.42} stroke="white" strokeWidth={s*0.025} strokeLinecap="round"/>
    </g>
  ),
  feedback_giver: (s) => (
    <g>
      <rect x={s*0.22} y={s*0.28} width={s*0.56} height={s*0.38} rx={s*0.06} fill="url(#grad-pink)"/>
      <path d={`M${s*0.35} ${s*0.66}L${s*0.32} ${s*0.78}L${s*0.48} ${s*0.66}`} fill="url(#grad-pink)"/>
      <line x1={s*0.35} y1={s*0.42} x2={s*0.65} y2={s*0.42} stroke="white" strokeWidth={s*0.03} strokeLinecap="round"/>
      <line x1={s*0.35} y1={s*0.52} x2={s*0.55} y2={s*0.52} stroke="white" strokeWidth={s*0.03} strokeLinecap="round" opacity={0.6}/>
    </g>
  ),
  app_veteran: (s) => (
    <g>
      <path d={`M${s/2} ${s*0.15}L${s*0.65} ${s*0.3}L${s*0.65} ${s*0.55}L${s/2} ${s*0.75}L${s*0.35} ${s*0.55}L${s*0.35} ${s*0.3}Z`} fill="url(#grad-purple)"/>
      <path d={`M${s/2} ${s*0.15}L${s*0.65} ${s*0.3}L${s/2} ${s*0.45}L${s*0.35} ${s*0.3}Z`} fill="white" opacity={0.2}/>
    </g>
  ),
  power_user: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-purple)"/>
      <path d={`M${s*0.48} ${s*0.22}L${s*0.4} ${s*0.5}L${s*0.52} ${s*0.5}L${s*0.48} ${s*0.78}`} stroke="white" strokeWidth={s*0.045} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </g>
  ),

  // ── WELLNESS ──
  flare_free_3: (s) => (
    <g>
      <circle cx={s/2} cy={s*0.38} r={s*0.22} fill="url(#grad-gold)" opacity={0.8}/>
      {[s*0.3, s*0.45, s*0.6].map((x,i) => (
        <line key={i} x1={x} y1={s*0.7} x2={x} y2={s*(0.7 - 0.08)} stroke="url(#grad-gold)" strokeWidth={s*0.03} strokeLinecap="round" opacity={0.6}/>
      ))}
    </g>
  ),
  flare_free_7: (s) => (
    <g>
      <path d={`M${s*0.25} ${s*0.55}Q${s*0.35} ${s*0.3} ${s/2} ${s*0.4}Q${s*0.65} ${s*0.3} ${s*0.75} ${s*0.55}`} fill="none" stroke="url(#grad-pink)" strokeWidth={s*0.04} strokeLinecap="round"/>
      <circle cx={s*0.35} cy={s*0.6} r={s*0.03} fill="url(#grad-gold)"/>
      <circle cx={s/2} cy={s*0.55} r={s*0.03} fill="url(#grad-gold)"/>
      <circle cx={s*0.65} cy={s*0.6} r={s*0.03} fill="url(#grad-gold)"/>
    </g>
  ),
  flare_free_14: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.35} fill="url(#grad-gold)" opacity={0.3}/>
      <path d={`M${s*0.35} ${s*0.55}Q${s*0.42} ${s*0.35} ${s/2} ${s*0.5}Q${s*0.58} ${s*0.35} ${s*0.65} ${s*0.55}`} fill="url(#grad-gold)" opacity={0.6}/>
      <circle cx={s/2} cy={s*0.38} r={s*0.08} fill="url(#grad-gold)"/>
    </g>
  ),
  flare_free_30: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.4} fill="url(#grad-purple)" opacity={0.3}/>
      <path d={`M${s*0.3} ${s*0.55}Q${s*0.38} ${s*0.35} ${s/2} ${s*0.45}Q${s*0.62} ${s*0.35} ${s*0.7} ${s*0.55}L${s*0.62} ${s*0.7}Q${s/2} ${s*0.62} ${s*0.38} ${s*0.7}Z`} fill="url(#grad-purple)" opacity={0.6}/>
    </g>
  ),
  improving_trend: (s) => (
    <g>
      <rect x={s*0.2} y={s*0.25} width={s*0.6} height={s*0.5} rx={s*0.06} fill="url(#grad-pink)" opacity={0.3}/>
      <path d={`M${s*0.28} ${s*0.65}L${s*0.42} ${s*0.52}L${s*0.55} ${s*0.48}L${s*0.72} ${s*0.3}`} stroke="url(#grad-pink)" strokeWidth={s*0.04} strokeLinecap="round" fill="none"/>
      <path d={`M${s*0.65} ${s*0.28}L${s*0.72} ${s*0.3}L${s*0.68} ${s*0.38}`} stroke="url(#grad-pink)" strokeWidth={s*0.03} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </g>
  ),
  recovery_champion: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-gold)"/>
      <path d={`M${s*0.35} ${s*0.38}L${s/2} ${s*0.25}L${s*0.65} ${s*0.38}L${s/2} ${s*0.5}Z`} fill="white" opacity={0.4}/>
      <path d={`M${s*0.35} ${s*0.55}L${s/2} ${s*0.5}L${s*0.65} ${s*0.55}L${s/2} ${s*0.72}Z`} fill="white" opacity={0.3}/>
    </g>
  ),
  sleep_champion: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.35} fill="hsl(260 50% 30%)"/>
      <path d={`M${s*0.55} ${s*0.28}Q${s*0.35} ${s*0.3} ${s*0.38} ${s*0.5}Q${s*0.4} ${s*0.68} ${s*0.6} ${s*0.7}Q${s*0.45} ${s*0.72} ${s*0.35} ${s*0.6}Q${s*0.22} ${s*0.45} ${s*0.55} ${s*0.28}Z`} fill="url(#grad-gold)" opacity={0.9}/>
    </g>
  ),
  hydration_hero: (s) => (
    <g>
      <path d={`M${s/2} ${s*0.2}Q${s*0.35} ${s*0.45} ${s*0.35} ${s*0.6}Q${s*0.35} ${s*0.82} ${s/2} ${s*0.82}Q${s*0.65} ${s*0.82} ${s*0.65} ${s*0.6}Q${s*0.65} ${s*0.45} ${s/2} ${s*0.2}Z`} fill="url(#grad-purple)" opacity={0.7}/>
      <path d={`M${s*0.38} ${s*0.62}Q${s/2} ${s*0.55} ${s*0.62} ${s*0.62}L${s*0.62} ${s*0.72}Q${s/2} ${s*0.78} ${s*0.38} ${s*0.72}Z`} fill="white" opacity={0.3}/>
    </g>
  ),

  // ── ADVENTURE ──
  globe_trotter: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.35} fill="url(#grad-purple)"/>
      <ellipse cx={s/2} cy={s/2} rx={s*0.15} ry={s*0.35} fill="none" stroke="white" strokeWidth={s*0.02} opacity={0.5}/>
      <line x1={s*0.2} y1={s/2} x2={s*0.8} y2={s/2} stroke="white" strokeWidth={s*0.02} opacity={0.5}/>
      <line x1={s*0.25} y1={s*0.35} x2={s*0.75} y2={s*0.35} stroke="white" strokeWidth={s*0.015} opacity={0.3}/>
      <line x1={s*0.25} y1={s*0.65} x2={s*0.75} y2={s*0.65} stroke="white" strokeWidth={s*0.015} opacity={0.3}/>
    </g>
  ),
  world_traveler: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-gold)"/>
      <ellipse cx={s/2} cy={s/2} rx={s*0.18} ry={s*0.38} fill="none" stroke="white" strokeWidth={s*0.02}/>
      <line x1={s*0.15} y1={s/2} x2={s*0.85} y2={s/2} stroke="white" strokeWidth={s*0.02}/>
      <path d={`M${s*0.35} ${s*0.25}L${s*0.42} ${s*0.2}L${s*0.48} ${s*0.25}`} stroke="white" strokeWidth={s*0.025} strokeLinecap="round" fill="none"/>
    </g>
  ),
  road_tripper: (s) => (
    <g>
      <path d={`M${s*0.25} ${s*0.7}Q${s*0.4} ${s*0.3} ${s*0.6} ${s*0.5}Q${s*0.75} ${s*0.65} ${s*0.8} ${s*0.3}`} fill="none" stroke="url(#grad-pink)" strokeWidth={s*0.04} strokeLinecap="round"/>
      <circle cx={s*0.25} cy={s*0.7} r={s*0.05} fill="url(#grad-pink)"/>
      <circle cx={s*0.8} cy={s*0.3} r={s*0.05} fill="url(#grad-purple)"/>
    </g>
  ),
  city_hopper: (s) => (
    <g>
      {[0.25,0.38,0.48,0.58,0.68].map((x,i) => (
        <rect key={i} x={s*x} y={s*(0.7-[0.25,0.35,0.2,0.4,0.15][i])} width={s*0.08} height={s*[0.25,0.35,0.2,0.4,0.15][i]} rx={s*0.015} fill="url(#grad-purple)" opacity={0.6+i*0.08}/>
      ))}
    </g>
  ),
  nomad: (s) => (
    <g>
      <path d={`M${s*0.3} ${s*0.7}L${s/2} ${s*0.25}L${s*0.7} ${s*0.7}Z`} fill="url(#grad-pink)" opacity={0.7}/>
      <path d={`M${s*0.38} ${s*0.7}L${s/2} ${s*0.4}L${s*0.62} ${s*0.7}Z`} fill="white" opacity={0.2}/>
      <circle cx={s/2} cy={s*0.55} r={s*0.04} fill="white"/>
    </g>
  ),
  beach_logger: (s) => (
    <g>
      <rect x={s*0.15} y={s*0.2} width={s*0.7} height={s*0.3} rx={0} fill="hsl(200 80% 60%)"/>
      <path d={`M${s*0.15} ${s*0.5}Q${s*0.3} ${s*0.42} ${s*0.45} ${s*0.5}Q${s*0.6} ${s*0.58} ${s*0.85} ${s*0.5}`} fill="hsl(200 80% 60%)"/>
      <rect x={s*0.15} y={s*0.52} width={s*0.7} height={s*0.28} fill="url(#grad-gold)" opacity={0.6}/>
      <circle cx={s*0.7} cy={s*0.3} r={s*0.08} fill="url(#grad-gold)"/>
    </g>
  ),
  mountain_tracker: (s) => (
    <g>
      <path d={`M${s*0.15} ${s*0.75}L${s*0.45} ${s*0.22}L${s*0.6} ${s*0.45}L${s*0.7} ${s*0.35}L${s*0.85} ${s*0.75}Z`} fill="url(#grad-purple)"/>
      <path d={`M${s*0.45} ${s*0.22}L${s*0.5} ${s*0.35}L${s*0.38} ${s*0.35}Z`} fill="white" opacity={0.5}/>
    </g>
  ),
  timezone_jumper: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.35} fill="url(#grad-purple)" opacity={0.3}/>
      <circle cx={s/2} cy={s/2} r={s*0.25} fill="none" stroke="url(#grad-purple)" strokeWidth={s*0.03}/>
      <text x={s*0.35} y={s*0.48} fill="url(#grad-pink)" fontSize={s*0.12} fontWeight="bold">+</text>
      <text x={s*0.55} y={s*0.58} fill="url(#grad-purple)" fontSize={s*0.12} fontWeight="bold">-</text>
    </g>
  ),

  // ── SEASONAL ──
  new_year_logger: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.35} fill="hsl(260 60% 20%)"/>
      {[0,72,144,216,288].map(deg => {
        const rad = (deg * Math.PI) / 180;
        return <line key={deg} x1={s/2} y1={s/2} x2={s/2+Math.cos(rad)*s*0.3} y2={s/2+Math.sin(rad)*s*0.3} stroke="url(#grad-gold)" strokeWidth={s*0.02} strokeLinecap="round"/>;
      })}
      <circle cx={s/2} cy={s/2} r={s*0.06} fill="url(#grad-gold)"/>
    </g>
  ),
  valentines_care: (s) => (
    <g>
      <path d={`M${s/2} ${s*0.75}L${s*0.22} ${s*0.4}Q${s*0.22} ${s*0.2} ${s*0.36} ${s*0.2}Q${s/2} ${s*0.2} ${s/2} ${s*0.35}Q${s/2} ${s*0.2} ${s*0.64} ${s*0.2}Q${s*0.78} ${s*0.2} ${s*0.78} ${s*0.4}Z`} fill="url(#grad-pink)"/>
    </g>
  ),
  spring_tracker: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.12} fill="url(#grad-gold)"/>
      {[0,60,120,180,240,300].map(deg => {
        const rad = (deg * Math.PI) / 180;
        return <ellipse key={deg} cx={s/2+Math.cos(rad)*s*0.22} cy={s/2+Math.sin(rad)*s*0.22} rx={s*0.08} ry={s*0.05} fill="url(#grad-pink)" opacity={0.7} transform={`rotate(${deg} ${s/2+Math.cos(rad)*s*0.22} ${s/2+Math.sin(rad)*s*0.22})`}/>;
      })}
    </g>
  ),
  summer_logger: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.2} fill="url(#grad-gold)"/>
      {[0,45,90,135,180,225,270,315].map(deg => {
        const rad = (deg * Math.PI) / 180;
        return <line key={deg} x1={s/2+Math.cos(rad)*s*0.25} y1={s/2+Math.sin(rad)*s*0.25} x2={s/2+Math.cos(rad)*s*0.35} y2={s/2+Math.sin(rad)*s*0.35} stroke="url(#grad-gold)" strokeWidth={s*0.03} strokeLinecap="round"/>;
      })}
    </g>
  ),
  fall_tracker: (s) => (
    <g>
      <path d={`M${s/2} ${s*0.2}Q${s*0.7} ${s*0.35} ${s*0.65} ${s*0.55}Q${s*0.6} ${s*0.75} ${s/2} ${s*0.8}Q${s*0.4} ${s*0.75} ${s*0.35} ${s*0.55}Q${s*0.3} ${s*0.35} ${s/2} ${s*0.2}Z`} fill="url(#grad-fire)"/>
      <line x1={s/2} y1={s*0.3} x2={s/2} y2={s*0.75} stroke="white" strokeWidth={s*0.02} opacity={0.4}/>
    </g>
  ),
  winter_warrior: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.35} fill="hsl(210 50% 85%)"/>
      <line x1={s/2} y1={s*0.2} x2={s/2} y2={s*0.8} stroke="white" strokeWidth={s*0.03}/>
      <line x1={s*0.2} y1={s/2} x2={s*0.8} y2={s/2} stroke="white" strokeWidth={s*0.03}/>
      <line x1={s*0.28} y1={s*0.28} x2={s*0.72} y2={s*0.72} stroke="white" strokeWidth={s*0.02}/>
      <line x1={s*0.72} y1={s*0.28} x2={s*0.28} y2={s*0.72} stroke="white" strokeWidth={s*0.02}/>
    </g>
  ),
  halloween_logger: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.35} fill="hsl(30 90% 50%)"/>
      <path d={`M${s*0.35} ${s*0.42}L${s*0.42} ${s*0.38}L${s*0.42} ${s*0.48}Z`} fill="hsl(30 50% 20%)"/>
      <path d={`M${s*0.58} ${s*0.42}L${s*0.65} ${s*0.38}L${s*0.58} ${s*0.48}Z`} fill="hsl(30 50% 20%)"/>
      <path d={`M${s*0.38} ${s*0.6}Q${s/2} ${s*0.72} ${s*0.62} ${s*0.6}`} stroke="hsl(30 50% 20%)" strokeWidth={s*0.025} fill="none"/>
    </g>
  ),
  thanksgiving_gratitude: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.35} fill="url(#grad-gold)" opacity={0.5}/>
      <path d={`M${s/2} ${s*0.75}L${s*0.25} ${s*0.4}Q${s*0.25} ${s*0.22} ${s*0.38} ${s*0.22}Q${s/2} ${s*0.22} ${s/2} ${s*0.35}Q${s/2} ${s*0.22} ${s*0.62} ${s*0.22}Q${s*0.75} ${s*0.22} ${s*0.75} ${s*0.4}Z`} fill="url(#grad-fire)" opacity={0.8}/>
    </g>
  ),
  holiday_health: (s) => (
    <g>
      <path d={`M${s/2} ${s*0.15}L${s*0.55} ${s*0.3}L${s*0.52} ${s*0.3}L${s*0.58} ${s*0.48}L${s*0.54} ${s*0.48}L${s*0.6} ${s*0.65}L${s*0.55} ${s*0.65}L${s*0.62} ${s*0.82}L${s*0.38} ${s*0.82}L${s*0.45} ${s*0.65}L${s*0.4} ${s*0.65}L${s*0.46} ${s*0.48}L${s*0.42} ${s*0.48}L${s*0.48} ${s*0.3}L${s*0.45} ${s*0.3}Z`} fill="hsl(140 60% 40%)"/>
      <circle cx={s/2} cy={s*0.15} r={s*0.04} fill="url(#grad-gold)"/>
    </g>
  ),
  birthday_log: (s) => (
    <g>
      <rect x={s*0.25} y={s*0.4} width={s*0.5} height={s*0.4} rx={s*0.06} fill="url(#grad-pink)"/>
      <rect x={s*0.25} y={s*0.55} width={s*0.5} height={s*0.08} fill="white" opacity={0.2}/>
      <rect x={s*0.46} y={s*0.22} width={s*0.08} height={s*0.2} rx={s*0.02} fill="url(#grad-gold)"/>
      <circle cx={s/2} cy={s*0.2} r={s*0.04} fill="url(#grad-gold)"/>
    </g>
  ),

  // ── SECRET/SPECIAL ──
  midnight_logger: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="hsl(260 60% 15%)"/>
      <path d={`M${s*0.55} ${s*0.25}Q${s*0.35} ${s*0.28} ${s*0.35} ${s*0.5}Q${s*0.35} ${s*0.72} ${s*0.55} ${s*0.75}Q${s*0.4} ${s*0.7} ${s*0.38} ${s*0.5}Q${s*0.36} ${s*0.3} ${s*0.55} ${s*0.25}Z`} fill="url(#grad-gold)" opacity={0.9}/>
      <circle cx={s*0.6} cy={s*0.35} r={s*0.02} fill="white" opacity={0.6}/>
      <circle cx={s*0.68} cy={s*0.5} r={s*0.015} fill="white" opacity={0.4}/>
    </g>
  ),
  palindrome_day: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-purple)"/>
      <text x={s/2} y={s*0.48} textAnchor="middle" fill="white" fontSize={s*0.14} fontWeight="bold">12</text>
      <text x={s/2} y={s*0.64} textAnchor="middle" fill="white" fontSize={s*0.14} fontWeight="bold" opacity={0.5} transform={`scale(1,-1) translate(0,-${s*1.15})`}>21</text>
    </g>
  ),
  lucky_7: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.35} fill="hsl(140 50% 40%)"/>
      <path d={`M${s*0.35} ${s*0.35}Q${s*0.35} ${s*0.6} ${s*0.45} ${s*0.65}Q${s*0.55} ${s*0.65} ${s*0.55} ${s*0.45}Q${s*0.55} ${s*0.35} ${s*0.65} ${s*0.35}Q${s*0.65} ${s*0.6} ${s*0.55} ${s*0.7}`} fill="none" stroke="white" strokeWidth={s*0.03}/>
    </g>
  ),
  triple_threat: (s) => (
    <g>
      <circle cx={s*0.3} cy={s/2} r={s*0.12} fill="url(#grad-pink)"/>
      <circle cx={s/2} cy={s/2} r={s*0.12} fill="url(#grad-purple)"/>
      <circle cx={s*0.7} cy={s/2} r={s*0.12} fill="url(#grad-gold)"/>
    </g>
  ),
  quick_draw: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-pink)"/>
      <path d={`M${s*0.45} ${s*0.25}L${s*0.38} ${s*0.52}L${s*0.52} ${s*0.52}L${s*0.45} ${s*0.78}`} stroke="white" strokeWidth={s*0.05} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </g>
  ),
  novel_writer: (s) => (
    <g>
      <rect x={s*0.28} y={s*0.18} width={s*0.44} height={s*0.64} rx={s*0.04} fill="url(#grad-purple)"/>
      <line x1={s*0.36} y1={s*0.32} x2={s*0.64} y2={s*0.32} stroke="white" strokeWidth={s*0.02} opacity={0.6}/>
      <line x1={s*0.36} y1={s*0.42} x2={s*0.64} y2={s*0.42} stroke="white" strokeWidth={s*0.02} opacity={0.5}/>
      <line x1={s*0.36} y1={s*0.52} x2={s*0.58} y2={s*0.52} stroke="white" strokeWidth={s*0.02} opacity={0.4}/>
      <line x1={s*0.36} y1={s*0.62} x2={s*0.62} y2={s*0.62} stroke="white" strokeWidth={s*0.02} opacity={0.3}/>
    </g>
  ),
  emoji_master: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.35} fill="url(#grad-gold)"/>
      <circle cx={s*0.4} cy={s*0.42} r={s*0.05} fill="white"/>
      <circle cx={s*0.6} cy={s*0.42} r={s*0.05} fill="white"/>
      <path d={`M${s*0.38} ${s*0.58}Q${s/2} ${s*0.72} ${s*0.62} ${s*0.58}`} stroke="white" strokeWidth={s*0.03} fill="none" strokeLinecap="round"/>
    </g>
  ),
  full_moon: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.35} fill="url(#grad-gold)" opacity={0.9}/>
      <circle cx={s*0.42} cy={s*0.38} r={s*0.06} fill="hsl(45 60% 60%)" opacity={0.4}/>
      <circle cx={s*0.55} cy={s*0.55} r={s*0.08} fill="hsl(45 60% 60%)" opacity={0.3}/>
      <circle cx={s*0.38} cy={s*0.58} r={s*0.04} fill="hsl(45 60% 60%)" opacity={0.3}/>
    </g>
  ),
  fibonacci: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-purple)"/>
      <path d={`M${s*0.3} ${s*0.6}Q${s*0.3} ${s*0.3} ${s*0.5} ${s*0.3}Q${s*0.7} ${s*0.3} ${s*0.7} ${s*0.5}Q${s*0.7} ${s*0.65} ${s*0.55} ${s*0.65}Q${s*0.45} ${s*0.65} ${s*0.45} ${s*0.55}Q${s*0.45} ${s*0.48} ${s*0.5} ${s*0.48}`} fill="none" stroke="white" strokeWidth={s*0.025}/>
    </g>
  ),
  pi_day: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.35} fill="url(#grad-pink)"/>
      <text x={s/2} y={s*0.58} textAnchor="middle" fill="white" fontSize={s*0.3} fontWeight="bold" fontStyle="italic">π</text>
    </g>
  ),
  leap_year: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.35} fill="hsl(140 50% 45%)"/>
      <ellipse cx={s/2} cy={s*0.5} rx={s*0.15} ry={s*0.12} fill="hsl(140 60% 55%)"/>
      <circle cx={s*0.42} cy={s*0.42} r={s*0.04} fill="white"/>
      <circle cx={s*0.58} cy={s*0.42} r={s*0.04} fill="white"/>
      <circle cx={s*0.42} cy={s*0.42} r={s*0.02} fill="hsl(140 50% 25%)"/>
      <circle cx={s*0.58} cy={s*0.42} r={s*0.02} fill="hsl(140 50% 25%)"/>
    </g>
  ),
  solar_eclipse: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.35} fill="hsl(0 0% 10%)"/>
      <circle cx={s/2} cy={s/2} r={s*0.28} fill="none" stroke="url(#grad-gold)" strokeWidth={s*0.04}/>
      <circle cx={s/2} cy={s/2} r={s*0.35} fill="none" stroke="url(#grad-gold)" strokeWidth={s*0.01} opacity={0.3}/>
    </g>
  ),
  early_adopter: (s) => (
    <g>
      <path d={`M${s/2} ${s*0.15}L${s*0.58} ${s*0.45}L${s*0.55} ${s*0.45}L${s*0.62} ${s*0.8}L${s*0.38} ${s*0.8}L${s*0.45} ${s*0.45}L${s*0.42} ${s*0.45}Z`} fill="url(#grad-pink)"/>
      <path d={`M${s/2} ${s*0.15}L${s*0.55} ${s*0.45}L${s*0.45} ${s*0.45}Z`} fill="white" opacity={0.3}/>
    </g>
  ),
  beta_tester: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-purple)"/>
      <text x={s/2} y={s*0.58} textAnchor="middle" fill="white" fontSize={s*0.28} fontWeight="bold" fontStyle="italic">β</text>
    </g>
  ),
  bug_hunter: (s) => (
    <g>
      <ellipse cx={s/2} cy={s*0.55} rx={s*0.2} ry={s*0.22} fill="url(#grad-pink)"/>
      <circle cx={s/2} cy={s*0.32} r={s*0.12} fill="url(#grad-pink)"/>
      <line x1={s*0.32} y1={s*0.45} x2={s*0.22} y2={s*0.38} stroke="url(#grad-purple)" strokeWidth={s*0.025} strokeLinecap="round"/>
      <line x1={s*0.68} y1={s*0.45} x2={s*0.78} y2={s*0.38} stroke="url(#grad-purple)" strokeWidth={s*0.025} strokeLinecap="round"/>
      <line x1={s*0.3} y1={s*0.58} x2={s*0.2} y2={s*0.58} stroke="url(#grad-purple)" strokeWidth={s*0.025} strokeLinecap="round"/>
      <line x1={s*0.7} y1={s*0.58} x2={s*0.8} y2={s*0.58} stroke="url(#grad-purple)" strokeWidth={s*0.025} strokeLinecap="round"/>
      <circle cx={s*0.44} cy={s*0.3} r={s*0.03} fill="white"/>
      <circle cx={s*0.56} cy={s*0.3} r={s*0.03} fill="white"/>
    </g>
  ),
  founding_member: (s) => (
    <g>
      <path d={`M${s/2} ${s*0.12}L${s*0.68} ${s*0.35}L${s*0.62} ${s*0.7}L${s*0.38} ${s*0.7}L${s*0.32} ${s*0.35}Z`} fill="url(#grad-gold)"/>
      <path d={`M${s/2} ${s*0.12}L${s*0.68} ${s*0.35}L${s/2} ${s*0.45}L${s*0.32} ${s*0.35}Z`} fill="white" opacity={0.25}/>
      <circle cx={s/2} cy={s*0.5} r={s*0.08} fill="white" opacity={0.4}/>
    </g>
  ),
};

// Fallback: generic badge with initials
const FallbackBadge = ({ size, name }: { size: number; name?: string }) => (
  <g>
    <circle cx={size/2} cy={size/2} r={size*0.35} fill="url(#grad-pink)" opacity={0.6}/>
    <circle cx={size/2} cy={size/2} r={size*0.2} fill="white" opacity={0.15}/>
    {name && (
      <text x={size/2} y={size*0.56} textAnchor="middle" fill="white" fontSize={size*0.2} fontWeight="bold">
        {name.charAt(0)}
      </text>
    )}
  </g>
);

export const BadgeIconSVG = ({ badgeId, size = 32, className }: BadgeIconSVGProps) => {
  const renderer = BADGE_ICONS[badgeId];

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox={`0 0 ${size} ${size}`} 
      className={className}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="grad-pink" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(330 100% 42%)"/>
          <stop offset="100%" stopColor="hsl(290 100% 35%)"/>
        </linearGradient>
        <linearGradient id="grad-purple" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(270 100% 58%)"/>
          <stop offset="100%" stopColor="hsl(260 70% 45%)"/>
        </linearGradient>
        <linearGradient id="grad-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(40 95% 60%)"/>
          <stop offset="100%" stopColor="hsl(30 90% 50%)"/>
        </linearGradient>
        <linearGradient id="grad-fire" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(15 90% 50%)"/>
          <stop offset="50%" stopColor="hsl(35 95% 55%)"/>
          <stop offset="100%" stopColor="hsl(45 95% 60%)"/>
        </linearGradient>
      </defs>
      {renderer ? renderer(size) : <FallbackBadge size={size} />}
    </svg>
  );
};

// Category icons mapping
export const CATEGORY_ICONS: Record<string, (s: number) => JSX.Element> = {
  milestone: (s) => (
    <g>
      <circle cx={s/2} cy={s/2} r={s*0.38} fill="url(#grad-pink)"/>
      <circle cx={s/2} cy={s/2} r={s*0.15} fill="white" opacity={0.3}/>
      <line x1={s/2} y1={s*0.2} x2={s/2} y2={s*0.35} stroke="white" strokeWidth={s*0.03} strokeLinecap="round"/>
      <line x1={s*0.68} y1={s*0.32} x2={s*0.58} y2={s*0.42} stroke="white" strokeWidth={s*0.03} strokeLinecap="round"/>
      <line x1={s*0.8} y1={s/2} x2={s*0.65} y2={s/2} stroke="white" strokeWidth={s*0.03} strokeLinecap="round"/>
    </g>
  ),
  streak: (s) => BADGE_ICONS.streak_3(s),
  consistency: (s) => BADGE_ICONS.routine_master(s),
  feature: (s) => BADGE_ICONS.custom_shortcut(s),
  tracking: (s) => BADGE_ICONS.symptom_tracker(s),
  insight: (s) => BADGE_ICONS.insight_seeker(s),
  engagement: (s) => BADGE_ICONS.power_user(s),
  wellness: (s) => BADGE_ICONS.flare_free_7(s),
  adventure: (s) => BADGE_ICONS.globe_trotter(s),
  seasonal: (s) => BADGE_ICONS.spring_tracker(s),
  secret: (s) => BADGE_ICONS.midnight_logger(s),
  special: (s) => BADGE_ICONS.founding_member(s),
};

export const CategoryIconSVG = ({ categoryId, size = 32, className }: { categoryId: string; size?: number; className?: string }) => {
  const renderer = CATEGORY_ICONS[categoryId];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="grad-pink" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(330 100% 42%)"/>
          <stop offset="100%" stopColor="hsl(290 100% 35%)"/>
        </linearGradient>
        <linearGradient id="grad-purple" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(270 100% 58%)"/>
          <stop offset="100%" stopColor="hsl(260 70% 45%)"/>
        </linearGradient>
        <linearGradient id="grad-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(40 95% 60%)"/>
          <stop offset="100%" stopColor="hsl(30 90% 50%)"/>
        </linearGradient>
        <linearGradient id="grad-fire" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(15 90% 50%)"/>
          <stop offset="50%" stopColor="hsl(35 95% 55%)"/>
          <stop offset="100%" stopColor="hsl(45 95% 60%)"/>
        </linearGradient>
      </defs>
      {renderer ? renderer(size) : <FallbackBadge size={size} />}
    </svg>
  );
};
