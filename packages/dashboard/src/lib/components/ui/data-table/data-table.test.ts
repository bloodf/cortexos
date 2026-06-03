import { describe, it, expect, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, cleanup, fireEvent } from '../../../utils/test-render';
import DataTable from './DataTable.svelte';
import type { Column } from './DataTable.types';

type Row = { id: string; name: string; age: number };
const columns: Column<Row>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'age', header: 'Age', sortable: true },
];
const data: Row[] = [
  { id: '1', name: 'Alice', age: 30 },
  { id: '2', name: 'Bob', age: 25 },
  { id: '3', name: 'Carol', age: 40 },
];

describe('DataTable', () => {
  afterEach(cleanup);

  it('renders all rows by default', () => {
    const { container } = render(DataTable, { props: { columns, data } });
    const cells = container.querySelectorAll('[data-slot="table-cell"]');
    expect(cells.length).toBeGreaterThanOrEqual(6); // 3 rows x 2 cols
  });

  it('renders headers', () => {
    const { container } = render(DataTable, { props: { columns, data } });
    expect(container.textContent).toContain('Name');
    expect(container.textContent).toContain('Age');
  });

  it('sorts ascending on first click of "Age"', async () => {
    const user = userEvent.setup();
    const { container } = render(DataTable, { props: { columns, data } });
    const buttons = container.querySelectorAll('button[aria-label^="Sort by"]');
    expect(buttons.length).toBe(2);
    const ageSortBtn = Array.from(buttons).find((b) => b.getAttribute('aria-label') === 'Sort by Age')!;
    await user.click(ageSortBtn);
    // After sort, the first data row should be Bob (age 25)
    const rows = container.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows[0]!.textContent).toContain('Bob');
  });

  it('paginates', () => {
    const { container } = render(DataTable, { props: { columns, data, pageSize: 2 } });
    expect(container.textContent).toContain('Page 1 / 2');
  });

  it('shows empty state when no rows', () => {
    const { container } = render(DataTable, { props: { columns, data: [] } });
    expect(container.textContent).toContain('No results');
  });
});
