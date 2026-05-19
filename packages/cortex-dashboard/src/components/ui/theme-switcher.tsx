"use client";

import { useTheme } from "@/hooks/use-theme";
import { Sun, Moon } from "lucide-react";

export function ThemeSwitcher() {
	const { theme, toggleTheme } = useTheme();

	return (
		<button
			onClick={toggleTheme}
			className="relative flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.03] dark:bg-white/[0.03] light:bg-black/[0.04] hover:bg-white/[0.08] dark:hover:bg-white/[0.08] border border-white/[0.06] dark:border-white/[0.06]"
			title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
		>
			{theme === "dark" ? (
				<Sun className="w-4 h-4 text-amber-400" />
			) : (
				<Moon className="w-4 h-4 text-indigo-500" />
			)}
		</button>
	);
}
