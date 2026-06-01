"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

interface AlertDialogChildProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogActionProps extends AlertDialogChildProps {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
}

interface AlertDialogRootProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface AlertDialogTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export const AlertDialog = ({ children, open, onOpenChange }: AlertDialogRootProps) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = open ?? internalOpen;

  const setIsOpen = React.useCallback(
    (value: boolean) => {
      setInternalOpen(value);
      onOpenChange?.(value);
    },
    [onOpenChange],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => setIsOpen(false)} role="button" tabIndex={-1} aria-label="Close dialog" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setIsOpen(false); }} />
      <div className="relative z-50">{children}</div>
    </div>
  );
};

export const AlertDialogTrigger = ({ children, asChild }: AlertDialogTriggerProps) => {
  if (asChild && React.isValidElement(children)) {
    return children;
  }
  return <>{children}</>;
};

export const AlertDialogContent = ({ children, className }: AlertDialogChildProps) => (
  <div className={cn("bg-background rounded-lg border p-6 shadow-lg", className)}>{children}</div>
);

export const AlertDialogHeader = ({ children }: AlertDialogChildProps) => <div className="mb-4">{children}</div>;

export const AlertDialogTitle = ({ children }: AlertDialogChildProps) => <h3 className="text-lg font-bold">{children}</h3>;

export const AlertDialogDescription = ({ children, className }: AlertDialogChildProps) => (
  <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>
);

export const AlertDialogFooter = ({ children }: AlertDialogChildProps) => (
  <div className="flex justify-end gap-2 mt-4">{children}</div>
);

export const AlertDialogAction = ({ children, onClick, disabled, className }: AlertDialogActionProps) => (
  <button type="button" onClick={onClick} disabled={disabled} className={cn("rounded-md px-4 py-2 text-sm font-medium", className)}>
    {children}
  </button>
);

export const AlertDialogCancel = ({ children, className }: AlertDialogChildProps) => (
  <button type="button" className={cn("rounded-md border px-4 py-2 text-sm font-medium", className)}>{children}</button>
);
