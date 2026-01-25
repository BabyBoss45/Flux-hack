// Wizard Types

export type WizardStep =
  | 'intro'
  | 'building-type'
  | 'architecture-style'
  | 'atmosphere'
  | 'constraints'
  | 'constraints-custom'
  | 'custom-notes'
  | 'summary'
  | 'complete';

export type BuildingType =
  | 'apartment'
  | 'house'
  | 'condo'
  | 'studio'
  | 'loft'
  | 'villa';

export type ArchitectureStyle =
  | 'modern'
  | 'contemporary'
  | 'traditional'
  | 'minimalist'
  | 'industrial'
  | 'scandinavian'
  | 'mid-century'
  | 'bohemian';

export type Atmosphere =
  | 'cozy'
  | 'elegant'
  | 'vibrant'
  | 'serene'
  | 'professional'
  | 'playful';

export type Constraint =
  | 'pet-friendly'
  | 'child-safe'
  | 'low-maintenance'
  | 'eco-friendly'
  | 'budget-conscious'
  | 'accessibility';

export interface WizardState {
  currentStep: WizardStep;
  buildingType?: BuildingType;
  architectureStyle?: ArchitectureStyle;
  atmosphere?: Atmosphere;
  constraints: Constraint[];
  customNotes?: string;
}

export interface WizardSummaryData {
  buildingType?: string;
  architectureStyle?: string;
  atmosphere?: string;
  constraints?: string[];
  customNotes?: string;
}

// Option definitions
export const BUILDING_TYPE_OPTIONS = [
  { label: 'Apartment', value: 'apartment', icon: '🏢' },
  { label: 'House', value: 'house', icon: '🏠' },
  { label: 'Condo', value: 'condo', icon: '🏙️' },
  { label: 'Studio', value: 'studio', icon: '🛋️' },
  { label: 'Loft', value: 'loft', icon: '🏗️' },
  { label: 'Villa', value: 'villa', icon: '🏡' },
];

export const ARCHITECTURE_STYLE_OPTIONS = [
  { label: 'Modern', value: 'modern', icon: '◻️' },
  { label: 'Contemporary', value: 'contemporary', icon: '◼️' },
  { label: 'Traditional', value: 'traditional', icon: '🏛️' },
  { label: 'Minimalist', value: 'minimalist', icon: '⬜' },
  { label: 'Industrial', value: 'industrial', icon: '🏭' },
  { label: 'Scandinavian', value: 'scandinavian', icon: '❄️' },
  { label: 'Mid-Century', value: 'mid-century', icon: '🪑' },
  { label: 'Bohemian', value: 'bohemian', icon: '🌿' },
];

export const ATMOSPHERE_OPTIONS = [
  { label: 'Cozy', value: 'cozy', icon: '🔥', description: 'Warm and inviting' },
  { label: 'Elegant', value: 'elegant', icon: '✨', description: 'Refined and sophisticated' },
  { label: 'Vibrant', value: 'vibrant', icon: '🎨', description: 'Bold and energetic' },
  { label: 'Serene', value: 'serene', icon: '🌊', description: 'Calm and peaceful' },
  { label: 'Professional', value: 'professional', icon: '💼', description: 'Clean and focused' },
  { label: 'Playful', value: 'playful', icon: '🎈', description: 'Fun and creative' },
];

export const CONSTRAINT_OPTIONS = [
  { label: 'Pet-Friendly', value: 'pet-friendly', icon: '🐾' },
  { label: 'Child-Safe', value: 'child-safe', icon: '👶' },
  { label: 'Low Maintenance', value: 'low-maintenance', icon: '🧹' },
  { label: 'Eco-Friendly', value: 'eco-friendly', icon: '🌱' },
  { label: 'Budget-Conscious', value: 'budget-conscious', icon: '💰' },
  { label: 'Accessibility', value: 'accessibility', icon: '♿' },
];

// Helper function to get label from value
export function getOptionLabel(
  options: { label: string; value: string }[],
  value: string
): string {
  const option = options.find((opt) => opt.value === value);
  return option?.label || value;
}
