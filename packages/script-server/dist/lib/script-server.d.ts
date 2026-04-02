import type { ScriptRouteDefinition } from './routes.ts';
interface ScriptServerWatchOptions {
    /**
     * Ignore matching file paths.
     */
    ignore?: readonly string[];
    /**
     * Use polling instead of native filesystem events. Defaults to `false`.
     */
    poll?: boolean;
    /**
     * Polling interval in milliseconds when `poll` is enabled. Defaults to `100`.
     */
    pollInterval?: number;
}
interface ScriptServerFingerprintOptions {
    /**
     * Per-build invalidation token that must change whenever fingerprinted module URLs
     * should be invalidated together.
     */
    buildId: string;
}
declare const scriptServerTargets: readonly ["es2015", "es2016", "es2017", "es2018", "es2019", "es2020", "es2021", "es2022", "es2023", "es2024", "es2025", "es2026", "esnext"];
export type ScriptServerTarget = (typeof scriptServerTargets)[number];
export interface ScriptServerOptions {
    /** Routes that map public URL patterns to file-space patterns. */
    routes: ReadonlyArray<ScriptRouteDefinition>;
    /**
     * Root directory used to resolve relative file-space patterns. Defaults to `process.cwd()`.
     */
    root?: string;
    /**
     * File-space allow-list paths or filesystem glob patterns. Relative values are resolved from `root`.
     */
    allow: readonly string[];
    /**
     * File-space deny-list paths or filesystem glob patterns. Relative values are resolved from `root`.
     */
    deny?: readonly string[];
    /**
     * Source map mode (disabled when omitted).
     * - `'external'`: serve source maps as separate `.map` files; adds `//# sourceMappingURL=` comment
     * - `'inline'`: embed source maps as a base64 data URL directly in the JS; no separate `.map` file
     */
    sourceMaps?: 'inline' | 'external';
    /**
     * Controls the source paths written into source map `sources`.
     * - `'url'` (default): use the stable server path (e.g. `'/scripts/app/entry.ts'`)
     * - `'absolute'`: use the original filesystem path on disk
     */
    sourceMapSourcePaths?: 'url' | 'absolute';
    /**
     * Controls optional source-based URL fingerprinting for rewritten import URLs.
     *
     * When omitted, all served modules use stable non-fingerprinted URLs with `Cache-Control: no-cache`.
     * Cannot be used together with `watch`.
     */
    fingerprint?: ScriptServerFingerprintOptions;
    /**
     * Minify emitted modules.
     */
    minify?: boolean;
    /**
     * Replace global expressions with constant values during transform, e.g.
     * `{ 'process.env.NODE_ENV': '"production"' }`
     */
    define?: Record<string, string>;
    /**
     * Lower emitted syntax to a specific ECMAScript target. Omit this option to preserve
     * modern syntax unless project configuration already requests a lower target.
     */
    target?: ScriptServerTarget;
    /** Import specifiers to leave unrewritten (CDN URLs, import map entries, etc.) */
    external?: string[];
    /**
     * Enable filesystem-backed cache invalidation for long-lived server instances.
     * Pass `true` to use the default watcher options, or an options object to
     * customize the watcher behavior.
     */
    watch?: boolean | ScriptServerWatchOptions;
    /**
     * Handles unexpected request-time compilation errors. Return a `Response` to override the
     * default `500 Internal Server Error` response, or return nothing to use the default.
     */
    onError?: (error: unknown) => void | Response | Promise<void | Response>;
}
export interface ScriptServer {
    /**
     * Serves a script request. Returns `Response | null` — null means the request was not
     * handled by this server, letting the router fall through to a 404.
     */
    fetch(request: Request): Promise<Response | null>;
    /**
     * Returns the request href for a served module file.
     */
    getHref(filePath: string): Promise<string>;
    /**
     * Returns preload URLs for one or more served module files, ordered shallowest-first.
     */
    getPreloads(filePath: string | readonly string[]): Promise<string[]>;
    /**
     * Closes any watcher resources owned by this server instance.
     */
    close(): Promise<void>;
}
export declare function getInternalScriptServerWatchedDirectories(scriptServer: ScriptServer): string[];
export declare function waitForInternalScriptServerWatcher(scriptServer: ScriptServer): Promise<void>;
/**
 * Create the server-side scripts server.
 *
 * Compiles TypeScript/JavaScript modules on demand with optional source-based URL
 * fingerprinting, caching, and configurable route mapping.
 *
 * @param options Server configuration
 * @returns A {@link ScriptServer} with `fetch()`, `getHref()`, and `getPreloads()` methods
 *
 * @example
 * ```ts
 * let scriptServer = createScriptServer({
 *   routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
 *   allow: ['app/**'],
 * })
 *
 * route('/scripts/*path', ({ request }) => scriptServer.fetch(request))
 * ```
 */
export declare function createScriptServer(options: ScriptServerOptions): ScriptServer;
export {};
//# sourceMappingURL=script-server.d.ts.map