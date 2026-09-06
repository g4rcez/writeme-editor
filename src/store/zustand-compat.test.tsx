import { render, screen } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { createZustandCompatStore } from "./zustand-compat";

const store = createZustandCompatStore({ count: 0 }, () => ({
    setCount: (count: number) => ({ count }),
}));

describe("createZustandCompatStore", () => {
    it("supports object selectors without an unstable snapshot loop", () => {
        function SelectedCount() {
            const [state] = store((current) => ({ count: current.count }));
            return <span>{state.count}</span>;
        }

        render(<SelectedCount />);
        expect(screen.getByText("0")).toBeInTheDocument();

        act(() => store.dispatchers.setCount(1));
        expect(screen.getByText("1")).toBeInTheDocument();
    });
});
