"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import type { Service } from "./service-row";

export interface ServiceTogglesProps {
  services: Service[];
  onToggle: (id: number, active: boolean) => void;
}

export function ServiceToggles({ services, onToggle }: ServiceTogglesProps) {
  if (services.length === 0) {
    return (
      <EmptyState
        title="No services"
        description="No services to display."
      />
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs font-medium text-muted-foreground">
              Name
            </TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground">
              Category
            </TableHead>
            <TableHead className="w-24 text-xs font-medium text-muted-foreground">
              Active
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((svc) => (
            <TableRow key={svc.id}>
              <TableCell className="text-sm text-foreground">
                {svc.name}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {svc.category}
              </TableCell>
              <TableCell>
                <Switch
                  checked={svc.is_active}
                  onCheckedChange={(v) => onToggle(svc.id, v)}
                  data-testid={`toggle-${svc.id}`}
                  aria-label={`Toggle ${svc.name}`}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
