import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock scrollIntoView
if (typeof window !== "undefined") window.HTMLElement.prototype.scrollIntoView = vi.fn();

if (typeof Range !== "undefined" && !Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
}

if (typeof Range !== "undefined" && !Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = () => new DOMRect();
}
