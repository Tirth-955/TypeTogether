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
            // Plain text only: the API takes just a title.
            const document = await api.createDocument({
                title,
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
                    className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-lg"
                    onClick={(event) => event.stopPropagation()}
                >
                    <h2 className="text-lg font-semibold text-text">Share this document</h2>
                    <p className="mt-2 text-sm text-muted">
                        Anyone with this link can edit it live for the next 24 hours. Saving (once
                        logged in) makes the link permanent.
                    </p>

                    <div className="mt-4 flex gap-2">
                        <input
                            type="text"
                            readOnly
                            value={`${window.location.origin}${created.shareUrl}`}
                            onFocus={(event) => event.target.select()}
                            className="min-w-0 flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm text-muted"
                        />
                        <button
                            type="button"
                            onClick={() => void copyShareLink()}
                            className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm text-white hover:bg-primary-hover"
                        >
                            {copied ? "Copied!" : "Copy"}
                        </button>
                    </div>

                    {error && <p className="mt-2 text-sm text-danger">{error}</p>}

                    <div className="mt-4 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-md border border-border px-3 py-2 text-sm text-muted hover:bg-surface-hover hover:text-text"
                        >
                            Close
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                navigate(`/d/${created.id}`);
                                onClose();
                            }}
                            className="rounded-md bg-primary px-3 py-2 text-sm text-white hover:bg-primary-hover"
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
                className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-lg"
                onClick={(event) => event.stopPropagation()}
            >
                <h2 className="text-lg font-semibold text-text">New document</h2>

                <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
                    <input
                        type="text"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Title"
                        maxLength={120}
                        required
                        autoFocus
                        className="rounded-md border border-border bg-bg px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />

                    {error && <p className="text-sm text-danger">{error}</p>}

                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-md border border-border px-3 py-2 text-sm text-muted hover:bg-surface-hover hover:text-text"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="rounded-md bg-primary px-3 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-60"
                        >
                            {submitting ? "Creating…" : "Create"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
