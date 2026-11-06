import { basicSetup } from "codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import type { Extension } from "@codemirror/state";

export type { Extension } from "@codemirror/state";

export const editorExtensions = (): Extension[] => [
    basicSetup,
    keymap.of([indentWithTab]),
    EditorView.theme({
        "&": {
            height: "100%",
            fontSize: "14px",
            color: "var(--color-text)",
            backgroundColor: "transparent",
        },
        ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
        ".cm-gutters": {
            backgroundColor: "transparent",
            color: "var(--color-muted)",
            border: "none",
            borderRight: "1px solid var(--color-border)",
        },
        "&.cm-focused": { outline: "none" },
        ".cm-activeLine": {
            backgroundColor: "color-mix(in srgb, var(--color-primary) 7%, transparent)",
        },
        ".cm-activeLineGutter": {
            backgroundColor: "color-mix(in srgb, var(--color-primary) 7%, transparent)",
            color: "var(--color-text)",
        },
        ".cm-selectionBackground, .cm-content ::selection": {
            backgroundColor: "color-mix(in srgb, var(--color-primary) 35%, transparent) !important",
        },
        ".cm-cursor, .cm-dropCursor": {
            borderLeftWidth: "2px",
            borderLeftColor: "var(--color-text)",
        },
        ".cm-tooltip": {
            backgroundColor: "var(--color-surface-hover)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
        },
    }),
    EditorView.lineWrapping,
];
