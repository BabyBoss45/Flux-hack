import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded-md",
        "bg-[rgba(0,255,157,0.05)]",
        "border border-[rgba(0,255,157,0.08)]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
