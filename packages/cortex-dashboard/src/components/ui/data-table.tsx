"use client"

import * as React from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type RowSelectionState,
  type PaginationState,
  type VisibilityState,
} from "@tanstack/react-table"
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  SlidersHorizontalIcon,
} from "lucide-react"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[]
  data: TData[]
  /** Global filter value */
  globalFilter?: string
  onGlobalFilterChange?: (value: string) => void
  /** Controlled pagination for server-side */
  pagination?: PaginationState
  onPaginationChange?: React.Dispatch<React.SetStateAction<PaginationState>>
  pageCount?: number
  /** Row selection */
  rowSelection?: RowSelectionState
  onRowSelectionChange?: React.Dispatch<React.SetStateAction<RowSelectionState>>
  /** Empty state */
  emptyState?: React.ReactNode
  /** Render skeleton rows instead of data while loading */
  loading?: boolean
  /** Number of skeleton rows to render when loading. Defaults to 5. */
  loadingRows?: number
  /** Show a built-in filter input bound to globalFilter (uncontrolled if no globalFilter passed) */
  enableFilter?: boolean
  /** Placeholder for the built-in filter input */
  filterPlaceholder?: string
  /** Show a column-visibility toggle dropdown */
  enableColumnVisibility?: boolean
  /** Extra controls rendered in the toolbar (right side) */
  toolbar?: React.ReactNode
  className?: string
}

function DataTable<TData>({
  columns,
  data,
  globalFilter,
  onGlobalFilterChange,
  pagination: controlledPagination,
  onPaginationChange,
  pageCount,
  rowSelection,
  onRowSelectionChange,
  emptyState,
  loading = false,
  loadingRows = 5,
  enableFilter = false,
  filterPlaceholder = "Filter...",
  enableColumnVisibility = false,
  toolbar,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [internalGlobalFilter, setInternalGlobalFilter] = React.useState("")
  const [internalPagination, setInternalPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const isControlledFilter = onGlobalFilterChange !== undefined
  const activeGlobalFilter = isControlledFilter ? globalFilter : internalGlobalFilter
  const handleGlobalFilterChange = isControlledFilter
    ? onGlobalFilterChange
    : setInternalGlobalFilter

  const isServerSide = !!onPaginationChange
  const activePagination = isServerSide ? controlledPagination : internalPagination
  const handlePaginationChange = isServerSide ? onPaginationChange : setInternalPagination

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter: activeGlobalFilter,
      pagination: activePagination ?? internalPagination,
      rowSelection: rowSelection ?? {},
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: handleGlobalFilterChange,
    onPaginationChange: handlePaginationChange as React.Dispatch<React.SetStateAction<PaginationState>>,
    onRowSelectionChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: isServerSide,
    pageCount: isServerSide ? (pageCount ?? -1) : undefined,
    enableRowSelection: !!onRowSelectionChange,
    autoResetPageIndex: false,
  })

  const { pageIndex, pageSize } = table.getState().pagination
  const totalRows = isServerSide ? (pageCount ?? 0) * pageSize : data.length
  const from = pageIndex * pageSize + 1
  const to = Math.min(from + pageSize - 1, totalRows)

  const showToolbar = enableFilter || enableColumnVisibility || toolbar

  return (
    <div data-slot="data-table" className={cn("flex flex-col gap-3", className)}>
      {showToolbar && (
        <div
          data-slot="data-table-toolbar"
          className="flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            {enableFilter && (
              <Input
                value={activeGlobalFilter ?? ""}
                onChange={(e) => handleGlobalFilterChange?.(e.target.value)}
                placeholder={filterPlaceholder}
                className="h-8 w-full max-w-xs"
                aria-label="Filter table"
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            {toolbar}
            {enableColumnVisibility && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="sm">
                      <SlidersHorizontalIcon />
                      Columns
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {table
                    .getAllLeafColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder ? null : (
                      <div
                        className={cn(
                          "flex items-center gap-1",
                          header.column.getCanSort() && "cursor-pointer select-none"
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                        role={header.column.getCanSort() ? "button" : undefined}
                        tabIndex={header.column.getCanSort() ? 0 : undefined}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            header.column.getToggleSortingHandler()?.(e)
                          }
                        }}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className="text-muted-foreground">
                            {header.column.getIsSorted() === "asc" ? (
                              <ChevronUpIcon className="size-3.5" />
                            ) : header.column.getIsSorted() === "desc" ? (
                              <ChevronDownIcon className="size-3.5" />
                            ) : (
                              <ChevronsUpDownIcon className="size-3.5" />
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: loadingRows }).map((_, rowIdx) => (
                <TableRow key={`skeleton-${rowIdx}`}>
                  {table.getVisibleLeafColumns().map((column) => (
                    <TableCell key={column.id}>
                      <Skeleton className="h-4 w-full max-w-[140px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="p-0">
                  {emptyState ?? (
                    <EmptyState title="No results" description="No data matches your current filters." />
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {totalRows > 0 ? `${from}–${to} of ${totalRows}` : "No results"}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

export { DataTable }
export type { DataTableProps }
