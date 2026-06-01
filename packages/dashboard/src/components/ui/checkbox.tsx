"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input type="checkbox" ref={ref} className={cn("size-4 rounded border", className)} {...props} />
  )
);
Checkbox.displayName = "Checkbox";
