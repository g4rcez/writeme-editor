// A retried job must be idempotent, including any writes completed before it failed.
type TabWrite = () => Promise<unknown>;

export function createTabPersistenceQueue(onError: () => void) {
    const writes: TabWrite[] = [];
    let running: Promise<void> | undefined;
    let failure: unknown;
    let failed = false;

    async function drain(): Promise<void> {
        while (writes.length > 0) {
            const write = writes[0];
            if (!write) return;
            try {
                await write();
                writes.shift();
            } catch (error) {
                failure = error;
                failed = true;
                onError();
                return;
            }
        }
    }

    function start(): void {
        if (running || failed || writes.length === 0) return;
        running = Promise.resolve().then(drain).finally(() => {
            running = undefined;
            start();
        });
    }

    return {
        enqueue(write: TabWrite): void {
            writes.push(write);
            if (failed) onError();
            start();
        },
        hasPending(): boolean {
            return writes.length > 0;
        },
        retry(): void {
            failed = false;
            failure = undefined;
            start();
        },
        async flush(): Promise<void> {
            if (failed) {
                onError();
                throw failure;
            }
            while (running || writes.length > 0) {
                start();
                await running;
                if (failed) throw failure;
            }
        },
    };
}
