'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface FloorPlanToggleProps {
  floorPlanUrl: string;
  annotatedFloorPlanUrl?: string | null;
}

export function FloorPlanToggle({
  floorPlanUrl,
  annotatedFloorPlanUrl,
}: FloorPlanToggleProps) {
  const [showAnnotated, setShowAnnotated] = useState(true);

  // If no annotated version, just show original
  if (!annotatedFloorPlanUrl) {
    return (
      <div className="space-y-4">
        <div className="relative aspect-video bg-white/5 rounded-lg overflow-hidden">
          <img
            src={floorPlanUrl}
            alt="Floor plan"
            className="object-contain w-full h-full"
          />
        </div>
        <p className="text-xs text-white/50 text-center">Original floor plan</p>
      </div>
    );
  }

  const currentUrl = showAnnotated ? annotatedFloorPlanUrl : floorPlanUrl;
  const currentLabel = showAnnotated ? 'AI-Annotated View' : 'Original View';

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAnnotated(!showAnnotated)}
          className="bg-white/5 border-white/20 hover:bg-white/10 text-white"
        >
          {showAnnotated ? 'Show Original' : 'Show Analysis'}
        </Button>
      </div>

      <div className="relative aspect-video bg-white/5 rounded-lg overflow-hidden">
        <img
          src={currentUrl}
          alt={currentLabel}
          className="object-contain w-full h-full"
        />
      </div>

      <p className="text-xs text-white/50 text-center">{currentLabel}</p>
    </div>
  );
}
