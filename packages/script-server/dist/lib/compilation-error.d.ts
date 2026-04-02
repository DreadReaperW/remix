type ScriptServerCompilationErrorCode = 'MODULE_NOT_FOUND' | 'MODULE_NOT_ALLOWED' | 'MODULE_OUTSIDE_ROUTES' | 'MODULE_COMMONJS_NOT_SUPPORTED' | 'MODULE_TRANSFORM_FAILED' | 'MODULE_EMIT_FAILED' | 'IMPORT_RESOLUTION_FAILED' | 'IMPORT_NOT_SUPPORTED' | 'IMPORT_NOT_ALLOWED';
/**
 * Internal error used by the request-time module compilation pipeline.
 */
export declare class ScriptServerCompilationError extends Error {
    code: ScriptServerCompilationErrorCode;
    constructor(message: string, options: {
        cause?: unknown;
        code: ScriptServerCompilationErrorCode;
    });
}
/**
 * Returns true when a value is a `ScriptServerCompilationError`.
 *
 * @param error Value thrown by the compilation pipeline.
 * @returns Whether the value is a `ScriptServerCompilationError`.
 */
export declare function isScriptServerCompilationError(error: unknown): error is ScriptServerCompilationError;
/**
 * Creates a `ScriptServerCompilationError` with a stable internal code.
 *
 * @param message Human-readable error message.
 * @param options Structured internal error details.
 * @param options.cause Original error cause, when available.
 * @param options.code Stable internal compilation error code.
 * @returns A `ScriptServerCompilationError`.
 */
export declare function createScriptServerCompilationError(message: string, options: {
    cause?: unknown;
    code: ScriptServerCompilationErrorCode;
}): ScriptServerCompilationError;
export {};
//# sourceMappingURL=compilation-error.d.ts.map