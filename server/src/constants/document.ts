import { z } from "zod";

// Length of document IDs from nanoid(21), the share-link token itself.
export const DOC_ID_LENGTH = 21;

// Nanoid default alphabet: A-Z, a-z, 0-9, `_`, `-`.
const DOC_ID_ALPHABET = /^[A-Za-z0-9_-]+$/;

export const documentIdSchema = z
    .string()
    .length(DOC_ID_LENGTH)
    .regex(DOC_ID_ALPHABET, "document id has malformed characters");
