export class ApiError extends Error {
    readonly status: number;
    readonly details?: unknown;

    constructor(status: number, message: string, details?: unknown) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.details = details;
    }

    static badRequest = (message: string, details?: unknown) => {
        return new ApiError(400, message, details);
    };

    static unauthorized = (message = "Authentication required") => {
        return new ApiError(401, message);
    };

    static forbidden = (message = "You do not have access to this resource") => {
        return new ApiError(403, message);
    };

    static notFound = (message = "Resource not found") => {
        return new ApiError(404, message);
    };

    static conflict = (message: string) => {
        return new ApiError(409, message);
    };
}
