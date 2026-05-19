"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Service } from "./service-row";

export interface ServiceTogglesProps {
  services: Service[];
  onToggle: (id: number, active: boolean) => void;
}

export function ServiceToggles({ services, onToggle }: ServiceTogglesProps) {
  if (services.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-8 text-center text-sm text-white/40 light:text-slate-700">
        No services to display.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-white/[0.04] hover:bg-transparent">
            <TableHead className="text-white/40 light:text-slate-700 text-xs font-medium">
              Name
            </TableHead>
            <TableHead className="text-white/40 light:text-slate-700 text-xs font-medium">
              Category
            </TableHead>
            <TableHead className="text-white/40 light:text-slate-700 text-xs font-medium w-24">
              Active
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((svc) => (
            <TableRow
              key={svc.id}
              className="border-b border-white/[0.02] hover:bg-white/[0.02]"
            >
              <TableCell className="text-white/70 light:text-slate-700 text-sm">
                {svc.name}
              </TableCell>
              <TableCell className="text-white/40 light:text-slate-700 text-sm">
                {svc.category}
              </TableCell>
              <TableCell>
                <button
                  onClick={() => onToggle(svc.id, !svc.is_active)}
                  data-testid={`toggle-${svc.id}`}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    svc.is_active ? "bg-emerald-500/30" : "bg-white/[0.06]"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
                      svc.is_active
                        ? "translate-x-4 bg-emerald-400"
                        : "translate-x-0.5 bg-white/30 light:bg-slate-100"
                    }`}
                  />
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
