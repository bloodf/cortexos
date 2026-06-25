/**
 * Regression guard: paste-to-attach, drag-drop-to-attach, and
 * attachment-only submit on /agents/$slug/chat.
 *
 * Renders ChatPage directly with useParams/useNavigate stubbed so no TanStack
 * router tree is needed — avoids the id+path conflict that createRoute throws.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UIProvider } from "@/hooks/ui-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    useParams: () => ({ slug: "test-agent" }),
    useNavigate: () => vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Link: ({ to, children, ...props }: any) => (
      <a href={String(to)} {...props}>
        {children}
      </a>
    ),
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { username: "admin", is_admin: true }, loading: false }),
}));

vi.mock("@/lib/api/client", () => ({
  listModels: vi.fn(),
  callAgentChat: vi.fn(),
  callSetAgentModel: vi.fn(),
  callMintApproval: vi.fn(),
  api: { agents: vi.fn() },
  csrfHeaders: () => ({}),
}));

// ---------------------------------------------------------------------------
// Lazy imports after vi.mock
// ---------------------------------------------------------------------------
import { listModels, callAgentChat, api } from "@/lib/api/client";
import { ChatPage } from "@/routes/_authenticated.agents.$slug.chat";

// ---------------------------------------------------------------------------
// Stub agent
// ---------------------------------------------------------------------------
const STUB_AGENT = {
  slug: "test-agent",
  name: "Test Agent",
  description: "A test agent",
  state: "idle" as const,
  model: "claude-sonnet-4",
  modelProvider: "anthropic",
  health: "healthy" as const,
  hermesUrl: "https://hermes.example.com/test-agent",
  uptimeSec: 0,
  queueDepth: 0,
  requestsPerMin: 0,
  errorRatePct: 0,
  p95LatencyMs: 0,
  lastActivity: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Render helper — no router tree required
// ---------------------------------------------------------------------------
function renderChatPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <UIProvider>
        <TooltipProvider>
          <ChatPage />
        </TooltipProvider>
      </UIProvider>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Utility — FileList-shaped value from an array of Files.
// readAttachments() only needs Array.from()-ability + index access + .length.
// ---------------------------------------------------------------------------
function makeFileList(files: File[]): FileList {
  return Object.assign([...files], {
    item: (i: number) => files[i] ?? null,
  }) as unknown as FileList;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("ChatPage — paste + drop attachments", () => {
  beforeEach(() => {
    vi.mocked(listModels).mockResolvedValue({ models: ["claude-sonnet-4"] });
    vi.mocked(api.agents).mockResolvedValue([STUB_AGENT]);
    vi.mocked(callAgentChat).mockResolvedValue({
      slug: "test-agent",
      reply: "pong",
      latencyMs: 42,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("pasting a file into the textarea shows an AttachmentChip preview", async () => {
    const user = userEvent.setup();
    const { container } = renderChatPage();

    // Wait for agent to load and composer to appear.
    await waitFor(() => expect(screen.getByRole("textbox")).toBeTruthy());

    const textarea = container.querySelector("textarea")!;

    // text/plain → AttachmentChip renders filename in textContent (not image).
    const file = new File(["hello"], "pasted.txt", { type: "text/plain" });
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", {
      value: { files: makeFileList([file]), items: [] },
    });
    fireEvent(textarea, paste);

    await waitFor(() => expect(container.textContent).toContain("pasted.txt"));
  });

  it("dropping a file on the composer wrapper shows an AttachmentChip preview", async () => {
    const user = userEvent.setup();
    const { container } = renderChatPage();

    await waitFor(() => expect(screen.getByRole("textbox")).toBeTruthy());

    // text/plain → filename in textContent (image/* only appears in <img alt>).
    const file = new File(["world"], "dropped.txt", { type: "text/plain" });

    const composerWrapper = container.querySelector(".border-t") as HTMLElement;
    expect(composerWrapper).toBeTruthy();

    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", {
      value: { types: ["Files"], files: makeFileList([file]), items: [] },
    });
    fireEvent(composerWrapper, drop);

    await waitFor(() => expect(container.textContent).toContain("dropped.txt"));
  });

  it("submitting with attachments-only fires callAgentChat with the converted payload", async () => {
    const user = userEvent.setup();
    const { container } = renderChatPage();

    await waitFor(() => expect(screen.getByRole("textbox")).toBeTruthy());

    const textarea = container.querySelector("textarea")!;

    const file = new File(["data"], "attach.pdf", { type: "application/pdf" });
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", {
      value: { files: makeFileList([file]), items: [] },
    });
    fireEvent(textarea, paste);

    // Wait for AttachmentChip to appear (FileReader resolved).
    await waitFor(() => expect(container.textContent).toContain("attach.pdf"));

    // Submit with empty text — handleSubmit allows pending.length > 0 with "".
    const submitBtn = screen.getByRole("button", { name: /send/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(vi.mocked(callAgentChat)).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slug: "test-agent",
            text: "",
            attachments: expect.arrayContaining([
              expect.objectContaining({ filename: "attach.pdf", mime: "application/pdf" }),
            ]),
          }),
        }),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Model picker filtering
// ---------------------------------------------------------------------------
describe("ChatPage — model picker filtering", () => {
  const FOUR_MODELS = ["claude-sonnet-4", "claude-opus-4", "gpt-5", "kimi-k2.5"];

  beforeEach(() => {
    vi.mocked(listModels).mockResolvedValue({ models: FOUR_MODELS });
    // Use model: "" so the trigger label never duplicates a list item name.
    vi.mocked(api.agents).mockResolvedValue([{ ...STUB_AGENT, model: "" }]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("search input filters the model list by substring", async () => {
    const user = userEvent.setup();
    renderChatPage();

    await waitFor(() => expect(screen.getByRole("textbox")).toBeTruthy());

    await user.click(screen.getByRole("combobox", { name: /model/i }));
    const searchInput = await screen.findByPlaceholderText("Search models…");
    const popover = searchInput.closest('[role="dialog"]') as HTMLElement;
    const picker = within(popover);

    // Capture filtered-out elements before typing (all models visible initially)
    const gpt5El = picker.getByText("gpt-5");
    const kimiEl = picker.getByText("kimi-k2.5");

    await user.type(searchInput, "claude");

    await picker.findByText("claude-sonnet-4");
    await picker.findByText("claude-opus-4");
    expect(gpt5El).not.toBeVisible();
    expect(kimiEl).not.toBeVisible();
  });

  it("empty state shows when no models match", async () => {
    const user = userEvent.setup();
    renderChatPage();

    await waitFor(() => expect(screen.getByRole("textbox")).toBeTruthy());

    await user.click(screen.getByRole("combobox", { name: /model/i }));
    const searchInput = screen.getByPlaceholderText("Search models…");
    await user.type(searchInput, "zzzzzz");

    await screen.findByText("No matching models");
  });

  it("selecting a model closes the popover", async () => {
    const user = userEvent.setup();
    renderChatPage();

    await waitFor(() => expect(screen.getByRole("textbox")).toBeTruthy());

    await user.click(screen.getByRole("combobox", { name: /model/i }));
    const searchInput = await screen.findByPlaceholderText("Search models…");
    const popover = searchInput.closest('[role="dialog"]') as HTMLElement;
    const picker = within(popover);

    await user.click(await picker.findByText("claude-sonnet-4"));

    expect(searchInput).not.toBeVisible();
  });
});
