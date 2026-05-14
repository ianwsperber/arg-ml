// Browser entry point. Bundled by `scripts/generate-render-assets.ts` into a
// single IIFE that `renderHTML` inlines into the emitted HTML. Splitting the
// bootstrap from `arg-render.ts` keeps the latter import-free for tests.

import { mount } from "./arg-render.js";

mount(document, window);
