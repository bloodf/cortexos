import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppGrid } from "../app-grid";
import type { ServiceData } from "@/components/services";

const mockServices: ServiceData[] = [
	{
		slug: "app-one",
		name: "App One",
		open_url:"https://app-one.test",
		category: "AI",
		status: "online",
		responseTime: 42,
		icon_color: "#ff0000",
		icon_image: null,
		badges: [{ label: "prod", color: "#00ff00" }, { label: "beta" }],
	},
	{
		slug: "app-two",
		name: "App Two",
		open_url:"https://app-two.test",
		category: "Media",
		status: "offline",
		responseTime: 0,
		icon_color: null,
		icon_image: null,
	},
];

describe("AppGrid", () => {
	it("renders service names", () => {
		render(<AppGrid services={mockServices} />);
		expect(screen.getByText("App One")).toBeInTheDocument();
		expect(screen.getByText("App Two")).toBeInTheDocument();
	});

	it("renders badges when present", () => {
		render(<AppGrid services={mockServices} />);
		expect(screen.getByText("prod")).toBeInTheDocument();
		expect(screen.getByText("beta")).toBeInTheDocument();
	});

	it("does not render badges section when absent", () => {
		const noBadge = mockServices.filter((s) => s.slug === "app-two");
		render(<AppGrid services={noBadge} />);
		expect(screen.queryByText("prod")).not.toBeInTheDocument();
	});

	it("shows empty state when no services", () => {
		render(<AppGrid services={[]} />);
		expect(screen.getByText(/no apps/i)).toBeInTheDocument();
	});
});
