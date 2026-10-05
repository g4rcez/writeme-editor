import { describe, it, expect, beforeAll } from "vitest";
import { parseDocusaurusAdmonitions, Callout, ADMONITION_MAP } from "./callout";

function makeRoot(html: string): HTMLDivElement {
    const doc = new DOMParser().parseFromString(`<body><div>${html}</div></body>`, "text/html");
    return doc.body.firstElementChild as HTMLDivElement;
}

describe("parseDocusaurusAdmonitions", () => {
    it("converts :::note block to callout div", () => {
        const root = makeRoot("<p>:::note</p><p>Some <strong>content</strong> here.</p><p>:::</p>");
        parseDocusaurusAdmonitions(root);
        const callout = root.querySelector("div[data-type='callout']");
        expect(callout).not.toBeNull();
        expect(callout?.getAttribute("data-callout-type")).toBe("note");
        expect(callout?.querySelector("strong")?.textContent).toBe("content");
        const directPs = Array.from(root.children).filter((el) => el.tagName === "P");
        expect(directPs.length).toBe(0);
    });

    it("converts all five Docusaurus types", () => {
        for (const type of ["note", "tip", "info", "warning", "danger"] as const) {
            const root = makeRoot(`<p>:::${type}</p><p>body</p><p>:::</p>`);
            parseDocusaurusAdmonitions(root);
            const callout = root.querySelector("div[data-type='callout']");
            expect(callout?.getAttribute("data-callout-type")).toBe(type);
        }
    });

    it("removes the opening and closing marker paragraphs", () => {
        const root = makeRoot("<p>:::warning</p><p>text</p><p>:::</p>");
        parseDocusaurusAdmonitions(root);
        const paras = root.querySelectorAll("p");
        expect(paras.length).toBe(1);
        expect(paras[0]?.textContent).toBe("text");
    });

    it("handles multiple admonitions in sequence", () => {
        const root = makeRoot("<p>:::note</p><p>first</p><p>:::</p><p>:::danger</p><p>second</p><p>:::</p>");
        parseDocusaurusAdmonitions(root);
        const callouts = root.querySelectorAll("div[data-type='callout']");
        expect(callouts.length).toBe(2);
        expect(callouts[0]?.getAttribute("data-callout-type")).toBe("note");
        expect(callouts[1]?.getAttribute("data-callout-type")).toBe("danger");
    });

    it("ignores unknown types", () => {
        const root = makeRoot("<p>:::custom</p><p>body</p><p>:::</p>");
        parseDocusaurusAdmonitions(root);
        expect(root.querySelector("div[data-type='callout']")).toBeNull();
        expect(root.querySelectorAll("p").length).toBe(3);
    });

    it("handles multi-paragraph content inside the block", () => {
        const root = makeRoot("<p>:::info</p><p>paragraph one</p><p>paragraph two</p><p>:::</p>");
        parseDocusaurusAdmonitions(root);
        const callout = root.querySelector("div[data-type='callout']");
        expect(callout?.querySelectorAll("p").length).toBe(2);
    });

    it("does not affect content outside admonition blocks", () => {
        const root = makeRoot("<p>before</p><p>:::tip</p><p>inside</p><p>:::</p><p>after</p>");
        parseDocusaurusAdmonitions(root);
        const directPs = Array.from(root.children).filter((el) => el.tagName === "P");
        expect(directPs.length).toBe(2);
        expect(directPs[0]?.textContent).toBe("before");
        expect(directPs[1]?.textContent).toBe("after");
    });

    it("does not mutate when closing marker is absent", () => {
        const root = makeRoot("<p>:::note</p><p>orphaned content</p>");
        parseDocusaurusAdmonitions(root);
        expect(root.querySelector("div[data-type='callout']")).toBeNull();
        expect(root.querySelectorAll("p").length).toBe(2);
    });

    it("inserts empty paragraph when admonition has no content", () => {
        const root = makeRoot("<p>:::note</p><p>:::</p>");
        parseDocusaurusAdmonitions(root);
        const callout = root.querySelector("div[data-type='callout']");
        expect(callout).not.toBeNull();
        expect(callout?.querySelectorAll("p").length).toBe(1);
    });

    it("preserves all five Docusaurus types in round-trip", () => {
        const types = ["note", "tip", "info", "warning", "danger"] as const;
        for (const type of types) {
            const root = makeRoot(`<p>:::${type}</p><p>content for ${type}</p><p>:::</p>`);
            parseDocusaurusAdmonitions(root);
            const callout = root.querySelector(`div[data-callout-type='${type}']`);
            expect(callout).not.toBeNull();
            expect(callout?.textContent?.trim()).toBe(`content for ${type}`);
        }
    });
});

describe("callout serialize", () => {
    function makeSerializeState() {
        const calls: string[] = [];
        let out = "";
        let closed: unknown = null;
        return {
            get calls() {
                return calls;
            },
            get out() {
                return out;
            },
            get closed() {
                return closed;
            },
            set closed(v: unknown) {
                closed = v;
            },
            write(str: string) {
                calls.push(`write:${str}`);
                out += str;
            },
            ensureNewLine() {
                calls.push("ensureNewLine");
                if (!out.endsWith("\n")) out += "\n";
            },
            closeBlock(_n: unknown) {
                calls.push("closeBlock");
                closed = null;
                out += "\n\n";
            },
            renderContent(_n: unknown) {
                calls.push("renderContent");
                out += "content\n\n";
                closed = {}; // simulate a closed paragraph
            },
            wrapBlock(prefix: string, _d: unknown, _n: unknown, fn: () => void) {
                calls.push(`wrapBlock:${prefix}`);
                fn();
            },
        };
    }

    let serialize: (state: ReturnType<typeof makeSerializeState>, node: { attrs: { type: string } }) => void;

    beforeAll(() => {
        const config = (Callout as any).config;
        const storage = config.addStorage?.call({}) as any;
        serialize = storage?.markdown?.serialize;
        expect(serialize).toBeDefined();
    });

    it("emits :::type fence without blank line before closing for Docusaurus types", () => {
        for (const type of Object.keys(ADMONITION_MAP)) {
            const state = makeSerializeState();
            serialize(state, { attrs: { type } });
            expect(state.out).toContain(`:::${type}\n`);
            expect(state.calls).toContain("ensureNewLine");
            const ensureIdx = state.calls.indexOf("ensureNewLine");
            const writeClosingIdx = state.calls.indexOf("write::::");
            expect(writeClosingIdx).toBeGreaterThan(ensureIdx);
            expect(state.out).not.toMatch(/content\n\n\n:::/);
        }
    });

    it("emits GFM format for legacy types", () => {
        const cases = [
            ["success", "TIP"],
            ["primary", "IMPORTANT"],
            ["default", "NOTE"],
            ["important", "IMPORTANT"],
            ["caution", "CAUTION"],
        ] as const;
        for (const [type, gfmType] of cases) {
            const state = makeSerializeState();
            serialize(state, { attrs: { type } });
            expect(state.calls.some((c) => c.startsWith("wrapBlock"))).toBe(true);
            expect(state.out).toContain(`[!${gfmType}]`);
        }
    });

    it("falls back to NOTE for unknown legacy types", () => {
        const state = makeSerializeState();
        serialize(state, { attrs: { type: "completely-unknown" } });
        expect(state.out).toContain("[!NOTE]");
    });
});
