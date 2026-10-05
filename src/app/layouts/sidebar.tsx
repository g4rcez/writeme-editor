import { css } from "@g4rcez/components";
import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { SidebarShell } from "@/app/components/sidebar/sidebar-shell";
import { useGlobalStore } from "@/store/global.store";
import { useUIStore } from "@/store/ui.store";
import { ActivityBar } from "../components/sidebar/activity-bar";

const SIDEBAR_MIN_WIDTH = 280;

const SIDEBAR_MAX_WIDTH = 520;

const SIDEBAR_MAX_VIEWPORT_RATIO = 0.4;

export const Sidebar = () => {
    const [state, dispatch] = useGlobalStore();
    const [uiState, uiDispatch] = useUIStore();
    const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
    const resizeOffset = useRef(0);
    const collapsed = !uiState.sidebarOpen;
    const sidebarMaxWidth = Math.max(
        SIDEBAR_MIN_WIDTH,
        Math.min(SIDEBAR_MAX_WIDTH, Math.round(viewportWidth * SIDEBAR_MAX_VIEWPORT_RATIO)),
    );
    const sidebarWidth = Math.min(Math.max(state.sidebarWidth, SIDEBAR_MIN_WIDTH), sidebarMaxWidth);
    const [isResizing, setIsResizing] = useState(false);
    const resize = useCallback(
        (e: MouseEvent) => {
            if (isResizing) {
                const newWidth = e.clientX - resizeOffset.current;
                if (newWidth >= SIDEBAR_MIN_WIDTH && newWidth <= sidebarMaxWidth) {
                    dispatch.setSidebarWidth(newWidth);
                }
            }
        },
        [dispatch, isResizing, sidebarMaxWidth],
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
        const updateViewportWidth = () => setViewportWidth(window.innerWidth);
        window.addEventListener("resize", updateViewportWidth);
        return () => window.removeEventListener("resize", updateViewportWidth);
    }, []);

    useEffect(() => {
        const mql = window.matchMedia("(max-width: 767px)");
        const onNarrow = (e: MediaQueryListEvent) => (e.matches ? uiDispatch.setSidebarOpen(false) : undefined);
        if (mql.matches) uiDispatch.setSidebarOpen(false);
        mql.addEventListener("change", onNarrow);
        return () => mql.removeEventListener("change", onNarrow);
    }, [uiDispatch]);

    useEffect(() => {
        if (collapsed) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") uiDispatch.setSidebarOpen(false);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [collapsed, uiDispatch]);

    return (
        <Fragment>
            <ActivityBar />
            {!collapsed && (
                <button
                    type="button"
                    className="writeme-mobile-sidebar-backdrop"
                    aria-label="Close workspace menu"
                    onClick={() => uiDispatch.setSidebarOpen(false)}
                />
            )}
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
                    aria-valuemax={sidebarMaxWidth}
                    aria-valuemin={SIDEBAR_MIN_WIDTH}
                    onMouseDown={(event) => {
                        resizeOffset.current = event.clientX - sidebarWidth;
                        setIsResizing(true);
                    }}
                    onKeyDown={(e) => {
                        const step = e.shiftKey ? 32 : 16;
                        if (e.key === "ArrowRight") {
                            e.preventDefault();
                            dispatch.setSidebarWidth(Math.min(sidebarWidth + step, sidebarMaxWidth));
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
