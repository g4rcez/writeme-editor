export function createFrameTask(callback: () => void): { schedule: () => void; cancel: () => void } {
    let frame: number | null = null;
    return {
        schedule(): void {
            if (frame !== null) return;
            frame = requestAnimationFrame(() => {
                frame = null;
                callback();
            });
        },
        cancel(): void {
            if (frame === null) return;
            cancelAnimationFrame(frame);
            frame = null;
        },
    };
}
