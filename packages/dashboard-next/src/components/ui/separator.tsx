import * as React from "react";
import { Divider as AstryxDivider } from "@astryxdesign/core/Divider";
import { cn } from "@/lib/utils";

const Separator = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof AstryxDivider>>(
  ({ className, orientation = "horizontal", ...props }, ref) => (
    <AstryxDivider
      ref={ref}
      orientation={orientation}
      className={cn(orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]", className)}
      {...props}
    />
  ),
);
Separator.displayName = "Separator";

export { Separator };
