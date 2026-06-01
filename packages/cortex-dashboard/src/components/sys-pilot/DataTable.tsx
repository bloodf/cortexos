"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sort?: (row: T) => string | number;
  className?: string;
  width?: string;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  filterFn?: (row: T, q: string) => boolean;
  initialSort?: string;
  empty?: ReactNode;
  loading?: boolean;
  density?: "comfortable" | "compact";
  searchPlaceholder?: string;
  toolbar?: ReactNode;
  pageSize?: number;
  /** Enable a checkbox column. Requires rowKey. */
  selectable?: boolean;
  rowKey?: (row: T) => string;
  /** Renders inside the toolbar when at least one row is selected. */
  selectionToolbar?: (selected: T[], clear: () => void) => ReactNode;
  /** Right-click handler for table rows. */
  onRowContextMenu?: (row: T, e: React.MouseEvent) => void;
}

export function DataTable<T>({
  rows, columns, filterFn, initialSort, empty, loading,
  density = "comfortable", searchPlaceholder = "Search…", toolbar, pageSize = 25,
  selectable, rowKey, selectionToolbar, onRowContextMenu,
}: Props<T>) {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(initialSort ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!q || !filterFn) return rows;
    return rows.filter((r) => filterFn(r, q.toLowerCase()));
  }, [rows, q, filterFn]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sort) return filtered;
    return [...filtered].sort((a, b) => {
      const av = col.sort!(a), bv = col.sort!(b);
      if (av === bv) return 0;
      const d = av > bv ? 1 : -1;
      return sortDir === "asc" ? d : -d;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const view = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const toggle = (k: string) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  const selectedRows = useMemo(
    () => (selectable && rowKey ? rows.filter((r) => selected.has(rowKey(r))) : []),
    [rows, selected, selectable, rowKey],
  );
  const clearSelection = () => setSelected(new Set());
  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allOnPageSelected = selectable && rowKey && view.length > 0 && view.every((r) => selected.has(rowKey(r)));
  const toggleAllOnPage = () => {
    if (!selectable || !rowKey) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) view.forEach((r) => next.delete(rowKey(r)));
      else view.forEach((r) => next.add(rowKey(r)));
      return next;
    });
  };

  const showSelectionBar = selectable && selectedRows.length > 0 && selectionToolbar;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {filterFn && (
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(0); }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="pl-8 h-9"
            />
          </div>
        )}
        <div className="flex-1" />
        {showSelectionBar ? (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1 text-xs">
            <span className="font-medium">{selectedRows.length} selected</span>
            {selectionToolbar!(selectedRows, clearSelection)}
            <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
          </div>
        ) : toolbar}
      </div>
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                {selectable && (
                  <th className="w-9 px-3 py-2">
                    <Checkbox
                      checked={!!allOnPageSelected}
                      onChange={toggleAllOnPage}
                      aria-label="Select all rows on this page"
                    />
                  </th>
                )}
                {columns.map((c) => (
                  <th key={c.key} className={cn("font-medium px-3 py-2", c.className)} style={{ width: c.width }}>
                    {c.sort ? (
                      <button
                        type="button"
                        onClick={() => toggle(c.key)}
                        aria-label={`Sort by ${typeof c.header === "string" ? c.header : c.key}`}
                        className="inline-flex items-center gap-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                      >
                        {c.header}
                        {sortKey === c.key ? (sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-50" />}
                      </button>
                    ) : c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0" aria-hidden>
                    {selectable && <td className="px-3 py-2"><div className="size-4 rounded bg-muted/70 animate-pulse motion-reduce:animate-none" /></td>}
                    {columns.map((c, ci) => (
                      <td key={c.key} className={cn("px-3", density === "compact" ? "py-2" : "py-3")}>
                        <div className={cn("h-3 rounded bg-muted/70 animate-pulse motion-reduce:animate-none", ci === 0 ? "w-3/4" : ci === columns.length - 1 ? "w-1/3" : "w-2/3")} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : view.length === 0 ? (
                <tr><td colSpan={columns.length + (selectable ? 1 : 0)} className="px-3 py-10 text-center text-muted-foreground text-sm">{empty ?? "No results"}</td></tr>
              ) : view.map((row, i) => {
                const id = rowKey ? rowKey(row) : String(i);
                const isSel = selectable && rowKey ? selected.has(id) : false;
                return (
                  <tr
                    key={id}
                    className={cn("border-b last:border-0 hover:bg-muted/30", isSel && "bg-primary/5")}
                    onContextMenu={onRowContextMenu ? (e) => onRowContextMenu(row, e) : undefined}
                  >
                    {selectable && (
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={isSel}
                          onChange={() => rowKey && toggleRow(rowKey(row))}
                          aria-label="Select row"
                        />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key} className={cn("px-3", density === "compact" ? "py-1.5" : "py-2.5", c.className)}>{c.cell(row)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
            <span>{sorted.length} rows · Page {safePage + 1} / {pages}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
