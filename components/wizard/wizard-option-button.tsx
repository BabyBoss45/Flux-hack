'use client';

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import type { WizardOption } from '@/lib/wizard/types';

interface WizardOptionButtonProps {
  option: WizardOption;
  selected?: boolean;
  onSelect: (value: string) => void;
  variant?: 'default' | 'card' | 'color' | 'compact';
  disabled?: boolean;
}

export function WizardOptionButton({
  option,
  selected = false,
  onSelect,
  variant = 'default',
  disabled = false,
}: WizardOptionButtonProps) {
  const handleClick = () => {
    if (!disabled) {
      onSelect(option.value);
    }
  };

  // Color swatch variant
  if (variant === 'color' && option.color) {
    return (
      <button
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          'group relative flex flex-col items-center gap-3 p-4 rounded-xl transition-all duration-200',
          'bg-white/5 border border-white/10',
          'hover:bg-white/10 hover:scale-105 active:scale-95',
          selected
            ? 'ring-2 ring-accent-warm ring-offset-2 ring-offset-background border-accent-warm'
            : 'hover:border-white/20',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div
          className={cn(
            'w-14 h-14 rounded-full shadow-lg transition-transform',
            selected && 'ring-2 ring-white'
          )}
          style={{ backgroundColor: option.color }}
        />
        <span className="text-sm text-white font-medium">{option.label}</span>
        {option.description && (
          <span className="text-xs text-white/50">{option.description}</span>
        )}
        {selected && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-accent-warm rounded-full flex items-center justify-center">
            <Check className="w-4 h-4 text-black" />
          </div>
        )}
      </button>
    );
  }

  // Card variant with icon and description
  if (variant === 'card') {
    return (
      <button
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          'group relative flex flex-col items-center justify-center text-center p-5 rounded-xl transition-all duration-200 min-h-[120px]',
          'bg-white/5 border border-white/10',
          'hover:bg-white/10 hover:border-white/20 hover:scale-[1.02]',
          'active:scale-[0.98]',
          selected && 'bg-accent-warm/20 border-accent-warm ring-1 ring-accent-warm',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {option.icon && (
          <span className="text-3xl mb-3">{option.icon}</span>
        )}
        <span className={cn(
          'text-base font-semibold leading-tight',
          selected ? 'text-accent-warm' : 'text-white'
        )}>
          {option.label}
        </span>
        {option.description && (
          <span className="text-sm text-white/60 mt-1.5 leading-snug">{option.description}</span>
        )}
        {selected && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-accent-warm rounded-full flex items-center justify-center">
            <Check className="w-4 h-4 text-black" />
          </div>
        )}
      </button>
    );
  }

  // Compact variant for multi-select
  if (variant === 'compact') {
    return (
      <button
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-200',
          'border text-sm font-medium',
          selected
            ? 'bg-accent-warm text-black border-accent-warm'
            : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10 hover:border-white/20',
          'hover:scale-[1.02] active:scale-[0.98]',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {option.icon && <span>{option.icon}</span>}
        <span>{option.label}</span>
        {selected && <Check className="w-4 h-4" />}
      </button>
    );
  }

  // Default button variant
  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center gap-2 px-5 py-3 rounded-xl transition-all duration-200',
        'border text-sm font-medium min-w-[120px]',
        selected
          ? 'bg-accent-warm text-black border-accent-warm shadow-lg shadow-accent-warm/20'
          : 'bg-white/5 text-white border-white/10 hover:bg-white/10 hover:border-white/20',
        'hover:scale-[1.02] active:scale-[0.98]',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {option.icon && <span className="text-lg">{option.icon}</span>}
      <span>{option.label}</span>
    </button>
  );
}

// Grid wrapper for options
interface WizardOptionsGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}

export function WizardOptionsGrid({ children, columns = 3 }: WizardOptionsGridProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-4', gridCols[columns])}>
      {children}
    </div>
  );
}

// Flex wrapper for compact options (pills)
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

