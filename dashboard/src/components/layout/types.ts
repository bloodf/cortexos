export type LayoutDirection = "row" | "column";

export type LayoutItem =
	| string
	| {
			type: "container";
			id: string;
			direction: LayoutDirection;
			items: LayoutItem[];
		};

export interface LayoutRow {
	items: LayoutItem[];
}

export interface LayoutConfig {
	rows: LayoutRow[];
}

export function getRowItems(row: LayoutRow): LayoutItem[] {
	return row.items;
}

export function rowFromItems(items: LayoutItem[]): LayoutRow {
	return { items };
}

export function getItemId(item: LayoutItem): string {
	return typeof item === "string" ? item : item.id;
}
