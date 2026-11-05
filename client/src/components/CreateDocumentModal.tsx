import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { api, getApiErrorMessage, type CreatedDocument } from "../lib/api";

type Props = {
    onClose: () => void;
    onCreated: (document: CreatedDocument) => void;
};

export const CreateDocumentModal = ({ onClose, onCreated }: Props) => {
    const navigate = useNavigate();

    const [created, setCreated] = useState<CreatedDocument | null>(null);
    const [copied, setCopied] = useState(false);

    const [title, setTitle] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();

        setSubmitting(true);
        setError(null);

        try {
            const document = await api.createDocument({
                title,
                docType: "text",
            });

            setCreated(document);
            onCreated(document);
        } catch (err) {
            setError(getApiErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    const copyShareLink = async () => {
        const url = `${window.location.origin}${created?.shareUrl ?? ""}`;

        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
        } catch {
            setError("Copying failed — select the link manually");
        }
    };

    if (created) {
        return (
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
                onClick={onClose}
            >
                <div
                    className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg"
                    onClick={(event) => event.stopPropagation()}
                >
                    <h2 className="text-lg font-semibold">Share this document</h2>
                    <p className="mt-2 text-sm text-gray-500">
                        Anyone with this link can edit it live for the next 24 hours. Saving (once
                        logged in) makes the link permanent.
                    </p>

                    <div className="mt-4 flex gap-2">
                        <input
                            type="text"
                            readOnly
                            value={`${window.location.origin}${created.shareUrl}`}
                            onFocus={(event) => event.target.select()}
                            className="min-w-0 flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
                        />
                        <button
                            type="button"
                            onClick={() => void copyShareLink()}
                            className="shrink-0 rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                        >
                            {copied ? "Copied!" : "Copy"}
                        </button>
                    </div>

                    {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

                    <div className="mt-4 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100"
                        >
                            Close
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                navigate(`/d/${created.id}`);
                                onClose();
                            }}
                            className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                        >
                            Open document
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg"
                onClick={(event) => event.stopPropagation()}
            >
                <h2 className="text-lg font-semibold">New document</h2>

                <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
                    <input
                        type="text"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Title"
                        maxLength={120}
                        required
                        autoFocus
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    {error && <p className="text-sm text-red-600">{error}</p>}

                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                            {submitting ? "Creating…" : "Create"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
