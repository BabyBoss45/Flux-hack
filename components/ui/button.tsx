import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-base font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-5 shrink-0 [&_svg]:shrink-0 outline-none",
  {
      variants: {
        variant: {
          default: [
            "bg-gradient-to-r from-[#00ff9d] to-[#00cc7d] text-[#030508] font-semibold",
            "hover:from-[#00ffaa] hover:to-[#00dd8d]",
            "hover:shadow-[0_0_20px_rgba(0,255,157,0.4)]",
            "active:scale-[0.98]",
          ].join(" "),
          destructive: [
            "bg-gradient-to-r from-[#ff3b5c] to-[#e62e4d] text-white",
            "hover:shadow-[0_0_20px_rgba(255,59,92,0.4)]",
            "active:scale-[0.98]",
          ].join(" "),
          outline: [
            "border border-[rgba(0,255,157,0.25)] bg-transparent text-[#00ff9d]",
            "hover:bg-[rgba(0,255,157,0.1)] hover:border-[rgba(0,255,157,0.4)]",
            "hover:shadow-[0_0_15px_rgba(0,255,157,0.2)]",
          ].join(" "),
          secondary: [
            "bg-[rgba(0,255,157,0.1)] text-[#00ff9d] border border-[rgba(0,255,157,0.2)]",
            "hover:bg-[rgba(0,255,157,0.15)] hover:border-[rgba(0,255,157,0.3)]",
          ].join(" "),
          ghost: [
            "text-white/80 hover:text-[#00ff9d]",
            "hover:bg-[rgba(0,255,157,0.1)]",
          ].join(" "),
          link: "text-[#00ff9d] underline-offset-4 hover:underline hover:text-[#00ffaa]",
        },
      size: {
        default: "h-11 px-5 py-2.5 has-[>svg]:px-4",
        xs: "h-7 gap-1 rounded-md px-2.5 text-xs has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 rounded-md gap-1.5 px-4 text-sm has-[>svg]:px-3",
        lg: "h-12 rounded-lg px-8 text-lg has-[>svg]:px-5",
        icon: "size-11",
        "icon-xs": "size-7 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
