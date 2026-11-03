import { z } from "zod";

import { documentIdSchema } from "../constants/document.js";

export const MAX_SYNC_PAYLOAD_BYTES = 1_000_000;

export const MAX_AWARENESS_PAYLOAD_BYTES = 32_000;

const binaryPayloadSchema = (maxBytes: number) =>
    z
        .instanceof(Uint8Array)
        .refine(
            (payload) => payload.byteLength <= maxBytes,
            `binary payload must be at most ${maxBytes} bytes`
        );

const awarenessClientIdSchema = z.number().int().min(0).max(4_294_967_295);

export const documentJoinPayloadSchema = z.object({
    docId: documentIdSchema,
    clientId: awarenessClientIdSchema,
});

export const syncStep1PayloadSchema = z.object({
    docId: documentIdSchema,
    stateVector: binaryPayloadSchema(MAX_SYNC_PAYLOAD_BYTES),
});

export const syncStep2PayloadSchema = z.object({
    docId: documentIdSchema,
    diff: binaryPayloadSchema(MAX_SYNC_PAYLOAD_BYTES),
});

export const documentUpdatePayloadSchema = z.object({
    docId: documentIdSchema,
    update: binaryPayloadSchema(MAX_SYNC_PAYLOAD_BYTES),
});

export const awarenessUpdatePayloadSchema = z.object({
    docId: documentIdSchema,
    update: binaryPayloadSchema(MAX_AWARENESS_PAYLOAD_BYTES),
});
