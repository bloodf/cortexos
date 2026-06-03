import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LocaleLayout from "../layout";

vi.mock("next-intl", () => ({
	NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="intl-provider">{children}</div>
	),
}));

vi.mock("next-intl/server", () => ({
	getMessages: vi.fn(() => Promise.resolve({})),
}));

vi.mock("@/components/command-palette", () => ({
	CommandPalette: () => <div data-testid="command-palette" />,
}));

vi.mock("@/components/favorites-bar", () => ({
	FavoritesBar: () => <div data-testid="favorites-bar" />,
}));

<<<<<<< HEAD
=======
// AppShell pulls in `next/navigation`'s `useRouter` (via
// useKeyboardShortcuts) which requires an app router to be mounted. The
// layout test only cares about the intl-provider wrapper, so mock AppShell
// to a passthrough that exposes its children.
>>>>>>> origin/feature/m1-data-schema
vi.mock("@/app/sys-pilot/AppShell", () => ({
	AppShell: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="app-shell">{children}</div>
	),
}));

<<<<<<< HEAD
vi.mock("@/hooks/dashboard-data-context", () => ({
	DashboardDataProvider: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="dashboard-data-provider">{children}</div>
=======
// DashboardDataProvider may end up calling `useContext` against an
// undefined provider in unit tests. It's not the subject of this test, so
// stub it out.
vi.mock("@/hooks/dashboard-data-context", () => ({
	DashboardDataProvider: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
>>>>>>> origin/feature/m1-data-schema
	),
}));

describe("LocaleLayout", () => {
	it("renders children inside intl provider", async () => {
		const layout = await LocaleLayout({ children: <div data-testid="child">Hello</div> });
		render(layout);
		expect(screen.getByTestId("intl-provider")).toBeInTheDocument();
		expect(screen.getByTestId("child")).toBeInTheDocument();
	});
});
