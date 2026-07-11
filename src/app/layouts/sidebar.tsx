import { css } from "@g4rcez/components";
import { Fragment, useCallback, useEffect, useState, type CSSProperties } from "react";
import { SidebarShell } from "@/app/components/sidebar/sidebar-shell";
import { useGlobalStore } from "@/store/global.store";
import { useUIStore } from "@/store/ui.store";
import { ActivityBar } from "../components/sidebar/activity-bar";

const SIDEBAR_MIN_WIDTH = 280;

const SIDEBAR_MAX_WIDTH = 520;

export const Sidebar = () => {
    const [state, dispatch] = useGlobalStore();
    const [uiState, uiDispatch] = useUIStore();
    const collapsed = !uiState.sidebarOpen;
    const sidebarWidth = Math.min(Math.max(state.sidebarWidth, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH);
    const [isResizing, setIsResizing] = useState(false);
    const resize = useCallback(
        (e: MouseEvent) => {
            if (isResizing) {
                const newWidth = e.clientX;
                if (newWidth >= SIDEBAR_MIN_WIDTH && newWidth <= SIDEBAR_MAX_WIDTH) {
                    dispatch.setSidebarWidth(newWidth);
                }
            }
        },
        [dispatch, isResizing],
    );

    useEffect(() => {
        const controller = new AbortController();
        const opts = { signal: controller.signal };
        const stopResizing = () => setIsResizing(false);
        window.addEventListener("mousemove", resize, opts);
        window.addEventListener("mouseup", stopResizing, opts);
        return () => void controller.abort();
    }, [resize]);

    useEffect(() => {
        const mql = window.matchMedia("(max-width: 767px)");
        const onNarrow = (e: MediaQueryListEvent) => (e.matches ? uiDispatch.setSidebarOpen(false) : undefined);
        if (mql.matches) uiDispatch.setSidebarOpen(false);
        mql.addEventListener("change", onNarrow);
        return () => mql.removeEventListener("change", onNarrow);
    }, [uiDispatch]);

    return (
        <Fragment>
            <ActivityBar />
            <div
                style={{ "--panel-w": `${sidebarWidth}px` } as CSSProperties}
                data-resizing={isResizing || undefined}
                className={css(
                    "writeme-aside-panel",
                    collapsed ? "writeme-aside-panel--collapsed" : "writeme-aside-panel--open",
                )}
            >
                <div
                    className="writeme-aside-panel-inner"
                    style={{
                        width: `${sidebarWidth}px`,
                        transform: collapsed ? "translateX(-100%)" : "translateX(0)",
                    }}
                >
                    {collapsed ? null : <SidebarShell />}
                </div>
            </div>
            {!collapsed && (
                <div
                    tabIndex={0}
                    role="separator"
                    aria-label="Resize sidebar"
                    aria-orientation="vertical"
                    aria-valuenow={sidebarWidth}
                    className="writeme-aside-resize"
                    aria-valuemax={SIDEBAR_MAX_WIDTH}
                    aria-valuemin={SIDEBAR_MIN_WIDTH}
                    onMouseDown={() => setIsResizing(true)}
                    onKeyDown={(e) => {
                        const step = e.shiftKey ? 32 : 16;
                        if (e.key === "ArrowRight") {
                            e.preventDefault();
                            dispatch.setSidebarWidth(Math.min(sidebarWidth + step, SIDEBAR_MAX_WIDTH));
                        }
                        if (e.key === "ArrowLeft") {
                            e.preventDefault();
                            dispatch.setSidebarWidth(Math.max(sidebarWidth - step, SIDEBAR_MIN_WIDTH));
                        }
                    }}
                />
            )}
        </Fragment>
    );
};
