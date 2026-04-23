import { type BiometricSummary } from '@/hooks/usePatientBiometrics';
import { Sparkline } from './Sparkline';
import { Heart, Moon, Footprints, Wind, Thermometer, Activity } from 'lucide-react';

function Metric({ icon: Icon, label, value, unit, trend, color }: {
  icon: any; label: string; value: number | null; unit: string; trend?: number[]; color?: string;
}) {
  return (
    <div className="p-3 rounded border border-[#E5E7EB] bg-white">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-[#6B7280]" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-[#6B7280]">{label}</span>
        </div>
        {trend && trend.length > 2 && <Sparkline values={trend} color={color || '#6B7280'} width={48} height={16} />}
      </div>
      <div className="text-lg font-bold text-[#111827]">
        {value !== null ? (Number.isInteger(value) ? value : value.toFixed(1)) : '—'}
        <span className="text-[10px] font-normal text-[#6B7280] ml-1">{unit}</span>
      </div>
    </div>
  );
}

export function BiometricsPanel({ data }: { data: BiometricSummary }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Vitals (30d averages)</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <Metric icon={Heart} label="Heart Rate" value={data.hr.avg} unit="bpm" trend={data.hr.trend} color="#DC2626" />
        <Metric icon={Activity} label="HRV" value={data.hrv.avg} unit="ms" trend={data.hrv.trend} color="#2563EB" />
        <Metric icon={Moon} label="Sleep" value={data.sleep.avgHours} unit="hrs" trend={data.sleep.trend} color="#7C3AED" />
        <Metric icon={Footprints} label="Steps" value={data.steps.avgDaily} unit="/day" trend={data.steps.trend} color="#059669" />
        <Metric icon={Wind} label="SpO₂" value={data.spo2.avg} unit="%" />
        <Metric icon={Thermometer} label="Skin Temp" value={data.skinTemp.avg} unit="°C" />
      </div>

      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Environment</h3>
      <div className="grid grid-cols-3 gap-2">
        <Metric icon={Wind} label="Pressure" value={data.environment.avgPressure} unit="hPa" />
        <Metric icon={Wind} label="Humidity" value={data.environment.avgHumidity} unit="%" />
        <Metric icon={Wind} label="AQI" value={data.environment.avgAqi} unit="" />
      </div>
    </div>
  );
}
