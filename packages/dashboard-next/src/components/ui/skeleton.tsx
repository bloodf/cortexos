import * as React from "react";
import { Skeleton as AstryxSkeleton } from "@astryxdesign/core/Skeleton";
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<typeof AstryxSkeleton>) {
  return <AstryxSkeleton className={cn("rounded-md", className)} {...props} />;
}

export { Skeleton };
