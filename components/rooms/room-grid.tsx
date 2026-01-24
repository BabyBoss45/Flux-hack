'use client';

import { Check } from 'lucide-react';

interface Room {
  key: string;
  name: string;
  approved: boolean;
}

interface RoomGridProps {
  rooms: Room[];
  selectedRoomKey: string | null;
  onSelectRoom: (roomKey: string) => void;
}

export function RoomGrid({ rooms, selectedRoomKey, onSelectRoom }: RoomGridProps) {
  if (rooms.length === 0) {
    return (
      <div className="text-white/50 text-sm p-2">No rooms available</div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      {rooms.map((room) => {
        const isSelected = selectedRoomKey === room.key;
        return (
          <button
            key={room.key}
            onClick={() => {
              console.log('🔥🔥🔥 ROOM BUTTON CLICKED 🔥🔥🔥', {
                roomKey: room.key,
                roomName: room.name,
                isCurrentlySelected: isSelected,
                timestamp: new Date().toISOString(),
              });
              console.trace('Room button click stack trace');
              onSelectRoom(room.key);
            }}
            className={`
              relative p-3 rounded-lg text-left transition-all
              ${
                isSelected
                  ? 'border-2 border-accent-warm bg-accent-warm/10'
                  : 'border border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
              }
            `}
          >
            <span className={`font-medium text-xs ${isSelected ? 'text-white' : 'text-white/90'}`}>
              {room.name}
            </span>

            {room.approved && (
              <div className="absolute top-2 right-2">
                <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="w-3 h-3 text-green-400" />
                </div>
              </div>
            )}
            
            {isSelected && (
              <div className="absolute top-2 left-2">
                <div className="w-2 h-2 rounded-full bg-accent-warm" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
