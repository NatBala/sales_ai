import * as React from "react"
import * as TooltipPrimitives from "@radix-ui/react-tooltip"
import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitives.Provider
const Tooltip = TooltipPrimitives.Root
const TooltipTrigger = TooltipPrimitives.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitives.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitives.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitives.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn("z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95", className)}
    {...props}
  />
))
TooltipContent.displayName = TooltipPrimitives.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
