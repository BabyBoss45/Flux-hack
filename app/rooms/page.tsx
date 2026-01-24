"use client";

import { useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { RoomFloorplan, RoomId } from "@/components/rooms/RoomFloorplan";
import { TagPill } from "@/components/common/TagPill";

export default function RoomsPage() {
  const [selectedRoom, setSelectedRoom] = useState<RoomId | null>("living");

  const handleSelectRoom = (room: RoomId) => {
    setSelectedRoom(room);
  };

  return (
    <>
      <div className="flex-1 flex flex-col gap-4">
        <RoomFloorplan selectedRoom={selectedRoom} onSelectRoom={handleSelectRoom} />
        {selectedRoom && (
          <div className="panel flex flex-col text-left overflow-hidden border border-accent/70 shadow-accent/40 max-h-[40vh]">
            <div className="relative w-full h-1/2 min-h-[120px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
              <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_0_0,#6366f1,transparent),radial-gradient(circle_at_100%_100%,#ec4899,transparent)]" />
              <div className="relative h-full flex flex-col items-center justify-center text-center space-y-1 px-4">
                <p className="text-xs font-medium text-white">
                  {selectedRoom === "living" && "Living room render placeholder"}
                  {selectedRoom === "kitchen" && "Kitchen render placeholder"}
                  {selectedRoom === "bedroom" && "Bedroom render placeholder"}
                  {selectedRoom === "bath" && "Bathroom render placeholder"}
                </p>
                <p className="text-[11px] text-white/65 max-w-xs">
                  Generated view of this room. Use the chat to nudge layout, color,
                  and key pieces.
                </p>
              </div>
            </div>
            <div className="px-3 py-2 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
                Objects in this view
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(
                  {
                    living: ["Sofa", "Coffee table", "Media wall", "Rug"],
                    kitchen: ["Island", "Bar stools", "Backsplash", "Pendant lights"],
                    bedroom: ["Bed frame", "Nightstands", "Wardrobe", "Accent chair"],
                    bath: ["Vanity", "Mirror", "Walk-in shower", "Wall sconces"]
                  } as Record<RoomId, string[]>
                )[selectedRoom].map((tag) => (
                  <TagPill key={tag} label={tag} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <ChatPanel
        title="Refine this room with the agent"
        placeholder="Ask to push this room more cozy, more minimal, or swap key furniture pieces..."
      />
    </>
  );
}


