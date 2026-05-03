import { describe, expect, it, beforeEach, vi } from "vitest";

// Override the global setup.ts mock with a proper stateful implementation
vi.mock("use-typed-reducer", () => ({
  createGlobalReducer: vi.fn((initialState: any, reducerFactory: any) => {
    let state = { ...initialState };
    const getState = () => state;
    const rawReducers = reducerFactory({
      state: getState,
      props: () => ({}),
      initialState,
      previousState: getState,
    });
    const dispatchers: Record<string, (...args: any[]) => void> = {};
    for (const [key, fn] of Object.entries(rawReducers) as [string, any][]) {
      dispatchers[key] = (...args: any[]) => {
        const patch = fn(...args);
        if (patch && typeof patch === "object" && !(patch instanceof Promise)) {
          state = { ...state, ...patch };
        }
      };
    }
    const hook: any = vi.fn(() => [state, dispatchers]);
    hook.getState = getState;
    hook.dispatchers = dispatchers;
    return hook;
  }),
  useTypedReducer: vi.fn(),
}));

import { useUIStore, uiDispatch } from "./ui.store";

describe("uiStore — parsingContent", () => {
  beforeEach(() => {
    uiDispatch.setParsingContent(false);
  });

  it("defaults to false", () => {
    const state = useUIStore.getState();
    expect(state.parsingContent).toBe(false);
  });

  it("setParsingContent(true) sets it to true", () => {
    uiDispatch.setParsingContent(true);
    const state = useUIStore.getState();
    expect(state.parsingContent).toBe(true);
  });

  it("setParsingContent(false) clears it", () => {
    uiDispatch.setParsingContent(true);
    uiDispatch.setParsingContent(false);
    const state = useUIStore.getState();
    expect(state.parsingContent).toBe(false);
  });
});
