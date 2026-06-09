import { useEffect, useMemo, useState } from "react";
import { Responsive, WidthProvider, type LayoutItem } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Plus, Pencil, Check, RotateCcw, X, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { StatusHero } from "@/components/StatusHero";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/useT";
import { WIDGETS, WIDGET_MAP, DEFAULT_LAYOUT } from "./overview/widgets";
import { cn } from "@/lib/utils";

const ResponsiveGrid = WidthProvider(Responsive);
const STORAGE_KEY = "cortex.overview.layout.v3";

interface Stored { items: { i: string; x: number; y: number; w: number; h: number }[] }

function load(): Stored {
  if (typeof window === "undefined") return { items: DEFAULT_LAYOUT };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Stored;
      if (parsed?.items?.length) return parsed;
    }
  } catch { /* noop */ }
  return { items: DEFAULT_LAYOUT };
}

function save(s: Stored) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* noop */ }
}

export function OverviewPage() {
  const t = useT();
  const [state, setState] = useState<Stored>(() => load());
  const [editing, setEditing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { save(state); }, [state]);

  const items = state.items.filter((it) => WIDGET_MAP[it.i]);
  const usedIds = new Set(items.map((i) => i.i));
  const available = WIDGETS.filter((w) => !usedIds.has(w.id));

  const layout: LayoutItem[] = useMemo(() => items.map((it) => ({
    i: it.i, x: it.x, y: it.y, w: it.w, h: it.h,
    minW: WIDGET_MAP[it.i].min.w, minH: WIDGET_MAP[it.i].min.h,
    isDraggable: editing, isResizable: editing,
  })), [items, editing]);

  const onLayoutChange = (next: readonly { i: string; x: number; y: number; w: number; h: number }[]) => {
    if (!editing) return;
    setState({ items: next.map((l) => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h })) });
  };

  const addWidget = (id: string) => {
    const spec = WIDGET_MAP[id];
    if (!spec) return;
    const maxY = items.reduce((m, it) => Math.max(m, it.y + it.h), 0);
    setState({ items: [...items, { i: id, x: 0, y: maxY, w: spec.default.w, h: spec.default.h }] });
    toast.success(`Added ${spec.title}`);
  };

  const removeWidget = (id: string) => {
    setState({ items: items.filter((it) => it.i !== id) });
  };

  const resetLayout = () => {
    setState({ items: DEFAULT_LAYOUT });
    toast.success("Layout reset to default");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.nav.overview}
        description="Live status of CortexOS host. Drag widgets to rearrange, drag corners to resize."
        actions={
          <div className="flex gap-2">
            {editing && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" disabled={available.length === 0}>
                    <Plus className="size-4 mr-1" />Add widget
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 pb-1">Available widgets</div>
                  {available.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">All widgets are on the dashboard.</div>
                  ) : (
                    <div className="space-y-0.5 max-h-80 overflow-y-auto">
                      {available.map((w) => (
                        <button key={w.id} onClick={() => addWidget(w.id)}
                          className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted text-left">
                          <w.icon className="size-3.5 text-muted-foreground" />
                          <span className="flex-1">{w.title}</span>
                          <Plus className="size-3.5 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            )}
            {editing && (
              <Button size="sm" variant="outline" onClick={resetLayout}>
                <RotateCcw className="size-4 mr-1" />Reset
              </Button>
            )}
            <Button size="sm" variant={editing ? "default" : "outline"} onClick={() => {
              setEditing(!editing);
              if (editing) toast.success("Layout saved");
            }}>
              {editing ? <><Check className="size-4 mr-1" />Done</> : <><Pencil className="size-4 mr-1" />Edit</>}
            </Button>
          </div>
        }
      />

      <StatusHero />

      {editing && (
        <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 text-primary text-xs px-3 py-2">
          Edit mode — drag widgets to rearrange, drag bottom-right corner to resize, click × to remove.
        </div>
      )}

      {mounted ? (
        <ResponsiveGrid
          className={cn("-mx-1.5", editing && "rgl-editing")}
          layouts={{ lg: layout, md: layout, sm: layout, xs: layout, xxs: layout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={56}
          margin={[12, 12]}
          containerPadding={[6, 0]}
          isDraggable={editing}
          isResizable={editing}
          draggableHandle=".widget-handle"
          onLayoutChange={onLayoutChange}
        >
          {items.map((it) => {
            const spec = WIDGET_MAP[it.i];
            return (
              <div key={it.i} className="relative group">
                {editing && (
                  <>
                    <div className="widget-handle absolute top-1 left-1 z-10 size-6 grid place-items-center rounded bg-background/80 border opacity-0 group-hover:opacity-100 cursor-move transition-opacity">
                      <GripVertical className="size-3.5 text-muted-foreground" />
                    </div>
                    <button
                      aria-label={`Remove ${spec.title}`}
                      onClick={() => removeWidget(it.i)}
                      className="absolute top-1 right-1 z-10 size-6 grid place-items-center rounded bg-background/80 border opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition-all"
                    >
                      <X className="size-3.5" />
                    </button>
                  </>
                )}
                <div className="h-full">{spec.render()}</div>
              </div>
            );
          })}
        </ResponsiveGrid>
      ) : (
        <div className="h-96 rounded-md border border-dashed border-border/50 animate-pulse" />
      )}
    </div>
  );
}
