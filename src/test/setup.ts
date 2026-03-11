import "@testing-library/jest-dom";
import { vi } from "vitest";

vi.mock("use-typed-reducer", () => ({
  createGlobalReducer: vi.fn((initialState, reducer) => {
    const dispatchers = reducer({ state: () => initialState });
    const mock: any = vi.fn(() => [initialState, dispatchers]);
    mock.getState = vi.fn(() => initialState);
    mock.dispatchers = dispatchers;
    return mock;
  }),
  useTypedReducer: vi.fn(),
}));

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();
