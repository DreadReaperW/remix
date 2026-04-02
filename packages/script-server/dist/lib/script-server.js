import * as path from 'node:path';
import * as fs from 'node:fs';
import { isScriptServerCompilationError } from "./compilation-error.js";
import { createAccessPolicy } from "./access.js";
import { createModuleCompiler, createResponseForModule } from "./compiler.js";
import { normalizeFilePath } from "./paths.js";
import { compileRoutes } from "./routes.js";
import { createScriptServerWatcher } from "./watch.js";
const scriptServerTargets = [
    'es2015',
    'es2016',
    'es2017',
    'es2018',
    'es2019',
    'es2020',
    'es2021',
    'es2022',
    'es2023',
    'es2024',
    'es2025',
    'es2026',
    'esnext',
];
const scriptServerTargetSet = new Set(scriptServerTargets);
const internalStateByScriptServer = new WeakMap();
// Internal-only test hook. This is intentionally not re-exported from the package entrypoint.
export function getInternalScriptServerWatchedDirectories(scriptServer) {
    return internalStateByScriptServer.get(scriptServer)?.watcher?.getWatchedDirectories() ?? [];
}
// Internal-only test hook. This is intentionally not re-exported from the package entrypoint.
export function waitForInternalScriptServerWatcher(scriptServer) {
    return internalStateByScriptServer.get(scriptServer)?.watcher?.whenReady() ?? Promise.resolve();
}
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
export function createScriptServer(options) {
    let resolvedOptions = resolveScriptServerOptions(options);
    let accessPolicy = createAccessPolicy({
        allow: resolvedOptions.allow,
        deny: resolvedOptions.deny,
        root: resolvedOptions.root,
    });
    let moduleCompiler = createModuleCompiler({
        buildId: resolvedOptions.buildId,
        define: resolvedOptions.define,
        external: resolvedOptions.external,
        fingerprintModules: resolvedOptions.fingerprintModules,
        isAllowed: accessPolicy.isAllowed,
        minify: resolvedOptions.minify,
        root: resolvedOptions.root,
        routes: resolvedOptions.routes,
        sourceMapSourcePaths: resolvedOptions.sourceMapSourcePaths,
        sourceMaps: resolvedOptions.sourceMaps,
        target: resolvedOptions.target,
    });
    let watcher = resolvedOptions.watchOptions
        ? createScriptServerWatcher({
            ...resolvedOptions.watchOptions,
            onFileEvent: handleWatchEvent,
            root: resolvedOptions.root,
            routes: resolvedOptions.routeDefinitions,
        })
        : null;
    async function responseForError(error) {
        try {
            return (await resolvedOptions.onError(error)) ?? internalServerError();
        }
        catch (error) {
            console.error(`There was an error in the script server error handler: ${error}`);
            return internalServerError();
        }
    }
    async function handleWatchEvent(filePath, event) {
        try {
            await moduleCompiler.handleFileEvent(filePath, event);
        }
        catch (error) {
            console.error(`There was an error invalidating the script server cache: ${error}`);
        }
    }
    let scriptServer = {
        async fetch(request) {
            if (request.method !== 'GET' && request.method !== 'HEAD')
                return null;
            let parsedRequestPathname = moduleCompiler.parseRequestPathname(new URL(request.url).pathname);
            if (!parsedRequestPathname)
                return null;
            try {
                let ifNoneMatch = request.headers.get('If-None-Match');
                let compiledModule = await moduleCompiler.compileModule(parsedRequestPathname.filePath);
                if (parsedRequestPathname.requestedFingerprint !== null) {
                    if (compiledModule.fingerprint !== parsedRequestPathname.requestedFingerprint)
                        return null;
                }
                return createResponseForModule(compiledModule, {
                    cacheControl: parsedRequestPathname.cacheControl,
                    ifNoneMatch,
                    isSourceMapRequest: parsedRequestPathname.isSourceMapRequest,
                    method: request.method,
                });
            }
            catch (error) {
                // A direct request can race with the filesystem or fail a deeper allow check while
                // compiling imports. In this fetch context, both cases should fall through as "not
                // handled here" so the outer router can continue to its own 404 behavior.
                if (isScriptServerCompilationError(error) &&
                    (error.code === 'MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_ALLOWED')) {
                    return null;
                }
                return responseForError(error);
            }
        },
        async getHref(filePath) {
            return moduleCompiler.getHref(filePath);
        },
        async getPreloads(filePath) {
            return moduleCompiler.getPreloadUrls(filePath);
        },
        async close() {
            await watcher?.close();
        },
    };
    internalStateByScriptServer.set(scriptServer, {
        watcher,
    });
    return scriptServer;
}
function internalServerError() {
    return new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
}
function defaultErrorHandler(error) {
    console.error(error);
}
function resolveScriptServerOptions(options) {
    let root = normalizeFilePath(fs.realpathSync(path.resolve(options.root ?? process.cwd())));
    let fingerprintOptions = normalizeFingerprintOptions({
        fingerprint: options.fingerprint,
        watch: options.watch,
    });
    return {
        allow: options.allow,
        buildId: fingerprintOptions.buildId,
        define: options.define,
        deny: options.deny,
        external: options.external ?? [],
        fingerprintModules: fingerprintOptions.enabled,
        minify: options.minify ?? false,
        onError: options.onError ?? defaultErrorHandler,
        root,
        routeDefinitions: options.routes,
        routes: compileRoutes({
            root,
            routes: options.routes,
        }),
        sourceMapSourcePaths: options.sourceMapSourcePaths ?? 'url',
        sourceMaps: options.sourceMaps,
        target: normalizeTarget(options.target),
        watchOptions: normalizeWatchOptions(options.watch),
    };
}
function normalizeTarget(target) {
    if (target == null)
        return undefined;
    if (typeof target !== 'string' || !scriptServerTargetSet.has(target)) {
        throw new TypeError(`Expected target to be one of ${scriptServerTargets.map((value) => `"${value}"`).join(', ')}. Received "${target}".`);
    }
    return target;
}
function normalizeFingerprintOptions(options) {
    if (!options.fingerprint) {
        return {
            enabled: false,
        };
    }
    if (typeof options.fingerprint.buildId !== 'string') {
        throw new TypeError('fingerprint.buildId must be a string');
    }
    if (options.fingerprint.buildId.length === 0) {
        throw new TypeError('fingerprint.buildId must be a non-empty string');
    }
    if (options.watch) {
        throw new TypeError('fingerprint cannot be used with watch mode');
    }
    return {
        enabled: true,
        buildId: options.fingerprint.buildId,
    };
}
function normalizeWatchOptions(options) {
    if (!options)
        return null;
    return options === true ? {} : options;
}
