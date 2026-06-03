// Type shim for jsdom when @types/jsdom is not installed.
// jsdom ships its own types as of v25; if you see a "cannot find module"
// error, install @types/jsdom and delete this file.
declare module 'jsdom' {
  export class JSDOM {
    constructor(html: string, options?: { url?: string; pretendToBeVisual?: boolean });
    window: {
      document: Document;
      navigator: Navigator;
      HTMLElement: typeof HTMLElement;
      Element: typeof Element;
      Node: typeof Node;
    };
  }
}
