'use client';

import { cn } from '@/lib/utils';

interface WizardOptionItem {
  label: string;
  value: string;
  icon?: string;
  color?: string;
  description?: string;
}

interface WizardOptionButtonProps {
  option: WizardOptionItem;
  variant?: 'card' | 'compact' | 'color';
  selected?: boolean;
  onSelect: (value: string) => void;
}

export function WizardOptionButton({
  option,
  variant = 'card',
  selected = false,
  onSelect,
}: WizardOptionButtonProps) {
  if (variant === 'color' && option.color) {
    return (
      <button
        onClick={() => onSelect(option.value)}
        className={cn(
          'flex flex-col items-center gap-2 p-3 rounded-lg border transition-all',
          selected
            ? 'border-accent-warm bg-accent-warm/10'
            : 'border-white/10 hover:border-white/20 hover:bg-white/5'
        )}
      >
        <div
          className="w-8 h-8 rounded-full border-2 border-white/20"
          style={{ backgroundColor: option.color }}
        />
        <span className="text-xs text-white/70">{option.label}</span>
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={() => onSelect(option.value)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-full border transition-all text-sm',
          selected
            ? 'border-accent-warm bg-accent-warm/10 text-accent-warm'
            : 'border-white/10 hover:border-white/20 hover:bg-white/5 text-white/80'
        )}
      >
        {option.icon && <span>{option.icon}</span>}
        <span>{option.label}</span>
      </button>
    );
  }

  // Default: card variant
  return (
    <button
      onClick={() => onSelect(option.value)}
      className={cn(
        'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-center',
        selected
          ? 'border-accent-warm bg-accent-warm/10'
          : 'border-white/10 hover:border-accent-warm/50 hover:bg-white/5'
      )}
    >
      {option.icon && <span className="text-2xl">{option.icon}</span>}
      <span className="text-sm font-medium text-white">{option.label}</span>
      {option.description && (
        <span className="text-xs text-white/50">{option.description}</span>
      )}
    </button>
  );
}

interface WizardOptionsGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}

export function WizardOptionsGrid({ children, columns = 3 }: WizardOptionsGridProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-2', gridCols[columns])}>
      {children}
    </div>
  );
}

interface WizardOptionsPillsProps {
  children: React.ReactNode;
}

export function WizardOptionsPills({ children }: WizardOptionsPillsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {children}
    </div>
  );
}
