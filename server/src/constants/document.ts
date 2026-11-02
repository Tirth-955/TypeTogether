import { z } from "zod";

export const DOC_TYPES = ["text", "markdown", "code"] as const;

export type DocType = (typeof DOC_TYPES)[number];

export type LanguageMeta = {
    id: LanguageId;
    label: string;
    package: string;
};

export const LANGUAGE_IDS = [
    "javascript",
    "typescript",
    "python",
    "html",
    "css",
    "json",
    "java",
    "cpp",
    "rust",
    "go",
    "sql",
    "yaml",
    "php",
    "xml",
] as const;

export type LanguageId = (typeof LANGUAGE_IDS)[number];

export const SUPPORTED_LANGUAGES: readonly LanguageMeta[] = [
    { id: "javascript", label: "JavaScript", package: "@codemirror/lang-javascript" },
    { id: "typescript", label: "TypeScript", package: "@codemirror/lang-javascript" },
    { id: "python", label: "Python", package: "@codemirror/lang-python" },
    { id: "html", label: "HTML", package: "@codemirror/lang-html" },
    { id: "css", label: "CSS", package: "@codemirror/lang-css" },
    { id: "json", label: "JSON", package: "@codemirror/lang-json" },
    { id: "java", label: "Java", package: "@codemirror/lang-java" },
    { id: "cpp", label: "C++", package: "@codemirror/lang-cpp" },
    { id: "rust", label: "Rust", package: "@codemirror/lang-rust" },
    { id: "go", label: "Go", package: "@codemirror/lang-go" },
    { id: "sql", label: "SQL", package: "@codemirror/lang-sql" },
    { id: "yaml", label: "YAML", package: "@codemirror/lang-yaml" },
    { id: "php", label: "PHP", package: "@codemirror/lang-php" },
    { id: "xml", label: "XML", package: "@codemirror/lang-xml" },
];

export const DEFAULT_LANGUAGE: LanguageId = "javascript";

export const docTypeSchema = z.enum(DOC_TYPES);

export const languageSchema = z.enum(LANGUAGE_IDS);

// Length of document IDs from nanoid(21), the share-link token itself.
export const DOC_ID_LENGTH = 21;

// Nanoid default alphabet: A-Z, a-z, 0-9, `_`, `-`.
const DOC_ID_ALPHABET = /^[A-Za-z0-9_-]+$/;

export const documentIdSchema = z
    .string()
    .length(DOC_ID_LENGTH)
    .regex(DOC_ID_ALPHABET, "document id has malformed characters");
