import { basicSetup } from "codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import type { Extension } from "@codemirror/state";

export type { Extension } from "@codemirror/state";

export const editorExtensions = (): Extension[] => [
    basicSetup,
    keymap.of([indentWithTab]),
    EditorView.theme({
        "&": { height: "100%", fontSize: "14px" },
        ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
    }),
    EditorView.lineWrapping,
];
