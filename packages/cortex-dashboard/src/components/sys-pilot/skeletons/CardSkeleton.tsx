"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function CardSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-full" />
    </div>
  );
}
