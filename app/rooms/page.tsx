"use client";

import { useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { RoomFloorplan, RoomId } from "@/components/rooms/RoomFloorplan";
import { RoomOverlay } from "@/components/rooms/RoomOverlay";

export default function RoomsPage() {
  const [selectedRoom, setSelectedRoom] = useState<RoomId | null>("living");
  const [overlayOpen, setOverlayOpen] = useState(false);

  const handleSelectRoom = (room: RoomId) => {
    setSelectedRoom(room);
  };

  const handleViewRoom = () => {
    if (!selectedRoom) return;
    setOverlayOpen(true);
  };

  const handleCloseOverlay = () => {
    setOverlayOpen(false);
  };

  return (
    <>
      <RoomOverlay open={overlayOpen} room={selectedRoom} onClose={handleCloseOverlay} />
      <div className="flex-1 flex flex-col gap-4">
        <RoomFloorplan selectedRoom={selectedRoom} onSelectRoom={handleSelectRoom} />
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-white/45">
            Click a room on the plan, then open a focused view to iterate on details.
          </p>
          <button
            type="button"
            onClick={handleViewRoom}
            className="inline-flex items-center gap-1 rounded-full bg-accent px-4 py-1.5 text-[11px] font-semibold tracking-wide uppercase text-white shadow-md hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!selectedRoom}
          >
            View room
          </button>
        </div>
      </div>
      <ChatPanel
        title="Refine this room with the agent"
        placeholder="Ask to push this room more cozy, more minimal, or swap key furniture pieces..."
      />
    </>
  );
}


