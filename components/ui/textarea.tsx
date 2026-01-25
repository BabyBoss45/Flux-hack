import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // Base styles
        "flex field-sizing-content min-h-16 w-full rounded-lg px-4 py-3 text-base",
        // Liquid glass background
        "bg-[rgba(0,255,157,0.03)] backdrop-blur-sm",
        // Border with subtle glow
        "border border-[rgba(0,255,157,0.15)]",
        // Text colors
        "text-white placeholder:text-white/40",
        // Selection
        "selection:bg-[rgba(0,255,157,0.3)] selection:text-white",
        // Transitions
        "transition-all duration-200 outline-none",
        // Focus state with green glow
        "focus:border-[rgba(0,255,157,0.5)]",
        "focus:shadow-[0_0_0_1px_rgba(0,255,157,0.2),0_0_15px_rgba(0,255,157,0.15),0_0_30px_rgba(0,255,157,0.05)]",
        // Disabled state
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Error state
        "aria-invalid:border-[#ff3b5c] aria-invalid:shadow-[0_0_15px_rgba(255,59,92,0.2)]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
