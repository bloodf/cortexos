import { FlaskConical, Flame, Heart, Wifi, WifiOff, Cpu } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { live } from "@/lib/drift";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Admin-only menu that lets the demo simulate failure / recovery scenarios.
 * Pure mock — mutates the in-memory drift store.
 */
export function SimulateMenu() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries();
  };

  const crash = () => {
    const target = (live as any).crashRandom?.();
    if (target) {
      toast.error(`${target.name} went down`, { description: "Simulated health-check failure." });
    } else {
      toast.info("Everything already offline");
    }
    refresh();
  };

  const heal = () => {
    (live as any).healAll?.();
    toast.success("All services healed", { description: "Simulated recovery." });
    refresh();
  };

  const cpuSpike = () => {
    const sys = (live as any).system?.() as any;
    if (sys) sys.cpu = 96;
    toast.warning("CPU pinned to 96%");
    qc.setQueryData(["system"], { ...sys });
  };

  const networkBlip = () => {
    const net = (live as any).network?.() as any;
    if (net) net.interfaces = net.interfaces.map((i: any) => ({ ...i, rxKbps: 9500, txKbps: 5800 }));
    toast.warning("Network saturated");
    qc.setQueryData(["network"], { ...net });
  };

  const netCalm = () => {
    const net = (live as any).network?.() as any;
    if (net) net.interfaces = net.interfaces.map((i: any) => ({ ...i, rxKbps: 120, txKbps: 80 }));
    qc.setQueryData(["network"], { ...net });
    toast.success("Network back to baseline");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="ghost" size="icon" aria-label="Simulate scenarios" title="Simulate scenarios">
          <FlaskConical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Simulate (demo only)</DropdownMenuLabel>
        <DropdownMenuItem onClick={crash} className="gap-2"><Flame className="size-3.5 text-destructive" />Crash random service</DropdownMenuItem>
        <DropdownMenuItem onClick={heal} className="gap-2"><Heart className="size-3.5 text-[var(--success)]" />Heal everything</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={cpuSpike} className="gap-2"><Cpu className="size-3.5 text-[var(--warning)]" />CPU spike</DropdownMenuItem>
        <DropdownMenuItem onClick={networkBlip} className="gap-2"><WifiOff className="size-3.5 text-[var(--warning)]" />Saturate network</DropdownMenuItem>
        <DropdownMenuItem onClick={netCalm} className="gap-2"><Wifi className="size-3.5 text-[var(--success)]" />Calm network</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
