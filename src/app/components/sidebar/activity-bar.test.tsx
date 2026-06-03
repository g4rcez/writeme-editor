import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { ActivityBar } from "./activity-bar";

const { navigate, setActivity, setSidebarOpen, toggleSidebar } = vi.hoisted(
  () => ({
    navigate: vi.fn(),
    setActivity: vi.fn(),
    setSidebarOpen: vi.fn(),
    toggleSidebar: vi.fn(),
  }),
);

vi.mock("@g4rcez/components", () => ({
  css: (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(" "),
  Tooltip: ({ title }: { title: React.ReactNode }) => title,
}));

vi.mock("react-router-dom", () => ({
  Link: ({ children, ...props }: React.ComponentPropsWithoutRef<"a">) => (
    <a {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname: "/" }),
  useNavigate: () => navigate,
}));

vi.mock("@/app/contexts/layout-context", () => ({
  useLayoutStore: () => [
    {
      activeActivity: "explorer",
      activeView: { type: "all" },
      searchQuery: "",
    },
    { setActivity },
  ],
}));

vi.mock("@/store/global.store", () => ({
  useGlobalStore: () => [{ notes: [] }],
}));

vi.mock("@/store/ui.store", () => ({
  uiDispatch: { setSidebarOpen, toggleSidebar },
  useUIStore: () => [{ sidebarOpen: true }],
}));

vi.mock("../logo", () => ({
  WritemeLogo: (props: React.ComponentPropsWithoutRef<"svg">) => (
    <svg aria-hidden="true" {...props} />
  ),
}));

describe("ActivityBar", () => {
  beforeEach(() => {
    navigate.mockClear();
    setActivity.mockClear();
    setSidebarOpen.mockClear();
  });

  it("navigates to views and collapses the sidebar", () => {
    render(<ActivityBar />);

    fireEvent.click(screen.getByRole("button", { name: "Views" }));

    expect(setActivity).toHaveBeenCalledWith("views");
    expect(setSidebarOpen).toHaveBeenCalledWith(false);
    expect(navigate).toHaveBeenCalledWith("/views");
  });
});
