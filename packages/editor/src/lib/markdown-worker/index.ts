import MarkdownWorker from "./markdown.worker?worker";

let worker: Worker | null = null;

export const LARGE_MARKDOWN_THRESHOLD = 50_000;
export const WARN_THRESHOLD = 2_000_000;
export const HARD_LIMIT = 10_000_000;

export function getMarkdownWorker(): Worker {
    if (!worker) {
        worker = new MarkdownWorker();
    }
    return worker;
}
