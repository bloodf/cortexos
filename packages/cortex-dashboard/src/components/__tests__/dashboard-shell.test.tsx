import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardShell } from "../dashboard-shell";

const mockPathname = "/overview";

vi.mock("@/i18n/routing", () => ({
	usePathname: () => mockPathname,
	Link: ({
		children,
		href,
		...props
	}: {
		children: React.ReactNode;
		href: string;
		[key: string]: unknown;
	}) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}));

vi.mock("next-intl", () => ({
	useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/ui/theme-switcher", () => ({
	ThemeSwitcher: () => <div data-testid="theme-switcher">Theme</div>,
}));

vi.mock("@/components/ui/language-switcher", () => ({
	LanguageSwitcher: () => <div data-testid="language-switcher">Lang</div>,
}));

vi.mock("@/components/cortex/chat-panel", () => ({
	ChatPanel: () => <div data-testid="chat-panel">Chat</div>,
}));

vi.mock("@/components/cortex/bell-dropdown", () => ({
	BellDropdown: () => <div data-testid="bell">Bell</div>,
}));

describe("DashboardShell", () => {
	it("renders children", () => {
		render(
			<DashboardShell>
				<div data-testid="child">Child Content</div>
			</DashboardShell>,
		);
		expect(screen.getByTestId("child")).toBeInTheDocument();
	});

	it("renders primary nav links", () => {
		render(
			<DashboardShell>
				<div>Content</div>
			</DashboardShell>,
		);
		expect(screen.getAllByText("Overview").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Healthcheck").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Apps").length).toBeGreaterThan(0);
	});

	it("renders theme and language switchers", () => {
		render(
			<DashboardShell>
				<div>Content</div>
			</DashboardShell>,
		);
		expect(screen.getByTestId("theme-switcher")).toBeInTheDocument();
		expect(screen.getByTestId("language-switcher")).toBeInTheDocument();
	});

	it("does not render forbidden nav items (credentials / ai providers / env vars)", () => {
		render(
			<DashboardShell>
				<div>Content</div>
			</DashboardShell>,
		);
		expect(screen.queryByText(/credentials/i)).toBeNull();
		expect(screen.queryByText(/ai providers/i)).toBeNull();
		expect(screen.queryByText(/env vars/i)).toBeNull();
	});
});
