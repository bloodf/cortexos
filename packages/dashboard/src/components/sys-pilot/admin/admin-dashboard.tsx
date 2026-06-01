"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Service } from "@/lib/types";
export function AdminDashboard({ services }: { services: Service[] }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle>Services</CardTitle></CardHeader><CardContent>{services.length} services</CardContent></Card>
      </div>
    </div>
  );
}
