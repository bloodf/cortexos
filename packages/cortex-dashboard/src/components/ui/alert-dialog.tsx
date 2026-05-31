"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export const AlertDialog = ({ children, open, onOpenChange }: any) => <div>{children}</div>;
export const AlertDialogTrigger = ({ children }: any) => <>{children}</>;
export const AlertDialogContent = ({ children, className }: any) => <div className={cn("p-4", className)}>{children}</div>;
export const AlertDialogHeader = ({ children }: any) => <div className="mb-4">{children}</div>;
export const AlertDialogTitle = ({ children }: any) => <h3 className="text-lg font-bold">{children}</h3>;
export const AlertDialogDescription = ({ children }: any) => <p className="text-sm text-muted-foreground">{children}</p>;
export const AlertDialogFooter = ({ children }: any) => <div className="flex justify-end gap-2 mt-4">{children}</div>;
export const AlertDialogAction = ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>;
export const AlertDialogCancel = ({ children }: any) => <button>{children}</button>;
