import type { RequestContext } from '@remix-run/fetch-router';
import { Session } from '@remix-run/session';
import type { AuthFailure, AuthScheme } from '../auth.ts';
type ResolvedMethod<name, fallback extends string> = Extract<name, string> extends never ? fallback : Extract<name, string>;
/**
 * Options for creating a session-backed auth scheme.
 */
export interface SessionAuthSchemeOptions<identity, session_value = unknown, method extends string = 'session'> {
    /** Method name exposed on the resolved auth state. */
    name?: method;
    /** Reads the auth value persisted in the session for the current request. */
    read(session: Session, context: RequestContext): session_value | null | undefined;
    /** Verifies the session auth value and returns the resolved identity on success. */
    verify(value: session_value, context: RequestContext): identity | null | Promise<identity | null>;
    /** Clears stale or invalid session auth state after verification fails. */
    invalidate?(session: Session, context: RequestContext): void | Promise<void>;
    /** Failure code reported when `verify()` rejects the session auth value. */
    code?: AuthFailure['code'];
    /** Failure message reported when `verify()` rejects the session auth value. */
    message?: string;
}
/**
 * Creates an auth scheme that resolves identity from session data loaded by `session()`.
 *
 * @param options Session reading, verification, and invalidation hooks.
 * @returns An auth scheme for use with `auth()`.
 */
export declare function createSessionAuthScheme<identity, session_value = unknown, method extends string = 'session'>(options: SessionAuthSchemeOptions<identity, session_value, method>): AuthScheme<identity, ResolvedMethod<method, 'session'>>;
export {};
//# sourceMappingURL=session.d.ts.map