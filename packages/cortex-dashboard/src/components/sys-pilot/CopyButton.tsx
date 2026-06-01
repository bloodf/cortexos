"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyButton({ value, className, size = "sm" }: { value: string; className?: string; size?: "sm" | "xs" }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(size === "xs" ? "size-6" : "size-7", className)}
      onClick={() => { navigator.clipboard.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }); }}
      aria-label="Copy"
    >
      {done ? <Check className="size-3.5 text-[var(--success)]" /> : <Copy className="size-3.5" />}
    </Button>
  );
}
