import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-all duration-200 overflow-hidden",
  {
    variants: {
      variant: {
        default: [
          "bg-gradient-to-r from-[#00ff9d] to-[#00cc7d] text-[#030508]",
          "shadow-[0_0_10px_rgba(0,255,157,0.3)]",
        ].join(" "),
        secondary: [
          "bg-[rgba(0,255,157,0.1)] text-[#00ff9d]",
          "border border-[rgba(0,255,157,0.2)]",
        ].join(" "),
        destructive: [
          "bg-[rgba(255,59,92,0.15)] text-[#ff3b5c]",
          "border border-[rgba(255,59,92,0.3)]",
        ].join(" "),
        outline: [
          "border border-[rgba(0,255,157,0.25)] text-[#00ff9d]",
          "bg-transparent",
        ].join(" "),
        ghost: [
          "text-white/70 bg-white/5",
          "border border-white/10",
        ].join(" "),
        link: "text-[#00ff9d] underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
