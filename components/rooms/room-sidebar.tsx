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
    <div className="w-64 border-r bg-sidebar flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-sidebar-foreground">Rooms</h2>
        <p className="text-xs text-muted-foreground mt-1">
          {approvedCount} of {totalCount} approved
        </p>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(approvedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => {
                console.log(`[ROOM SIDEBAR] Room clicked: ${room.name} (ID: ${room.id})`);
                onSelectRoom(room.id);
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                selectedRoomId === room.id
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'hover:bg-sidebar-accent/50 text-sidebar-foreground'
              )}
            >
              <div
                className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center',
                  room.approved
                    ? 'bg-primary text-primary-foreground'
                    : 'border-2 border-muted-foreground'
                )}
              >
                {room.approved ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Circle className="w-2 h-2" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{room.name}</p>
                <p className="text-xs text-muted-foreground">{room.type}</p>
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
        <div className="p-4 border-t bg-primary/5">
          <div className="flex items-center gap-2 text-sm text-primary">
            <Home className="w-4 h-4" />
            <span className="font-medium">All rooms complete!</span>
          </div>
        </div>
      )}
    </div>
  );
}
