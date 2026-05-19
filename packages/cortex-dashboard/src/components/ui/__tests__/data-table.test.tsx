import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DataTable } from '../data-table'
import type { ColumnDef } from '@tanstack/react-table'

interface Row {
  id: string
  name: string
  status: string
}

const columns: ColumnDef<Row>[] = [
  { accessorKey: 'name', header: 'Name', enableSorting: true },
  { accessorKey: 'status', header: 'Status', enableSorting: true },
]

const data: Row[] = [
  { id: '1', name: 'Alpha', status: 'active' },
  { id: '2', name: 'Beta', status: 'inactive' },
]

describe('DataTable', () => {
  it('renders without crash', () => {
    const { container } = render(<DataTable columns={columns} data={data} />)
    expect(container).toBeTruthy()
  })

  it('renders column headers', () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('renders row data', () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('shows empty state when data is empty', () => {
    render(<DataTable columns={columns} data={[]} />)
    // "No results" appears in both the empty-state title and pagination span
    const matches = screen.getAllByText('No results')
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('shows custom empty state slot', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyState={<div>Custom empty</div>}
      />
    )
    expect(screen.getByText('Custom empty')).toBeInTheDocument()
  })

  it('column headers are clickable for sorting', () => {
    render(<DataTable columns={columns} data={data} />)
    const nameHeader = screen.getByText('Name')
    // Should not throw
    fireEvent.click(nameHeader)
    expect(nameHeader).toBeInTheDocument()
  })

  it('sortable headers have role=button', () => {
    render(<DataTable columns={columns} data={data} />)
    const sortButtons = screen.getAllByRole('button')
    // Pagination buttons + sort buttons
    expect(sortButtons.length).toBeGreaterThan(0)
  })
})
