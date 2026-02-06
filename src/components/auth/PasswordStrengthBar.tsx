import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordStrengthBarProps {
  password: string;
}

interface Requirement {
  label: string;
  met: boolean;
}

export const PasswordStrengthBar = ({ password }: PasswordStrengthBarProps) => {
  const requirements = useMemo((): Requirement[] => [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
  ], [password]);

  const strength = useMemo(() => {
    const metCount = requirements.filter(r => r.met).length;
    if (metCount === 0) return { level: 0, label: '', color: 'bg-muted' };
    if (metCount === 1) return { level: 25, label: 'Weak', color: 'bg-red-500' };
    if (metCount === 2) return { level: 50, label: 'Fair', color: 'bg-orange-500' };
    if (metCount === 3) return { level: 75, label: 'Good', color: 'bg-yellow-500' };
    return { level: 100, label: 'Strong', color: 'bg-green-500' };
  }, [requirements]);

  const allMet = requirements.every(r => r.met);

  if (!password) return null;

  return (
    <div className="space-y-3 p-3 bg-muted/50 rounded-xl animate-in fade-in-0 slide-in-from-top-2 duration-200">
      {/* Strength bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Password strength</span>
          <span className={cn(
            "text-xs font-semibold",
            strength.level === 100 ? "text-green-600" : 
            strength.level >= 75 ? "text-yellow-600" :
            strength.level >= 50 ? "text-orange-600" :
            "text-red-600"
          )}>
            {strength.label}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn("h-full transition-all duration-300 rounded-full", strength.color)}
            style={{ width: `${strength.level}%` }}
          />
        </div>
      </div>

      {/* Requirements list */}
      <div className="space-y-1.5">
        {requirements.map((req, idx) => (
          <div 
            key={idx}
            className={cn(
              "flex items-center gap-2 text-xs transition-colors duration-200",
              req.met ? "text-green-600" : "text-muted-foreground"
            )}
          >
            {req.met ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <X className="w-3.5 h-3.5" />
            )}
            <span>{req.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const isPasswordStrong = (password: string): boolean => {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
};
