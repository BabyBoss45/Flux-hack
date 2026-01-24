'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ItemEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageId: number;
  imageUrl: string;
  onSubmit: (imageId: number, editPrompt: string) => Promise<void>;
}

export function ItemEditDialog({
  open,
  onOpenChange,
  imageId,
  imageUrl,
  onSubmit,
}: ItemEditDialogProps) {
  const [editPrompt, setEditPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!editPrompt.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(imageId, editPrompt);
      setEditPrompt('');
      onOpenChange(false);
    } catch (error) {
      console.error('Edit failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const suggestions = [
    'Change the sofa to a sectional',
    'Make the walls a warmer color',
    'Add a floor lamp in the corner',
    'Replace the coffee table with a round one',
    'Add plants near the window',
    'Change the curtains to linen',
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-surface border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">Edit Room Design</DialogTitle>
          <DialogDescription className="text-white/60">
            Describe what you&apos;d like to change in this image
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Preview */}
          <div className="rounded-lg overflow-hidden border border-white/10 bg-white/5">
            <img
              src={imageUrl}
              alt="Current design"
              className="w-full h-48 object-cover"
            />
          </div>

          {/* Edit prompt */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">What would you like to change?</label>
            <Textarea
              placeholder="e.g., Replace the blue sofa with a cream-colored sectional..."
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              rows={3}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
            />
          </div>

          {/* Suggestions */}
          <div className="space-y-2">
            <label className="text-xs text-white/50">Quick suggestions:</label>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setEditPrompt(suggestion)}
                  className="px-2 py-1 text-xs rounded-full border border-white/20 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!editPrompt.trim() || isSubmitting}
            className="bg-accent-warm hover:bg-accent-warm/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Applying changes...
              </>
            ) : (
              'Apply Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
