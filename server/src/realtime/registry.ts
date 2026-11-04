import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";

import * as documentService from "../services/document.service.js";
import type { Document } from "../db/schema.js";

export const CONTENT_TEXT_KEY = "content";

export const GC_GRACE_MS = 60_000;

export type DocumentSession = {
    document: Document;
    docId: string;
    ydoc: Y.Doc;
    awareness: Awareness;
    sockets: Set<string>;
    gcTimer: NodeJS.Timeout | null;
    dirty: boolean;
};

const sessions = new Map<string, DocumentSession>();

const loading = new Map<string, Promise<DocumentSession | null>>();

let onLastSocketLeave: ((session: DocumentSession) => void) | null = null;

export const setOnLastSocketLeave = (fn: ((session: DocumentSession) => void) | null): void => {
    onLastSocketLeave = fn;
};

export const getAllSessions = (): IterableIterator<DocumentSession> => sessions.values();

export const getSession = (docId: string): DocumentSession | undefined => sessions.get(docId);

export const getJoinedSession = (docId: string, socketId: string): DocumentSession | undefined => {
    const session = sessions.get(docId);

    return session && session.sockets.has(socketId) ? session : undefined;
};

const loadSession = async (docId: string): Promise<DocumentSession | null> => {
    const document = await documentService.getDocumentById(docId);

    if (!document) {
        return null;
    }

    const ydoc = new Y.Doc();

    const text = ydoc.getText(CONTENT_TEXT_KEY);

    if (document.content.length > 0) {
        ydoc.transact(() => text.insert(0, document.content));
    }

    const session: DocumentSession = {
        document,
        docId,
        ydoc,
        awareness: new Awareness(ydoc),
        sockets: new Set(),
        gcTimer: null,
        dirty: false,
    };

    ydoc.on("update", () => {
        session.dirty = true;
    });

    sessions.set(docId, session);

    return session;
};

export const getOrCreateSession = async (docId: string): Promise<DocumentSession | null> => {
    const active = sessions.get(docId);

    if (active) {
        return active;
    }

    const inFlight = loading.get(docId);

    if (inFlight) {
        return inFlight;
    }

    const pending = loadSession(docId).finally(() => loading.delete(docId));

    loading.set(docId, pending);

    return pending;
};

export const addSocket = (docId: string, socketId: string): DocumentSession | undefined => {
    const session = sessions.get(docId);

    if (!session) {
        return undefined;
    }

    if (session.gcTimer) {
        clearTimeout(session.gcTimer);
        session.gcTimer = null;
    }

    session.sockets.add(socketId);

    return session;
};

export const removeSocket = (docId: string, socketId: string): number => {
    const session = sessions.get(docId);

    if (!session) {
        return 0;
    }

    session.sockets.delete(socketId);

    if (session.sockets.size > 0) {
        return session.sockets.size;
    }

    if (onLastSocketLeave) {
        onLastSocketLeave(session);
    }

    session.gcTimer = setTimeout(() => discardSession(docId), GC_GRACE_MS);

    return 0;
};

export const discardSession = (docId: string): void => {
    const session = sessions.get(docId);

    if (!session) {
        return;
    }

    if (session.gcTimer) {
        clearTimeout(session.gcTimer);
        session.gcTimer = null;
    }

    session.awareness.destroy();

    session.ydoc.destroy();

    sessions.delete(docId);
};

export const discardAllSessions = (): void => {
    for (const docId of Array.from(sessions.keys())) {
        discardSession(docId);
    }
};
