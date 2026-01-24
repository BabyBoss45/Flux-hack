'use client';

import { Check } from 'lucide-react';

interface Room {
  id: number;
  name: string;
  approved: boolean;
}

interface RoomGridProps {
  rooms: Room[];
  selectedRoomId: number | null;
  onSelectRoom: (roomId: number) => void;
}

export function RoomGrid({ rooms, selectedRoomId, onSelectRoom }: RoomGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {rooms.map((room) => (
        <button
          key={room.id}
          onClick={() => onSelectRoom(room.id)}
          className={`
            relative p-4 rounded-lg text-left transition-all
            ${
              selectedRoomId === room.id
                ? 'border-2 border-accent-warm bg-accent-warm/10'
                : 'border border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
            }
          `}
        >
          <span className="font-medium text-white text-sm">{room.name}</span>

          {room.approved && (
            <div className="absolute top-2 right-2">
              <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-3 h-3 text-green-400" />
              </div>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
