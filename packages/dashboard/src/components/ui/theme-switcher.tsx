"use client";

import { useEffect, useState } from "react";
import { Check, Monitor, Moon, Palette, Sun } from "lucide-react";
import {
	useTheme,
	usePreset,
	PRESETS,
	type ThemeMode,
	type ThemePreset,
} from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MODES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
	{ value: "system", label: "System", icon: Monitor },
];

const PRESET_META: Record<ThemePreset, { label: string }> = {
	cortex: { label: "Cortex" },
	teal: { label: "Teal" },
	emerald: { label: "Emerald" },
	amber: { label: "Amber" },
};

/** Swatch showing a preset's brand accent. Forces the `theme-<preset>` class
 *  on a wrapper so the `--brand` value resolves regardless of the active theme. */
function PresetSwatch({ preset }: { preset: ThemePreset }) {
	return (
		<span
			className={`theme-${preset} inline-block size-4 shrink-0 rounded-full border border-border`}
			style={{ backgroundColor: "var(--brand)" }}
			aria-hidden
		/>
	);
}

/**
 * Compact theme switcher: a single dropdown with a light/dark/system radio
 * group plus a preset (brand accent) radio group with color swatches.
 * Used in the sidebar footer.
 */
export function ThemeSwitcher() {
	const { theme, setTheme } = useTheme();
	const { preset, setPreset } = usePreset();

	// Avoid hydration mismatch — next-themes resolves the mode on the client.
	const [mounted, setMounted] = useState(false);
	// eslint-disable-next-line react-hooks/set-state-in-effect
	useEffect(() => setMounted(true), []);

	const ActiveIcon =
		MODES.find((m) => m.value === theme)?.icon ?? Monitor;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="outline"
						size="icon"
						className="size-9 rounded-full"
						title="Theme settings"
					>
						{mounted ? (
							<ActiveIcon className="size-4" />
						) : (
							<Palette className="size-4" />
						)}
						<span className="sr-only">Theme settings</span>
					</Button>
				}
			/>
			<DropdownMenuContent align="end" className="w-48">
				<DropdownMenuLabel>Mode</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={theme}
					onValueChange={(value) => setTheme(value as ThemeMode)}
				>
					{MODES.map(({ value, label, icon: Icon }) => (
						<DropdownMenuRadioItem key={value} value={value}>
							<Icon className="size-4" />
							{label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>

				<DropdownMenuSeparator />

				<DropdownMenuLabel>Accent</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={preset}
					onValueChange={(value) => setPreset(value as ThemePreset)}
				>
					{PRESETS.map((value) => (
						<DropdownMenuRadioItem key={value} value={value}>
							<PresetSwatch preset={value} />
							{PRESET_META[value].label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * Expanded theme controls for the settings page — labeled mode buttons and a
 * row of preset swatch buttons. Same state as {@link ThemeSwitcher}.
 */
export function ThemeSettings() {
	const { theme, setTheme } = useTheme();
	const { preset, setPreset } = usePreset();

	const [mounted, setMounted] = useState(false);
	// eslint-disable-next-line react-hooks/set-state-in-effect
	useEffect(() => setMounted(true), []);

	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<h3 className="text-sm font-medium text-foreground">Mode</h3>
				<div className="flex flex-wrap gap-2">
					{MODES.map(({ value, label, icon: Icon }) => {
						const active = mounted && theme === value;
						return (
							<Button
								key={value}
								type="button"
								variant={active ? "default" : "outline"}
								size="sm"
								onClick={() => setTheme(value)}
								aria-pressed={active}
							>
								<Icon className="size-4" />
								{label}
							</Button>
						);
					})}
				</div>
			</div>

			<div className="space-y-2">
				<h3 className="text-sm font-medium text-foreground">Accent</h3>
				<div className="flex flex-wrap gap-2">
					{PRESETS.map((value) => {
						const active = preset === value;
						return (
							<button
								key={value}
								type="button"
								onClick={() => setPreset(value)}
								aria-pressed={active}
								title={PRESET_META[value].label}
								className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
									active
										? "border-primary bg-accent text-accent-foreground"
										: "border-border hover:bg-accent/50"
								}`}
							>
								<span
									className={`theme-${value} inline-block size-4 shrink-0 rounded-full border border-border`}
									style={{ backgroundColor: "var(--brand)" }}
									aria-hidden
								/>
								{PRESET_META[value].label}
								{active ? <Check className="size-4" /> : null}
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}
