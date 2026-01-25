import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base styles
        "h-11 w-full min-w-0 rounded-lg px-4 py-2 text-base",
        // Liquid glass background
        "bg-[rgba(0,255,157,0.03)] backdrop-blur-sm",
        // Border with subtle glow
        "border border-[rgba(0,255,157,0.15)]",
        // Text colors
        "text-white placeholder:text-white/40",
        // File input styles
        "file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        // Selection
        "selection:bg-[rgba(0,255,157,0.3)] selection:text-white",
        // Transitions
        "transition-all duration-200 outline-none",
        // Focus state with green glow
        "focus:border-[rgba(0,255,157,0.5)]",
        "focus:shadow-[0_0_0_1px_rgba(0,255,157,0.2),0_0_15px_rgba(0,255,157,0.15),0_0_30px_rgba(0,255,157,0.05)]",
        // Disabled state
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        // Error state
        "aria-invalid:border-[#ff3b5c] aria-invalid:shadow-[0_0_15px_rgba(255,59,92,0.2)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
