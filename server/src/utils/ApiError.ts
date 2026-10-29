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
        new ApiError(400, message, details);
    };

    static unauthorized = (message = "Authentication required") => {
        new ApiError(401, message);
    };

    static forbidden = (message = "You do not have access to this resource") => {
        new ApiError(403, message);
    };

    static notFound = (message = "Resource not found") => {
        new ApiError(404, message);
    };

    static conflict = (message: string) => {
        new ApiError(409, message);
    };
}
