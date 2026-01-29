import "@testing-library/jest-dom";
import { vi } from "vitest";

vi.mock("use-typed-reducer", () => ({
  createGlobalReducer: vi.fn(),
  useTypedReducer: vi.fn(),
}));