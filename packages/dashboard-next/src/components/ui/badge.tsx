import * as React from "react";
import { Badge as AstryxBadge } from "@astryxdesign/core/Badge";
import { badgeVariants, type BadgeVariantProps } from "./badge-variants";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, BadgeVariantProps {}

function Badge({ className, variant, children, ...props }: BadgeProps) {
  const label = React.Children.toArray(children).join("");
  const astryxVariant =
    variant === "destructive"
      ? "error"
      : variant === "secondary"
        ? "neutral"
        : variant === "outline"
          ? "neutral"
          : "info";

  return (
    <AstryxBadge
      label={label || "Badge"}
      variant={astryxVariant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge };
