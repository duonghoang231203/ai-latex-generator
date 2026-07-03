import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom không cung cấp các API trình duyệt mà Base UI / @shadcn/react cần khi
// render (MessageScroller, Menu positioner…). Thêm polyfill no-op tối thiểu.
// Chỉ áp dụng trong môi trường có DOM (jsdom); các test chạy môi trường "node"
// (API/unit) sẽ bỏ qua để tránh lỗi "Element is not defined".
const noop = () => undefined;

if (typeof window !== "undefined") {
  class ResizeObserverStub {
    observe = noop;
    unobserve = noop;
    disconnect = noop;
  }

  class IntersectionObserverStub {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: number[] = [];
    observe = noop;
    unobserve = noop;
    disconnect = noop;
    takeRecords = () => [];
  }

  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);

  if (typeof window.matchMedia !== "function") {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: noop,
      removeEventListener: noop,
      addListener: noop,
      removeListener: noop,
      dispatchEvent: () => false,
    }));
  }

  const elementProto = Element.prototype as unknown as Record<string, unknown>;
  for (const method of [
    "scrollIntoView",
    "scrollTo",
    "hasPointerCapture",
    "setPointerCapture",
    "releasePointerCapture",
  ]) {
    if (typeof elementProto[method] !== "function") {
      elementProto[method] = noop;
    }
  }
}
