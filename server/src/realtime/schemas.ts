import { z } from "zod";

import { documentIdSchema } from "../constants/document.js";

export const MAX_SYNC_PAYLOAD_BYTES = 1_000_000;

const binaryPayloadSchema = z
    .instanceof(Uint8Array)
    .refine(
        (payload) => payload.byteLength <= MAX_SYNC_PAYLOAD_BYTES,
        `binary payload must be at most ${MAX_SYNC_PAYLOAD_BYTES} bytes`
    );

export const documentJoinPayloadSchema = z.object({
    docId: documentIdSchema,
});

export const syncStep1PayloadSchema = z.object({
    docId: documentIdSchema,
    stateVector: binaryPayloadSchema,
});

export const syncStep2PayloadSchema = z.object({
    docId: documentIdSchema,
    diff: binaryPayloadSchema,
});
