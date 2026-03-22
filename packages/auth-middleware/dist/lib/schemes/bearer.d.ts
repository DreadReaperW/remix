import type { RequestContext } from '@remix-run/fetch-router';
import type { AuthScheme } from '../auth.ts';
type ResolvedMethod<name, fallback extends string> = Extract<name, string> extends never ? fallback : Extract<name, string>;
type InferIdentity<verify extends (token: string, context: RequestContext) => unknown> = Exclude<Awaited<ReturnType<verify>>, null>;
/**
 * Options for creating a bearer-token auth scheme.
 */
export interface BearerTokenAuthSchemeOptions<identity, method extends string = 'bearer'> {
    /** Method name exposed on the resolved auth state. */
    name?: method;
    /** Request header that carries the bearer token. */
    headerName?: string;
    /** Authorization scheme prefix expected in the header value. */
    scheme?: string;
    /** Verifies a parsed bearer token and returns the resolved identity on success. */
    verify(token: string, context: RequestContext): identity | null | Promise<identity | null>;
    /** Challenge value returned when the scheme rejects credentials. */
    challenge?: string;
}
/**
 * Creates an auth scheme that reads bearer tokens from a request header.
 *
 * @param options Header parsing and token verification options.
 * @returns An auth scheme for use with `auth()`.
 */
export declare function createBearerTokenAuthScheme<options extends {
    name?: string;
    headerName?: string;
    scheme?: string;
    challenge?: string;
    verify: (token: string, context: RequestContext) => unknown;
}>(options: options): AuthScheme<InferIdentity<options['verify']>, ResolvedMethod<options['name'], 'bearer'>>;
export {};
//# sourceMappingURL=bearer.d.ts.map