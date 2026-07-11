import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
}

if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = () => new DOMRect();
}
