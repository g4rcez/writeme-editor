import { render, screen } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { createZustandCompatStore } from "./zustand-compat";

const store = createZustandCompatStore({ count: 0 }, () => ({
    setCount: (count: number) => ({ count }),
}));

describe("createZustandCompatStore", () => {
    it("commits guarded async results before a newer action can interleave", async () => {
        let finish = (): void => {};
        const pending = new Promise<void>((resolve) => { finish = resolve; });
        const intercepted = vi.fn();
        const isolated = createZustandCompatStore({ count: 0 }, (get) => ({
            setCount: (count: number) => ({ count }),
            complete: async (): Promise<void> => {
                await pending;
                get.patch({ count: 1 });
            },
        }), { interceptor: [intercepted] });
        const completing = isolated.dispatchers.complete();
        finish();
        await Promise.resolve();
        expect(isolated.getState().count).toBe(1);
        isolated.dispatchers.setCount(2);
        await completing;
        expect(isolated.getState().count).toBe(2);
        expect(intercepted).toHaveBeenCalledTimes(2);
    });

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
