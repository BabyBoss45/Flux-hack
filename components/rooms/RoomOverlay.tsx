import { RoomId } from "./RoomFloorplan";
import { TagPill } from "../common/TagPill";

interface RoomOverlayProps {
  open: boolean;
  room: RoomId | null;
  onClose: () => void;
}

const ROOM_OBJECT_TAGS: Record<RoomId, string[]> = {
  living: ["Sofa", "Coffee table", "Media wall", "Rug"],
  kitchen: ["Island", "Bar stools", "Backsplash", "Pendant lights"],
  bedroom: ["Bed frame", "Nightstands", "Wardrobe", "Accent chair"],
  bath: ["Vanity", "Mirror", "Walk-in shower", "Wall sconces"]
};

const ROOM_LABELS: Record<RoomId, string> = {
  living: "Living room",
  kitchen: "Kitchen",
  bedroom: "Bedroom",
  bath: "Bathroom"
};

export function RoomOverlay({ open, room, onClose }: RoomOverlayProps) {
  if (!open || !room) return null;

  const objectTags = ROOM_OBJECT_TAGS[room] ?? [];

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center bg-black/60 backdrop-blur-sm px-4 py-8">
      <div className="panel max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden border-accent/40 shadow-2xl shadow-accent/35">
        <div className="panel-header">
          <div>
            <p className="text-xs font-semibold tracking-wide uppercase text-white/60">
              View room
            </p>
            <p className="text-sm text-white/80">
              {ROOM_LABELS[room]} – generated concept
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] px-3 py-1.5 rounded-full border border-white/15 text-white/70 hover:bg-white/10 transition-colors"
          >
            Back to floor plan
          </button>
        </div>
        <div className="panel-body flex flex-col gap-4 overflow-y-auto">
          <div className="relative w-full aspect-[16/9] rounded-xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_0_0,#6366f1,transparent),radial-gradient(circle_at_100%_100%,#ec4899,transparent)]" />
            <div className="relative text-center space-y-2 px-6">
              <p className="text-sm font-medium text-white">
                {ROOM_LABELS[room]} render placeholder
              </p>
              <p className="text-xs text-white/60 max-w-md mx-auto">
                This is where the AI-generated room image will appear. Use the
                chat on the right to nudge layout, color, and furniture until
                it feels right.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-white/60 uppercase tracking-wide">
              Objects in this view
            </p>
            <div className="flex flex-wrap gap-2">
              {objectTags.map((tag) => (
                <TagPill key={tag} label={tag} muted />
              ))}
            </div>
            <p className="text-[11px] text-white/40">
              These will be bound to editable prompts so you can say things like
              “make the sofa lower and more sculptural” or “swap the rug for a
              bolder pattern”.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


