export default function FinalResultPage() {
  return (
    <div className="panel flex-1 min-h-[70vh] flex flex-col">
      <div className="panel-header">
        <div>
          <p className="text-xs font-semibold tracking-wide uppercase text-white/60">
            Step 3
          </p>
          <p className="text-sm text-white/80">
            Final designed floor plan – ready to share
          </p>
        </div>
      </div>
      <div className="panel-body flex flex-col gap-6">
        <div className="relative w-full aspect-[32/9] rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 overflow-hidden">
          <div className="absolute inset-0 opacity-35 bg-[radial-gradient(circle_at_0_0,#6366f1,transparent),radial-gradient(circle_at_100%_0,#22c55e,transparent),radial-gradient(circle_at_50%_100%,#ec4899,transparent)]" />
          <div className="relative h-full flex flex-col items-center justify-center text-center space-y-3 px-8">
            <p className="text-base font-semibold text-white tracking-tight">
              Full floor plan render placeholder
            </p>
            <p className="text-xs text-white/70 max-w-2xl">
              This view stitches together all room generations into a single
              coherent plan. Use it as a shareable link for clients or as a
              blueprint handoff for builders and contractors.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-white/75 items-stretch">
          <div className="panel bg-white/5 border-white/10 shadow-sm p-4 space-y-2 h-full flex flex-col justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
              Summary
            </p>
            <p>
              Calm, light-filled interior with warm woods, soft textiles, and
              clean-lined furniture across all rooms.
            </p>
          </div>
          <div className="panel bg-white/5 border-white/10 shadow-sm p-4 space-y-2 h-full flex flex-col justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
              Key decisions
            </p>
            <p>
              Open living / kitchen connection, generous circulation, and clear
              anchor walls for main furniture groupings.
            </p>
          </div>
          <div className="panel bg-white/5 border-white/10 shadow-sm p-4 space-y-3 h-full flex flex-col justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
              Next steps
            </p>
            <p>
              Export this as a shareable link or run another pass focusing on
              a different style direction.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase text-white shadow-md hover:bg-accent/90 transition-colors"
              >
                Download report
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-white/25 px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase text-white/90 hover:bg-white/10 transition-colors"
              >
                Share
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


