import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import Table from './Table.svelte';
import TableHeader from './TableHeader.svelte';
import TableBody from './TableBody.svelte';
import TableRow from './TableRow.svelte';
import TableHead from './TableHead.svelte';
import TableCell from './TableCell.svelte';

describe('Table', () => {
  afterEach(cleanup);

  it('renders a table', () => {
    const { container } = render(Table);
    expect(container.querySelector('table')).not.toBeNull();
  });

  it('has data-slot attributes on each subcomponent', () => {
    const { container: t } = render(Table);
    const { container: th } = render(TableHeader);
    const { container: tb } = render(TableBody);
    const { container: tr } = render(TableRow);
    const { container: hh } = render(TableHead);
    const { container: cc } = render(TableCell);
    expect(t.querySelector('[data-slot="table"]')).not.toBeNull();
    expect(th.querySelector('[data-slot="table-header"]')).not.toBeNull();
    expect(tb.querySelector('[data-slot="table-body"]')).not.toBeNull();
    expect(tr.querySelector('[data-slot="table-row"]')).not.toBeNull();
    expect(hh.querySelector('[data-slot="table-head"]')).not.toBeNull();
    expect(cc.querySelector('[data-slot="table-cell"]')).not.toBeNull();
  });
});
