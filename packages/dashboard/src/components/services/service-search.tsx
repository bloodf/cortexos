"use client";

import { Search } from "lucide-react";

interface ServiceSearchProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
}

export function ServiceSearch({ value, onChange, placeholder = "Search services…" }: ServiceSearchProps) {
	return (
		<div className="relative max-w-sm flex-1">
			<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/30 light:text-slate-700" />
			<input
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className="w-full pl-10 pr-4 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-sm text-white/70 light:text-slate-700 placeholder:text-white/20 light:text-slate-700 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/40 transition-all shadow-inner"
			/>
		</div>
	);
}
