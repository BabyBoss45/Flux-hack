'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Preferences {
  style?: string;
  colors?: string;
  budget?: string;
  notes?: string;
}

interface PreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  initialPreferences: Preferences;
  onSave: (preferences: Preferences) => Promise<void>;
}

const STYLE_OPTIONS = [
  'Modern',
  'Contemporary',
  'Minimalist',
  'Scandinavian',
  'Industrial',
  'Mid-Century Modern',
  'Traditional',
  'Transitional',
  'Bohemian',
  'Coastal',
  'Farmhouse',
  'Art Deco',
];

const COLOR_OPTIONS = [
  'Neutral tones',
  'Warm earth tones',
  'Cool blues and grays',
  'Bold and vibrant',
  'Monochromatic',
  'Pastels',
  'Jewel tones',
  'Black and white',
];

const BUDGET_OPTIONS = [
  'Budget-friendly',
  'Mid-range',
  'High-end',
  'Luxury',
];

export function PreferencesDialog({
  open,
  onOpenChange,
  initialPreferences,
  onSave,
}: PreferencesDialogProps) {
  const [preferences, setPreferences] = useState<Preferences>(initialPreferences);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setPreferences(initialPreferences);
  }, [initialPreferences, open]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(preferences);
      onOpenChange(false);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Design Preferences</DialogTitle>
          <DialogDescription>
            Set your style preferences to guide the AI designer
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Style */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Design Style</label>
            <div className="flex flex-wrap gap-2">
              {STYLE_OPTIONS.map((style) => (
                <button
                  key={style}
                  onClick={() => setPreferences({ ...preferences, style })}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                    preferences.style === style
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Colors */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Color Palette</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  onClick={() => setPreferences({ ...preferences, colors: color })}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                    preferences.colors === color
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Budget Range</label>
            <div className="flex flex-wrap gap-2">
              {BUDGET_OPTIONS.map((budget) => (
                <button
                  key={budget}
                  onClick={() => setPreferences({ ...preferences, budget })}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                    preferences.budget === budget
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  {budget}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Additional Notes</label>
            <Textarea
              placeholder="Any specific requirements, inspirations, or things to avoid..."
              value={preferences.notes || ''}
              onChange={(e) => setPreferences({ ...preferences, notes: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
