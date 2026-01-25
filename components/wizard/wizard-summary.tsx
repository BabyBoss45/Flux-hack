'use client';

import { Check, Pencil, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { WizardSummaryData } from '@/lib/wizard/types';
import { getRoomIcon } from '@/lib/wizard/types';

interface WizardSummaryProps {
  data: WizardSummaryData;
  onEdit: (section: 'global' | 'rooms' | string) => void;
  onConfirm: () => void;
}

export function WizardSummary({ data, onEdit, onConfirm }: WizardSummaryProps) {
  return (
    <div className="panel h-full flex flex-col overflow-hidden">
      <div className="panel-header flex items-center gap-2 flex-shrink-0">
        <Sparkles className="w-5 h-5 text-accent-warm" />
        <h2 className="text-lg font-semibold text-white">Design Brief</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
        {/* Intro message */}
        <div className="flex gap-3">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <Check className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex-1">
            <div className="bg-white/5 rounded-lg px-3 py-2">
              <p className="text-sm text-white/90">Here&apos;s what I&apos;ve got 👇</p>
            </div>
          </div>
        </div>

        {/* Summary Card */}
        <div className="ml-10 space-y-4">
          <div className="bg-gradient-to-br from-white/8 to-white/4 rounded-xl border border-white/10 overflow-hidden">
            {/* Global preferences section */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
                  Design Style
                </h3>
                <button
                  onClick={() => onEdit('global')}
                  className="text-xs text-accent-warm hover:text-accent-warm/80 flex items-center gap-1 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </button>
              </div>

              <div className="space-y-2">
                <SummaryRow
                  label="Style"
                  value={
                    data.styleRefinement && data.globalStyle
                      ? `${data.globalStyle}, ${data.styleRefinement}`
                      : data.globalStyle || 'Not set'
                  }
                />
                <SummaryRow
                  label="Colours"
                  value={data.colorMood || 'Not set'}
                />
                {data.nonNegotiables.length > 0 && (
                  <SummaryRow
                    label="Must-haves"
                    value={data.nonNegotiables.join(', ')}
                  />
                )}
              </div>
            </div>

            {/* Rooms section */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
                  Room Preferences
                </h3>
                <button
                  onClick={() => onEdit('rooms')}
                  className="text-xs text-accent-warm hover:text-accent-warm/80 flex items-center gap-1 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </button>
              </div>

              <div className="space-y-3">
                {data.rooms.map((room, index) => (
                  <RoomSummaryCard key={index} room={room} />
                ))}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={onConfirm}
              className="w-full bg-accent-warm hover:bg-accent-warm/90 text-black font-semibold py-6"
            >
              <Check className="w-4 h-4 mr-2" />
              Looks good — Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            <div className="flex gap-2">
              <Button
                onClick={() => onEdit('rooms')}
                variant="outline"
                className="flex-1 border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit a room
              </Button>
              <Button
                onClick={() => onEdit('global')}
                variant="outline"
                className="flex-1 border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit global style
              </Button>
            </div>
          </div>
        </div>

        {/* Final message */}
        <div className="mt-4 text-center text-white/40 text-xs">
          You can always adjust preferences later
        </div>
      </div>
    </div>
  );
}

// Summary row component
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-white/50 w-20 flex-shrink-0">{label}</span>
      <span className="text-sm text-white font-medium">{value}</span>
    </div>
  );
}

// Room summary card component
function RoomSummaryCard({
  room,
}: {
  room: {
    name: string;
    function?: string;
    furniture?: string[];
    vibe?: string;
    customNotes?: string;
  };
}) {
  const hasPreferences = room.function || room.vibe || (room.furniture && room.furniture.length > 0);

  return (
    <div
      className={cn(
        'rounded-lg p-3 transition-colors',
        hasPreferences ? 'bg-white/5' : 'bg-white/3 border border-dashed border-white/10'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{getRoomIcon(room.name)}</span>
        <span className="text-sm font-semibold text-white">{room.name}</span>
        {hasPreferences && (
          <Check className="w-3.5 h-3.5 text-green-500 ml-auto" />
        )}
      </div>

      {hasPreferences ? (
        <div className="text-xs text-white/60 space-y-0.5 ml-6">
          {room.vibe && <p>Vibe: {room.vibe}</p>}
          {room.function && <p>Use: {room.function}</p>}
          {room.furniture && room.furniture.length > 0 && (
            <p>Includes: {room.furniture.join(', ')}</p>
          )}
          {room.customNotes && (
            <p className="text-white/50 italic">&quot;{room.customNotes}&quot;</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-white/40 ml-6">No preferences set</p>
      )}
    </div>
  );
}

