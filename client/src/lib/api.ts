import axios, { isAxiosError } from "axios";

const http = axios.create({
    baseURL: "/api/v1",
    withCredentials: true,
});

export const getApiErrorMessage = (error: unknown): string => {
    if (isAxiosError(error)) {
        const data = error.response?.data as { message?: string } | undefined;

        return data?.message ?? error.message;
    }

    return error instanceof Error ? error.message : "Something went wrong";
};

export const getApiErrorStatus = (error: unknown): number | undefined => {
    if (isAxiosError(error)) {
        return error.response?.status;
    }

    return undefined;
};

export type User = {
    id: string;
    email: string;
};

export type DocumentListItem = {
    id: string;
    title: string;
    docType: "text" | "markdown" | "code";
    language: string | null;
    createdAt: string;
    updatedAt: string;
};

export type CreatedDocument = {
    id: string;
    title: string;
    docType: "text" | "markdown" | "code";
    language: string | null;
    shareUrl: string;
};

export type DocumentDetail = {
    id: string;
    title: string;
    docType: "text" | "markdown" | "code";
    language: string | null;
    content: string;
    saved: boolean;
    createdAt: string;
    updatedAt: string;
};

export type SaveResult = {
    id: string;
    title: string;
    docType: "text" | "markdown" | "code";
    language: string | null;
    saved: boolean;
    shareUrl: string;
    updatedAt: string;
};

type Ok<T> = { status: "ok"; user?: User; documents?: T };

export const api = {
    me: async (): Promise<User | null> => {
        const { data } = await http.get<Ok<never>>("/auth/me");
        return data.user ?? null;
    },

    login: async (email: string, password: string): Promise<User> => {
        const { data } = await http.post<Ok<never>>("/auth/login", { email, password });

        if (!data.user) {
            throw new Error(responseFailed("login"));
        }

        return data.user;
    },

    signup: async (email: string, password: string): Promise<User> => {
        const { data } = await http.post<Ok<never>>("/auth/signup", { email, password });

        if (!data.user) {
            throw new Error(responseFailed("signup"));
        }

        return data.user;
    },

    logout: async (): Promise<void> => {
        await http.post<Ok<never>>("/auth/logout");
    },

    myDocuments: async (): Promise<DocumentListItem[]> => {
        const { data } = await http.get<Ok<DocumentListItem>>("/users/me/documents");

        if (!data.documents) {
            throw new Error(responseFailed("listing documents"));
        }

        return data.documents;
    },

    createDocument: async (input: {
        title: string;
        docType: "text" | "markdown" | "code";
        language?: string;
    }): Promise<CreatedDocument> => {
        const { data } = await http.post<{
            status: "ok";
            document: CreatedDocument;
        }>("/documents", input);

        return data.document;
    },

    getDocument: async (id: string): Promise<DocumentDetail> => {
        const { data } = await http.get<{
            status: "ok";
            document: DocumentDetail;
        }>(`/documents/${encodeURIComponent(id)}`);

        return data.document;
    },

    saveDocument: async (
        id: string,
        payload: { content: string; title: string }
    ): Promise<SaveResult> => {
        const { data } = await http.put<{
            status: "ok";
            document: SaveResult;
        }>(`/documents/${encodeURIComponent(id)}`, payload);

        return data.document;
    },
};

const responseFailed = (action: string): string =>
    `The server response did not include the expected fields for ${action}`;
