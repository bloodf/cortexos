import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataTable, type Column } from "./DataTable";

interface Row { id: number; name: string }
const rows: Row[] = [
  { id: 1, name: "alpha" },
  { id: 2, name: "bravo" },
  { id: 3, name: "charlie" },
];
const cols: Column<Row>[] = [
  { key: "name", header: "Name", sort: (r) => r.name, cell: (r) => r.name },
];

describe("DataTable", () => {
  it("renders rows", () => {
    render(<DataTable rows={rows} columns={cols} />);
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("charlie")).toBeInTheDocument();
  });

  it("filters with filterFn", () => {
    render(<DataTable rows={rows} columns={cols} filterFn={(r, q) => r.name.includes(q)} />);
    const input = screen.getByPlaceholderText("Search…");
    fireEvent.change(input, { target: { value: "brav" } });
    expect(screen.getByText("bravo")).toBeInTheDocument();
    expect(screen.queryByText("alpha")).not.toBeInTheDocument();
  });

  it("toggles sort direction on header click", () => {
    render(<DataTable rows={rows} columns={cols} />);
    const header = screen.getByRole("button", { name: /Sort by Name/i });
    fireEvent.click(header);
    expect(screen.getAllByRole("row").length).toBe(rows.length + 1);
  });

  it("renders skeleton when loading", () => {
    const { container } = render(<DataTable rows={[]} columns={cols} loading />);
    expect(container.querySelectorAll("[aria-hidden]").length).toBeGreaterThan(0);
  });

  it("shows empty state", () => {
    render(<DataTable rows={[]} columns={cols} empty="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("fires onRowContextMenu on right-click", () => {
    const onCtx = vi.fn();
    render(<DataTable rows={rows} columns={cols} onRowContextMenu={onCtx} />);
    fireEvent.contextMenu(screen.getByText("alpha").closest("tr")!);
    expect(onCtx).toHaveBeenCalledTimes(1);
    expect(onCtx.mock.calls[0][0]).toEqual(rows[0]);
  });

  it("renders selection toolbar when rows selected", () => {
    render(
      <DataTable
        rows={rows}
        columns={cols}
        selectable
        rowKey={(r) => String(r.id)}
        selectionToolbar={(sel) => <span>Picked {sel.length}</span>}
      />,
    );
    // Toggle first row's checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    // first is header select-all, second is first row
    fireEvent.click(checkboxes[1]);
    expect(screen.getByText(/Picked 1/)).toBeInTheDocument();
  });
});
