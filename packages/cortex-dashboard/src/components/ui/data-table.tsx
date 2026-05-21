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
} from "@tanstack/react-table"
import { ChevronUpIcon, ChevronDownIcon, ChevronsUpDownIcon } from "lucide-react"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
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
  className?: string
  /** Render integrated global search input */
  searchPlaceholder?: string
  /** Disable pagination and render all filtered rows */
  noPagination?: boolean
  toolbar?: React.ReactNode
  renderSubRow?: (row: TData) => React.ReactNode
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
  className,
  searchPlaceholder,
  noPagination = false,
  toolbar,
  renderSubRow,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [internalPagination, setInternalPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: noPagination ? Math.max(data.length, 1) : 10,
  })


  React.useEffect(() => {
    if (!noPagination) return
    setInternalPagination(() => ({
      pageIndex: 0,
      pageSize: Math.max(data.length, 1),
    }))
  }, [data.length, noPagination])
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
      globalFilter,
      pagination: activePagination ?? internalPagination,
      rowSelection: rowSelection ?? {},
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange,
    onPaginationChange: handlePaginationChange as React.Dispatch<React.SetStateAction<PaginationState>>,
    onRowSelectionChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: noPagination ? undefined : getPaginationRowModel(),
    manualPagination: isServerSide,
    pageCount: isServerSide ? (pageCount ?? -1) : undefined,
    enableRowSelection: !!onRowSelectionChange,
    autoResetPageIndex: false,
  })

  const { pageIndex, pageSize } = table.getState().pagination
  const totalRows = isServerSide ? (pageCount ?? 0) * pageSize : data.length
  const from = pageIndex * pageSize + 1
  const to = Math.min(from + pageSize - 1, totalRows)

  return (
    <div data-slot="data-table" className={cn("flex flex-col gap-3", className)}>
      {(searchPlaceholder && onGlobalFilterChange) || toolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {searchPlaceholder && onGlobalFilterChange ? (
            <Input
              value={globalFilter ?? ""}
              onChange={(event) => onGlobalFilterChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="max-w-sm"
              type="search"
            />
          ) : <span />}
          {toolbar}
        </div>
      ) : null}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan} className={header.column.id === "actions" ? "text-right" : undefined}>
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
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <React.Fragment key={row.id}>
                  <TableRow
                    data-state={row.getIsSelected() ? "selected" : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className={cell.column.id === "actions" ? "text-right" : undefined}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {renderSubRow ? renderSubRow(row.original) : null}
                </React.Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0">
                  {emptyState ?? (
                    <EmptyState title="No results" description="No data matches your current filters." />
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {!noPagination && (
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
      )}
    </div>
  )
}

export { DataTable }
export type { DataTableProps }
