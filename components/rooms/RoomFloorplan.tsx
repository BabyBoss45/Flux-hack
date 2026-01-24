import { TagPill } from "../common/TagPill";

export type RoomId = "living" | "kitchen" | "bedroom" | "bath";

interface RoomFloorplanProps {
  selectedRoom: RoomId | null;
  onSelectRoom: (room: RoomId) => void;
}

const ROOMS: { id: RoomId; label: string; styleTag: string }[] = [
  { id: "living", label: "Living room", styleTag: "Soft modern" },
  { id: "kitchen", label: "Kitchen", styleTag: "Warm minimal" },
  { id: "bedroom", label: "Bedroom", styleTag: "Hotel calm" },
  { id: "bath", label: "Bathroom", styleTag: "Spa-inspired" }
];

export function RoomFloorplan({ selectedRoom, onSelectRoom }: RoomFloorplanProps) {
  return (
    <section className="panel flex-1 min-h-[420px] flex flex-col relative">
      <div className="panel-header">
        <div>
          <p className="text-xs font-semibold tracking-wide uppercase text-white/60">
            Step 2
          </p>
          <p className="text-sm text-white/80">
            Click a room to design it in detail
          </p>
        </div>
      </div>
      <div className="panel-body flex flex-col gap-4">
        <div className="relative flex-1 min-h-[240px] rounded-xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 overflow-hidden">
          <div className="absolute inset-4 grid grid-cols-2 grid-rows-2 gap-3">
            {ROOMS.map((room) => {
              const isSelected = selectedRoom === room.id;
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => onSelectRoom(room.id)}
                  className={`relative rounded-lg border text-left p-3 text-xs transition-all ${
                    isSelected
                      ? "border-accent/90 bg-accent/20 shadow-[0_0_0_1px_rgba(129,140,248,0.6)]"
                      : "border-white/15 bg-black/40 hover:border-accent/60 hover:bg-black/60"
                  }`}
                >
                  <p className="font-medium text-white/90">{room.label}</p>
                  <p className="text-[11px] text-white/50 mt-1">
                    Click to open “View room” and refine.
                  </p>
                  <div className="mt-2">
                    <TagPill label={room.styleTag} muted={!isSelected} />
                  </div>
                </button>
              );
            })}
          </div>
          <div className="absolute inset-x-6 bottom-4 flex items-center justify-between text-[11px] text-white/45">
            <span>Floor plan (detected rooms)</span>
            <span>Tip: work through each room from left to right.</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-white/60 uppercase tracking-wide">
              Selected room
            </p>
            <p className="text-sm text-white/80">
              {selectedRoom
                ? ROOMS.find((r) => r.id === selectedRoom)?.label
                : "None yet – click a room on the plan."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}


