import { decodeFeedback, type FeedbackDocument, type FeedbackRun } from "./feedback-content";

const blockTags = new Set(["P", "DIV", "LI", "H1", "H2", "H3", "BLOCKQUOTE"]);
// DOM is only a transient native-editing surface. Never persist its HTML.
export function readFeedbackEditor(root: HTMLElement): FeedbackDocument {
    let visited = 0;
    function inline(node: Node, marks: Omit<FeedbackRun, "text"> = {}, depth = 0): FeedbackRun[] {
        if (++visited > 12000 || depth > 16) throw new Error("Feedback formatting is too complex.");
        if (node.nodeType === Node.TEXT_NODE) return node.textContent ? [{ text: node.textContent, ...marks }] : [];
        if (!(node instanceof HTMLElement) || ["SCRIPT", "STYLE", "IFRAME", "OBJECT", "IMG"].includes(node.tagName)) return [];
        if (node.tagName === "BR") return [{ text: "\n", ...marks }];
        const next = { ...marks };
        if (["B", "STRONG"].includes(node.tagName) || Number(node.style.fontWeight) >= 600 || node.style.fontWeight === "bold") next.bold = true;
        if (["I", "EM"].includes(node.tagName) || node.style.fontStyle === "italic") next.italic = true;
        if (node.tagName === "U" || node.style.textDecoration.includes("underline")) next.underline = true;
        const result: FeedbackRun[] = [];
        for (const child of node.childNodes) {
            if (child instanceof HTMLElement && blockTags.has(child.tagName) && result.length) result.push({ text: "\n", ...next });
            result.push(...inline(child, next, depth + 1));
        }
        // Native empty paragraphs/list items contain a solitary placeholder BR.
        if (result.length === 1 && result[0].text === "\n") return [];
        return result;
    }
    function compact(runs: FeedbackRun[]): FeedbackRun[] {
        const result: FeedbackRun[] = [];
        for (const run of runs) {
            const previous = result.at(-1);
            if (previous && !!previous.bold === !!run.bold && !!previous.italic === !!run.italic && !!previous.underline === !!run.underline) previous.text += run.text;
            else result.push({ ...run });
        }
        return result;
    }
    const blocks: FeedbackDocument["blocks"] = [];
    let pending: FeedbackRun[] = [];
    const flush = () => { if (pending.length) { blocks.push({ type: "paragraph", content: compact(pending) }); pending = []; } };
    function visit(node: Node, depth = 0) {
        if (depth > 16 || ++visited > 12000) throw new Error("Feedback formatting is too complex.");
        if (node instanceof HTMLElement && ["UL", "OL"].includes(node.tagName)) {
            flush();
            const items = Array.from(node.children).filter(child => child.tagName === "LI").map(child => compact(inline(child)));
            if (items.length) blocks.push({ type: node.tagName === "UL" ? "bulletList" : "numberList", items });
        } else if (node instanceof HTMLElement && node.querySelector("ul,ol")) {
            // Native editing can produce P > UL/OL. Preserve the list as a block.
            flush(); for (const child of node.childNodes) visit(child, depth + 1); flush();
        } else if (node instanceof HTMLElement && blockTags.has(node.tagName)) { flush(); blocks.push({ type: "paragraph", content: compact(inline(node)) }); }
        else pending.push(...inline(node));
    }
    for (const node of root.childNodes) visit(node);
    flush();
    return { version: 1, blocks };
}

/** Only used for initial/external state restoration, never on every keystroke. */
export function restoreFeedbackEditor(root: HTMLElement, value: string) {
    const document = root.ownerDocument;
    const fragment = document.createDocumentFragment();
    const parsed = decodeFeedback(value);
    function appendRuns(parent: HTMLElement, runs: FeedbackRun[]) {
        for (const run of runs) {
            let node: Node = document.createTextNode(run.text);
            for (const tag of [run.underline && "u", run.italic && "em", run.bold && "strong"]) {
                if (!tag) continue;
                const wrapper = document.createElement(tag); wrapper.append(node); node = wrapper;
            }
            parent.append(node);
        }
        if (!parent.hasChildNodes()) parent.append(document.createElement("br"));
    }
    for (const block of parsed?.blocks ?? []) {
        if (block.type === "paragraph") { const p = document.createElement("p"); appendRuns(p, block.content); fragment.append(p); }
        else {
            const list = document.createElement(block.type === "bulletList" ? "ul" : "ol");
            for (const item of block.items) { const li = document.createElement("li"); appendRuns(li, item); list.append(li); }
            fragment.append(list);
        }
    }
    root.replaceChildren(fragment);
}
