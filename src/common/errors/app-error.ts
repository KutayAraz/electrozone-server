import { ErrorType } from "./error-type";

export class AppError extends Error {
    constructor(
        public type: ErrorType,
        public entityId?: number,
        public entityName?: string
    ) {
        super(type);
        this.name = 'AppError';
    }
}