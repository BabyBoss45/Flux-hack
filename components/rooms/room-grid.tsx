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
    <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-1">
      {rooms.map((room) => (
        <button
          key={room.id}
          onClick={() => onSelectRoom(room.id)}
          className={`
            relative p-3 rounded-lg text-left transition-all
            ${
              selectedRoomId === room.id
                ? 'border border-[rgba(0,255,157,0.5)] bg-[rgba(0,255,157,0.1)] shadow-[0_0_10px_rgba(0,255,157,0.15)]'
                : 'border border-white/10 bg-white/5 hover:border-[rgba(0,255,157,0.3)] hover:bg-[rgba(0,255,157,0.05)]'
            }
          `}
        >
          <span className={`font-medium text-xs ${selectedRoomId === room.id ? 'text-[#00ff9d]' : 'text-white'}`}>{room.name}</span>

          {room.approved && (
            <div className="absolute top-2 right-2">
              <div className="w-5 h-5 rounded-full bg-[rgba(0,255,157,0.2)] border border-[rgba(0,255,157,0.3)] flex items-center justify-center">
                <Check className="w-3 h-3 text-[#00ff9d]" />
              </div>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
