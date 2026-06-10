# Contributing to CortexOS Dashboard

Thanks for considering a contribution. This is an open-source project — we welcome bug reports, feature ideas, and pull requests.

## Ground rules

1. **Be kind.** All communication is governed by the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
2. **One PR per concern.** Small, focused PRs land faster.
3. **Tests required for new logic.** UI tweaks don't need tests; new hooks, utilities, or behavior do.
4. **Design tokens only.** Never use raw color classes (`text-white`, `bg-black`) — always use semantic tokens from `src/styles.css` (`text-foreground`, `bg-background`, `text-muted-foreground`, etc.).

## Dev setup

```bash
bun install
bun run dev          # dev server with HMR
bun test             # vitest in watch mode
bun test --run       # single-run for CI
bun run lint
bun run format
bun run build
```

## Project layout

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for a tour.

Quick rules:

- **Pages** live in `src/features/`. Each page is a single exported `*Page` component. Page-local helpers go in `src/features/<page>/`.
- **Routes** live in `src/routes/` (TanStack Router file-based). **Never edit `routeTree.gen.ts`** — it is auto-generated.
- **Design-system primitives** live in `src/components/` and have unit tests. **shadcn primitives** under `src/components/ui/` are vendored and not tested.
- **Mock data** lives in `src/mocks/`. The API surface is `src/mocks/api.ts` — this is the seam where a real backend plugs in.

## Adding a new page

1. Add the labeled key to `src/i18n/en.ts` (and `es.ts`, `ptBR.ts`).
2. Create `src/features/MyPage.tsx` exporting `MyPagePage`.
3. Create `src/routes/_authenticated.my-page.tsx`:
   ```tsx
   import { createFileRoute } from "@tanstack/react-router";
   import { MyPagePage } from "@/features/MyPage";

   export const Route = createFileRoute("/_authenticated/my-page")({
     component: MyPagePage,
   });
   ```
4. Add it to `src/app/NavConfig.ts` so it appears in the sidebar and ⌘K.
5. Add a smoke test under `src/features/MyPage.test.tsx`.

## Writing tests

```tsx
import { describe, it, expect } from "vitest";
import { renderWithProviders, screen } from "@/test/utils";
import { MyComponent } from "./MyComponent";

describe("MyComponent", () => {
  it("renders the title", () => {
    renderWithProviders(<MyComponent title="Hi" />);
    expect(screen.getByText("Hi")).toBeInTheDocument();
  });
});
```

Coverage thresholds (lines / branches / functions / statements): **70 / 60 / 70 / 70**. CI fails below that.

## Accessibility

- Every icon-only button needs `aria-label`.
- All interactive elements must be keyboard-reachable.
- Use semantic HTML (`<button>`, `<nav>`, `<main>`) over `<div onClick>`.
- Run `bun run lint` — `eslint-plugin-jsx-a11y` catches the obvious issues.

## Commits & PRs

- Conventional commits encouraged but not enforced: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
- PR title becomes the changelog entry — make it human.
- Mark draft PRs as draft.

## Reporting bugs

Open an issue with:
1. What you did
2. What you expected
3. What happened (include screenshots, console errors, the page URL)
4. Browser + OS

## License

By contributing you agree your work is licensed under the project's [MIT license](./LICENSE).
