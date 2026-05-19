export interface ServiceData {
		id?: number;
		slug: string;
		name: string;
		open_url: string;
		category: string;
		status: "online" | "offline" | "unknown";
		responseTime: number;
		icon_color: string | null;
		icon_image: string | null;
		badges?: { label: string; color?: string }[];
	}

export const CATEGORIES = [
	"All",
	"AI",
	"Infrastructure",
	"Storage",
	"Monitoring",
	"Security",
	"Home",
	"Media",
	"Database",
] as const;

export function fuzzyMatch(query: string, text: string): boolean {
	if (!query) return true;
	const q = query.toLowerCase().replace(/\s+/g, "");
	const t = text.toLowerCase().replace(/\s+/g, "");
	let qi = 0;
	for (let ti = 0; ti < t.length && qi < q.length; ti++)
		if (t[ti] === q[qi]) qi++;
	return qi === q.length;
}
