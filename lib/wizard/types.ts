// Design Brief Wizard Types - Button-first questionnaire

export type WizardStep =
  | 'intro'
  | 'building-type'
  | 'architecture-style'
  | 'atmosphere'
  | 'constraints'
  | 'constraints-custom'
  | 'complete';

// Step 1: Building Type
export type BuildingType =
  | 'apartment'
  | 'house'
  | 'studio'
  | 'office'
  | 'commercial'
  | 'other';

// Step 2: Architecture Style
export type ArchitectureStyle =
  | 'modern'
  | 'scandinavian'
  | 'japandi'
  | 'minimal'
  | 'industrial'
  | 'classic'
  | 'not-sure';

// Step 3: Atmosphere
export type Atmosphere =
  | 'warm-cozy'
  | 'calm-minimal'
  | 'bright-airy'
  | 'elegant'
  | 'bold'
  | 'neutral';

// Step 4: Constraints (multi-select)
export type Constraint =
  | 'kid-friendly'
  | 'pet-friendly'
  | 'storage-focused'
  | 'budget-conscious'
  | 'sustainable'
  | 'luxury';

export interface WizardState {
  currentStep: WizardStep;
  buildingType?: BuildingType;
  architectureStyle?: ArchitectureStyle;
  atmosphere?: Atmosphere;
  constraints: Constraint[];
  customNotes?: string;
}

export interface WizardOption {
  label: string;
  value: string;
  icon?: string;
  color?: string;
  description?: string;
}

export interface WizardSummaryData {
  buildingType?: string;
  architectureStyle?: string;
  atmosphere?: string;
  constraints: string[];
  customNotes?: string;
}

// Global preferences JSON structure (stored in projects.global_preferences)
export interface GlobalPreferences {
  constraints?: string[];
  custom_notes?: string;
  wizardCompleted?: boolean;
}

// Step 1 Options: Building Type
export const BUILDING_TYPE_OPTIONS: WizardOption[] = [
  { label: 'Apartment', value: 'apartment', icon: '🏢' },
  { label: 'House', value: 'house', icon: '🏠' },
  { label: 'Studio', value: 'studio', icon: '🏠' },
  { label: 'Office', value: 'office', icon: '🏢' },
  { label: 'Commercial', value: 'commercial', icon: '🏪' },
  { label: 'Other', value: 'other', icon: '🏗️' },
];

// Step 2 Options: Architecture Style
export const ARCHITECTURE_STYLE_OPTIONS: WizardOption[] = [
  { label: 'Modern', value: 'modern', icon: '🏢', description: 'Clean lines, open spaces' },
  { label: 'Scandinavian', value: 'scandinavian', icon: '🌿', description: 'Light, functional, cozy' },
  { label: 'Japandi', value: 'japandi', icon: '🎋', description: 'Japanese + Scandinavian' },
  { label: 'Minimal', value: 'minimal', icon: '⬜', description: 'Less is more' },
  { label: 'Industrial', value: 'industrial', icon: '🏭', description: 'Raw, urban, edgy' },
  { label: 'Classic', value: 'classic', icon: '🏛️', description: 'Timeless elegance' },
  { label: 'Not sure', value: 'not-sure', icon: '🤔', description: 'Help me decide' },
];

// Step 3 Options: Atmosphere
export const ATMOSPHERE_OPTIONS: WizardOption[] = [
  { label: 'Warm & cozy', value: 'warm-cozy', icon: '🔥', color: '#E8D5B7' },
  { label: 'Calm & minimal', value: 'calm-minimal', icon: '🌿', color: '#C4D4C4' },
  { label: 'Bright & airy', value: 'bright-airy', icon: '☀️', color: '#F5F5F5' },
  { label: 'Elegant', value: 'elegant', icon: '✨', color: '#D4AF37' },
  { label: 'Bold', value: 'bold', icon: '🎯', color: '#1A1A1A' },
  { label: 'Neutral', value: 'neutral', icon: '⚪', color: '#A0A5A8' },
];

// Step 4 Options: Constraints (multi-select)
export const CONSTRAINT_OPTIONS: WizardOption[] = [
  { label: 'Kid-friendly', value: 'kid-friendly', icon: '👶' },
  { label: 'Pet-friendly', value: 'pet-friendly', icon: '🐕' },
  { label: 'Storage focused', value: 'storage-focused', icon: '📦' },
  { label: 'Budget conscious', value: 'budget-conscious', icon: '💰' },
  { label: 'Sustainable materials', value: 'sustainable', icon: '🌱' },
  { label: 'Luxury finishes', value: 'luxury', icon: '✨' },
];

// Helper to get label from options
export const getOptionLabel = (options: WizardOption[], value: string): string => {
  return options.find(o => o.value === value)?.label || value;
};

// Legacy exports for backwards compatibility (will be removed)
export const GLOBAL_STYLE_OPTIONS = ARCHITECTURE_STYLE_OPTIONS;
export const COLOR_MOOD_OPTIONS = ATMOSPHERE_OPTIONS;
export const NON_NEGOTIABLE_OPTIONS = CONSTRAINT_OPTIONS;
