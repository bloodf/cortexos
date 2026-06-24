/**
 * Regression guard: Paperclip button on /agents/new must open the hidden file
 * input.  Bug class: the onClick handler called `fileInputRef.current?.click()`
 * but the button was `disabled={!sessionId}`, so clicks before a session ID was
 * set were silently swallowed.  The test drives session creation through the
 * auto-create useEffect (model selection → createSessionMut.mutate()) and then
 * verifies the Paperclip click reaches the hidden <input type="file">.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  Outlet,
  RouterProvider,
  createRouter,
} from "@tanstack/react-router";
import { UIProvider } from "@/hooks/ui-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import AgentGeneratorPage from "@/features/AgentGenerator";

// ---------------------------------------------------------------------------
// jsdom-missing globals — must be declared before the component mounts.
// ---------------------------------------------------------------------------
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as Record<string, unknown>).ResizeObserver = ResizeObserverStub;

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Radix UI Select uses pointer-capture APIs missing from jsdom.
if (!HTMLElement.prototype.hasPointerCapture) {
  HTMLElement.prototype.hasPointerCapture = () => false;
}
if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = () => {};
}
if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = () => {};
}

// ---------------------------------------------------------------------------
// Module-level mocks — must be at the top level so Vitest hoists them.
// ---------------------------------------------------------------------------

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { username: "admin", is_admin: true }, loading: false }),
}));

// Mock the heavy API client — only the three fns AgentGenerator calls on mount.
vi.mock("@/lib/api/client", () => ({
  listModels: vi.fn(),
  listGeneratorPresets: vi.fn(),
  callCreateGeneratorSession: vi.fn(),
  // Stubs for imports used elsewhere in the file (csrfHeaders, etc. pull from here)
  callGeneratorSend: vi.fn(),
  callBuildGeneratorProfile: vi.fn(),
  callMintApproval: vi.fn(),
  api: {},
  csrfHeaders: () => ({}),
}));

// Silence xterm — it tries to measure DOM nodes that don't exist in jsdom.
vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    loadAddon = vi.fn();
    open = vi.fn();
    write = vi.fn();
    onData = vi.fn(() => ({ dispose: vi.fn() }));
    dispose = vi.fn();
    focus = vi.fn();
  },
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    fit = vi.fn();
  },
}));

vi.mock("@xterm/xterm/css/xterm.css", () => ({}));

// Generator WS — return a stub session so the effect that fires on sessionId
// doesn't throw when trying to open a real WebSocket.
vi.mock("@/lib/api/generatorWs", () => ({
  openGeneratorWs: vi.fn(() => ({
    send: vi.fn(),
    sendPty: vi.fn(),
    resizePty: vi.fn(),
    close: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Lazy imports — pulled after vi.mock so the mocked versions are in scope.
// ---------------------------------------------------------------------------
import {
  listModels,
  listGeneratorPresets,
  callCreateGeneratorSession,
  callGeneratorSend,
} from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Render helper — mirrors the project's canonical feature-test pattern.
// ---------------------------------------------------------------------------
function renderAgentGenerator() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <UIProvider>
          {/* TooltipProvider required: PromptInputButton uses Tooltip internally */}
          <TooltipProvider>
            <Outlet />
          </TooltipProvider>
        </UIProvider>
      </QueryClientProvider>
    ),
  });

  const agentGenRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/agents/new",
    component: AgentGeneratorPage,
  });

  const routeTree = rootRoute.addChildren([agentGenRoute]);
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: ["/agents/new"] }),
  });

  return render(<RouterProvider router={router} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("AgentGenerator — Paperclip → file input regression (attachments)", () => {
  beforeEach(() => {
    // listModels resolves with one model so the select is populated and the
    // auto-create useEffect fires once the component sets model state.
    vi.mocked(listModels).mockResolvedValue({ models: ["claude-sonnet-4"] });
    vi.mocked(listGeneratorPresets).mockResolvedValue({
      archetypes: [],
      integrations: [],
    });
    // createGeneratorSession resolves with a session id, which sets sessionId
    // state and enables the Paperclip button.
    vi.mocked(callCreateGeneratorSession).mockResolvedValue({
      id: 42,
      status: "draft",
      model: "claude-sonnet-4",
      reasoning: "medium",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("smoke: renders the composer for an admin user without throwing", async () => {
    renderAgentGenerator();
    // The composer textarea placeholder appears once the page is mounted.
    await waitFor(() => {
      expect(screen.getByRole("textbox")).toBeTruthy();
    });
  });

  it("mounts a hidden file input in the DOM", async () => {
    const { container } = renderAgentGenerator();
    await waitFor(() => {
      const sel = 'input[type="file"][accept="image/*,audio/*,video/*,*"]';
      const input = container.querySelector(sel);
      expect(input).toBeTruthy();
      expect(input).toHaveAttribute("multiple");
      expect(input).toHaveClass("hidden");
    });
  });

  it("Paperclip click calls .click() on the hidden file input (regression)", async () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    const user = userEvent.setup();
    const { container } = renderAgentGenerator();

    // Wait for the models query to resolve so the select is populated.
    await waitFor(() => {
      expect(vi.mocked(listModels)).toHaveBeenCalled();
    });

    // Select the model — this triggers the auto-create useEffect which calls
    // createSessionMut.mutate(), which resolves to { id: 42 } and sets
    // sessionId, enabling the Paperclip button.
    await user.click(screen.getByRole("combobox", { name: /model/i }));
    const searchInput = screen.getByPlaceholderText("Search models…");
    await user.type(searchInput, "claude-sonnet-4");
    const option = await screen.findByText("claude-sonnet-4");
    await user.click(option);

    // Wait for sessionId to be set (createSessionMut onSuccess ran).
    await waitFor(() => {
      expect(vi.mocked(callCreateGeneratorSession)).toHaveBeenCalled();
    });

    // Wait for the Paperclip button to become enabled.
    const paperclip = await screen.findByRole("button", { name: /attach files/i });
    await waitFor(() => {
      expect(paperclip).not.toBeDisabled();
    });

    // Click — must delegate to the hidden file input's .click().
    await user.click(paperclip);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    // Confirm the click reached AgentGenerator's own picker, not PromptInput's
    // internal hidden input (which also renders an input[type="file"]).
    const sel = 'input[type="file"][accept="image/*,audio/*,video/*,*"]';
    const fileInput = container.querySelector(sel);
    expect(fileInput).toBeTruthy();
    expect(fileInput).toHaveClass("hidden");
    expect(clickSpy.mock.contexts).toContain(fileInput);
  });
});

// ---------------------------------------------------------------------------
// Helper — drive the full model-select → session-create flow so sessionId is
// set and the textarea + composer are fully interactive.
// ---------------------------------------------------------------------------
async function waitForSession(container: HTMLElement, user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => {
    expect(vi.mocked(listModels)).toHaveBeenCalled();
  });
  await user.click(screen.getByRole("combobox", { name: /model/i }));
  const searchInput = screen.getByPlaceholderText("Search models…");
  await user.type(searchInput, "claude-sonnet-4");
  const option = await screen.findByText("claude-sonnet-4");
  await user.click(option);
  await waitFor(() => {
    expect(vi.mocked(callCreateGeneratorSession)).toHaveBeenCalled();
  });
  // Textarea becomes enabled once sessionId is set.
  await waitFor(() => {
    const ta = container.querySelector("textarea");
    expect(ta).not.toBeDisabled();
  });
}

describe("AgentGenerator — paste + drop attachments", () => {
  beforeEach(() => {
    vi.mocked(listModels).mockResolvedValue({ models: ["claude-sonnet-4"] });
    vi.mocked(listGeneratorPresets).mockResolvedValue({ archetypes: [], integrations: [] });
    vi.mocked(callCreateGeneratorSession).mockResolvedValue({
      id: 42,
      status: "draft",
      model: "claude-sonnet-4",
      reasoning: "medium",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("pasting a file into the textarea shows an AttachmentChip preview", async () => {
    const user = userEvent.setup();
    const { container } = renderAgentGenerator();
    await waitForSession(container, user);

    const textarea = container.querySelector("textarea")!;
    expect(textarea).toBeTruthy();

    const file = new File(["hello"], "test.txt", { type: "text/plain" });

    // Plain Event + defineProperty avoids ClipboardEvent/DataTransfer jsdom gaps.
    // fireEvent keeps the dispatch inside React's act() boundary.
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", {
      value: { files: makeFileList([file]), items: [] },
    });
    fireEvent(textarea, paste);

    // AttachmentChip renders the filename once the FileReader resolves.
    await waitFor(() => {
      expect(container.textContent).toContain("test.txt");
    });
  });

  it("dropping a file on the composer wrapper shows an AttachmentChip preview", async () => {
    const user = userEvent.setup();
    const { container } = renderAgentGenerator();
    await waitForSession(container, user);

    // Use text/plain so AttachmentChip renders the filename in textContent
    // (image/* renders as <img alt> only, not in textContent).
    const file = new File(["world"], "dropped.txt", { type: "text/plain" });

    // Find the composer wrapper — the div with onDropCapture.
    const composerWrapper = container.querySelector(
      '[data-testid="composer-wrapper"]',
    ) as HTMLElement;
    expect(composerWrapper).toBeTruthy();

    // Plain Event + defineProperty avoids DragEvent/DataTransfer jsdom gaps.
    // fireEvent keeps the dispatch inside React's act() boundary.
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", {
      value: { types: ["Files"], files: makeFileList([file]), items: [] },
    });
    fireEvent(composerWrapper, drop);

    await waitFor(() => {
      expect(container.textContent).toContain("dropped.txt");
    });
  });

  it("submitting with attachments-only fires callGeneratorSend with the converted payload", async () => {
    vi.mocked(callGeneratorSend).mockResolvedValue({
      reply: "ok",
      spec: {},
      status: "idle",
    } as never);

    const user = userEvent.setup();
    const { container } = renderAgentGenerator();
    await waitForSession(container, user);

    // Paste a file to populate pending attachments.
    const file = new File(["data"], "attach.pdf", { type: "application/pdf" });
    const textarea = container.querySelector("textarea")!;
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", {
      value: { files: makeFileList([file]), items: [] },
    });
    fireEvent(textarea, paste);

    // Wait for the chip to appear (FileReader resolved).
    await waitFor(() => {
      expect(container.textContent).toContain("attach.pdf");
    });

    // Submit with empty text — canSend is true because pending.length > 0.
    const submitBtn = await screen.findByRole("button", { name: /send/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(vi.mocked(callGeneratorSend)).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionId: 42,
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
// Utility — build a minimal FileList-shaped value from an array of Files.
// Avoids DataTransfer (unreliable in jsdom); readAttachments() only needs
// Array.from()-ability + .length + index access.
// ---------------------------------------------------------------------------
function makeFileList(files: File[]): FileList {
  return Object.assign([...files], {
    item: (i: number) => files[i] ?? null,
  }) as unknown as FileList;
}

// ---------------------------------------------------------------------------
// Model picker filtering
// ---------------------------------------------------------------------------
describe("AgentGenerator — model picker filtering", () => {
  const FOUR_MODELS = ["claude-sonnet-4", "claude-opus-4", "gpt-5", "kimi-k2.5"];

  beforeEach(() => {
    vi.mocked(listModels).mockResolvedValue({ models: FOUR_MODELS });
    vi.mocked(listGeneratorPresets).mockResolvedValue({ archetypes: [], integrations: [] });
    vi.mocked(callCreateGeneratorSession).mockResolvedValue({
      id: 42,
      status: "draft",
      model: "claude-sonnet-4",
      reasoning: "medium",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("search input filters the model list by substring", async () => {
    const user = userEvent.setup();
    renderAgentGenerator();

    await waitFor(() => expect(vi.mocked(listModels)).toHaveBeenCalled());

    await user.click(screen.getByRole("combobox", { name: /model/i }));
    const searchInput = screen.getByPlaceholderText("Search models…");
    await user.type(searchInput, "claude");

    await screen.findByText("claude-sonnet-4");
    await screen.findByText("claude-opus-4");
    expect(screen.queryByText("gpt-5")).toBeNull();
    expect(screen.queryByText("kimi-k2.5")).toBeNull();
  });

  it("empty state shows when no models match", async () => {
    const user = userEvent.setup();
    renderAgentGenerator();

    await waitFor(() => expect(vi.mocked(listModels)).toHaveBeenCalled());

    await user.click(screen.getByRole("combobox", { name: /model/i }));
    const searchInput = screen.getByPlaceholderText("Search models…");
    await user.type(searchInput, "zzzzzz");

    await screen.findByText("No matching models");
  });

  it("selecting a model closes the popover", async () => {
    const user = userEvent.setup();
    renderAgentGenerator();

    await waitFor(() => expect(vi.mocked(listModels)).toHaveBeenCalled());

    await user.click(screen.getByRole("combobox", { name: /model/i }));
    await screen.findByPlaceholderText("Search models…");

    await user.click(await screen.findByText("claude-sonnet-4"));

    expect(screen.queryByPlaceholderText("Search models…")).toBeNull();
  });
});
