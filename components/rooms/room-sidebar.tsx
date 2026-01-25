'use client';

import { Check, Circle, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface Room {
  id: number;
  name: string;
  type: string;
  approved: boolean;
}

interface RoomSidebarProps {
  rooms: Room[];
  selectedRoomId: number | null;
  onSelectRoom: (roomId: number) => void;
}

export function RoomSidebar({ rooms, selectedRoomId, onSelectRoom }: RoomSidebarProps) {
  const approvedCount = rooms.filter((r) => r.approved).length;
  const totalCount = rooms.length;

  return (
    <div className="w-64 border-r border-[rgba(0,255,157,0.1)] bg-[rgba(10,14,20,0.6)] backdrop-blur-xl flex flex-col h-full">
      <div className="p-4 border-b border-[rgba(0,255,157,0.1)]">
        <h2 className="font-semibold text-white">Rooms</h2>
        <p className="text-xs text-white/50 mt-1">
          {approvedCount} of {totalCount} approved
        </p>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 bg-[rgba(0,255,157,0.05)] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#00ff9d] to-[#00cc7d] shadow-[0_0_10px_rgba(0,255,157,0.5)] transition-all duration-500"
            style={{ width: `${(approvedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => onSelectRoom(room.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200',
                selectedRoomId === room.id
                  ? 'bg-[rgba(0,255,157,0.1)] border border-[rgba(0,255,157,0.3)] shadow-[0_0_15px_rgba(0,255,157,0.1)]'
                  : 'hover:bg-[rgba(0,255,157,0.05)] border border-transparent'
              )}
            >
              <div
                className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200',
                  room.approved
                    ? 'bg-gradient-to-r from-[#00ff9d] to-[#00cc7d] shadow-[0_0_8px_rgba(0,255,157,0.5)]'
                    : 'border-2 border-white/30'
                )}
              >
                {room.approved ? (
                  <Check className="w-3 h-3 text-[#030508]" />
                ) : (
                  <Circle className="w-2 h-2 text-white/30" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className={cn(
                  "font-medium text-sm truncate transition-colors",
                  selectedRoomId === room.id ? "text-[#00ff9d]" : "text-white"
                )}>
                  {room.name}
                </p>
                <p className="text-xs text-white/40">{room.type}</p>
              </div>

              {room.approved && (
                <Badge variant="secondary" className="text-xs">
                  Done
                </Badge>
              )}
            </button>
          ))}
        </div>
      </ScrollArea>

      {approvedCount === totalCount && totalCount > 0 && (
        <div className="p-4 border-t border-[rgba(0,255,157,0.15)] bg-[rgba(0,255,157,0.05)]">
          <div className="flex items-center gap-2 text-sm text-[#00ff9d]">
            <Home className="w-4 h-4" />
            <span className="font-medium">All rooms complete!</span>
          </div>
        </div>
      )}
    </div>
  );
}
