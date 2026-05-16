import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileNav } from "../mobile-nav";

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

vi.mock("@/components/ui/sheet", () => {
	const React = require("react");
	let open = false;
	let setOpen: (v: boolean) => void = () => {};

	function Sheet({ children, open: o, onOpenChange }: any) {
		open = o ?? open;
		setOpen = onOpenChange ?? setOpen;
		return <div data-testid="sheet">{children}</div>;
	}

	function SheetTrigger({ children, ...props }: any) {
		return (
			<div
				{...props}
				data-testid="sheet-trigger"
				onClick={() => setOpen(true)}
				role="button"
			>
				{children}
			</div>
		);
	}

	function SheetContent({ children }: any) {
		return open ? <div data-testid="sheet-content">{children}</div> : null;
	}

	function SheetHeader({ children }: any) {
		return <div>{children}</div>;
	}

	function SheetTitle({ children }: any) {
		return <div>{children}</div>;
	}

	function SheetClose({ children }: any) {
		return (
			<div
				data-testid="sheet-close"
				onClick={() => setOpen(false)}
				role="button"
			>
				{children}
			</div>
		);
	}

	return {
		Sheet,
		SheetTrigger,
		SheetContent,
		SheetHeader,
		SheetTitle,
		SheetClose,
	};
});

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		...props
	}: {
		children: React.ReactNode;
		[key: string]: unknown;
	}) => (
		<button {...props}>{children}</button>
	),
}));

describe("MobileNav", () => {
	it("renders hamburger trigger", () => {
		render(<MobileNav />);
		expect(screen.getByRole("button", { name: /Overview/i })).toBeInTheDocument();
	});

	it("renders bottom nav with 5 items", () => {
		render(<MobileNav />);
		const bottomNav = screen.getByLabelText("Bottom navigation");
		expect(bottomNav).toBeInTheDocument();
		const links = bottomNav.querySelectorAll("a");
		expect(links.length).toBe(5);
	});

	it("marks active bottom nav item", () => {
		render(<MobileNav />);
		const overviewLink = screen.getByText("Overview").closest("a");
		expect(overviewLink).toHaveClass("text-foreground");
	});

	it("opens sheet on trigger click", () => {
		render(<MobileNav />);
		const trigger = screen.getByTestId("sheet-trigger");
		fireEvent.click(trigger);
		expect(screen.getByTestId("sheet-content")).toBeInTheDocument();
	});

	it("renders all nav items in sheet", () => {
		render(<MobileNav />);
		const trigger = screen.getByTestId("sheet-trigger");
		fireEvent.click(trigger);
		const sheetContent = screen.getByTestId("sheet-content");
		expect(sheetContent).toBeInTheDocument();
		expect(sheetContent.textContent).toContain("Overview");
		expect(sheetContent.textContent).toContain("Terminal");
	});

	it("closes sheet on nav item click", () => {
		render(<MobileNav />);
		const trigger = screen.getByTestId("sheet-trigger");
		fireEvent.click(trigger);
		const sheetContent = screen.getByTestId("sheet-content");
		const firstLink = sheetContent.querySelector("a");
		expect(firstLink).toBeTruthy();
		fireEvent.click(firstLink!);
		expect(screen.queryByTestId("sheet-content")).not.toBeInTheDocument();
	});

	it("uses touch-manipulation classes for touch targets", () => {
		render(<MobileNav />);
		const triggerBtn = screen.getByRole("button", { name: /Overview/i });
		expect(triggerBtn).toHaveClass("touch-manipulation");
	});
});
