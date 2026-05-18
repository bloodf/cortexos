import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
	PaperclipLinkTable,
	type PaperclipLinkRow,
} from "../link-table";

const ROW: PaperclipLinkRow = {
	id: 1,
	paperclip_issue_id: "ISSUE-42",
	paperclip_run_id: "run-1",
	paperclip_agent_id: "agent-1",
	cortex_role: "ENG-BACKEND",
	nats_subject: "cortex.task.eng-backend",
	status: "in_progress",
	cost_usd_cents: 1250,
	created_at: "2026-05-18T10:00:00.000Z",
	updated_at: "2026-05-18T11:00:00.000Z",
};

describe("PaperclipLinkTable", () => {
	it("renders empty state when no rows", () => {
		render(<PaperclipLinkTable rows={[]} />);
		expect(screen.getByText(/No Paperclip ticket links/i)).toBeInTheDocument();
	});

	it("renders row columns: issue, role, status, cost", () => {
		render(<PaperclipLinkTable rows={[ROW]} />);
		expect(screen.getByText("ISSUE-42")).toBeInTheDocument();
		expect(screen.getByText("ENG-BACKEND")).toBeInTheDocument();
		expect(screen.getByText("in_progress")).toBeInTheDocument();
		expect(screen.getByText("$12.50")).toBeInTheDocument();
	});
});
