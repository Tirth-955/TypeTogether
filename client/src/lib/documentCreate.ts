import toast from "react-hot-toast";
import type { NavigateFunction } from "react-router-dom";

import { api, getApiErrorMessage } from "./api";

export const createDocumentAndOpen = async (navigate: NavigateFunction): Promise<void> => {
    try {
        const created = await api.createDocument({ title: "Untitled document" });
        navigate(`/d/${created.id}`);
    } catch (err) {
        toast.error(getApiErrorMessage(err));
    }
};
