/**
 * Internal error used by the request-time module compilation pipeline.
 */
export class ScriptServerCompilationError extends Error {
    code;
    constructor(message, options) {
        super(message, options.cause === undefined ? undefined : { cause: options.cause });
        this.name = 'ScriptServerCompilationError';
        this.code = options.code;
    }
}
/**
 * Returns true when a value is a `ScriptServerCompilationError`.
 *
 * @param error Value thrown by the compilation pipeline.
 * @returns Whether the value is a `ScriptServerCompilationError`.
 */
export function isScriptServerCompilationError(error) {
    return error instanceof ScriptServerCompilationError;
}
/**
 * Creates a `ScriptServerCompilationError` with a stable internal code.
 *
 * @param message Human-readable error message.
 * @param options Structured internal error details.
 * @param options.cause Original error cause, when available.
 * @param options.code Stable internal compilation error code.
 * @returns A `ScriptServerCompilationError`.
 */
export function createScriptServerCompilationError(message, options) {
    return new ScriptServerCompilationError(message, options);
}
