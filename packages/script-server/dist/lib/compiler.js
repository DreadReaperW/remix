import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IfNoneMatch } from '@remix-run/headers';
import { createScriptServerCompilationError } from "./compilation-error.js";
import { formatFingerprintedPathname, getFingerprintRequestCacheControl, parseFingerprintSuffix, } from "./fingerprint.js";
import { emitResolvedModule } from "./emit.js";
import { normalizeFilePath, resolveFilePath } from "./paths.js";
import { resolveModule, resolverExtensionAlias, resolverExtensions, supportedScriptExtensions, } from "./resolve.js";
import { createModuleStore } from "./store.js";
import { createTsconfigTransformOptionsResolver, transformModule } from "./transform.js";
import { ResolverFactory } from 'oxc-resolver';
const supportedScriptExtensionSet = new Set(supportedScriptExtensions);
const preloadConcurrency = Math.max(1, Math.min(8, os.availableParallelism() - 1));
export function createModuleCompiler(options) {
    let resolvedOptions = {
        ...options,
        externalSet: new Set(options.external),
    };
    let store = createModuleStore();
    let tsconfigTransformOptionsResolver = createTsconfigTransformOptionsResolver();
    let resolverFactory = new ResolverFactory({
        aliasFields: [['browser']],
        conditionNames: ['browser', 'import', 'module', 'default'],
        extensionAlias: resolverExtensionAlias,
        extensions: resolverExtensions,
        mainFields: ['browser', 'module', 'main'],
        tsconfig: 'auto',
    });
    let resolveInFlightByIdentityPath = new Map();
    let emitInFlightByIdentityPath = new Map();
    let transformArgs = {
        buildId: resolvedOptions.buildId ?? null,
        define: resolvedOptions.define ?? null,
        externalSet: resolvedOptions.externalSet,
        minify: resolvedOptions.minify,
        resolveActualPath,
        routes: resolvedOptions.routes,
        sourceMapSourcePaths: resolvedOptions.sourceMapSourcePaths,
        sourceMaps: resolvedOptions.sourceMaps ?? null,
        target: resolvedOptions.target ?? null,
        tsconfigTransformOptionsResolver,
    };
    let resolveArgs = {
        isAllowed: resolvedOptions.isAllowed,
        resolveModulePath,
        resolverFactory,
        routes: resolvedOptions.routes,
    };
    return {
        async compileModule(filePath) {
            let resolvedModule = resolveServedModuleOrThrow(resolveInputFilePath(filePath));
            let record = store.get(resolvedModule.identityPath);
            let emitted = await getOrCreateEmittedModule(record);
            return toModuleCompileResult(emitted);
        },
        async getPreloadUrls(filePath) {
            let resolvedEntries = [];
            let seen = new Set();
            for (let resolvedModule of (Array.isArray(filePath) ? filePath : [filePath]).map((nextPath) => resolveServedModuleOrThrow(resolveInputFilePath(nextPath)))) {
                if (seen.has(resolvedModule.identityPath))
                    continue;
                seen.add(resolvedModule.identityPath);
                resolvedEntries.push(resolvedModule.identityPath);
            }
            let visited = new Set(resolvedEntries);
            let queue = [...resolvedEntries];
            let urls = [];
            while (queue.length > 0) {
                let frontier = queue;
                queue = [];
                let resolvedModules = await getOrCreateResolvedModules(frontier.map((identityPath) => store.get(identityPath)));
                for (let resolvedModule of resolvedModules) {
                    urls.push(getServedUrlForResolvedModule(resolvedModule));
                    for (let dep of resolvedModule.deps) {
                        if (visited.has(dep))
                            continue;
                        visited.add(dep);
                        queue.push(dep);
                    }
                }
            }
            return urls;
        },
        async getHref(filePath) {
            let resolvedModule = resolveServedModuleOrThrow(resolveInputFilePath(filePath));
            return getServedUrl(resolvedModule.identityPath);
        },
        async handleFileEvent(filePath, event) {
            let normalizedFilePath = normalizeFilePath(filePath);
            resolverFactory.clearCache();
            if (isTsconfigPath(normalizedFilePath)) {
                tsconfigTransformOptionsResolver.clear();
                store.invalidateAll();
                return;
            }
            if (isPackageJsonPath(normalizedFilePath)) {
                store.invalidateAll();
                return;
            }
            store.invalidateForFileEvent(normalizedFilePath, toStoreWatchEvent(event));
        },
        parseRequestPathname(pathname) {
            let parsedPathname = parseServedPathname(pathname);
            let filePath = resolvedOptions.routes.resolveUrlPathname(parsedPathname.stablePathname);
            if (!filePath)
                return null;
            if (resolvedOptions.fingerprintModules && parsedPathname.requestedFingerprint === null)
                return null;
            return {
                cacheControl: getFingerprintRequestCacheControl(parsedPathname.requestedFingerprint),
                filePath,
                isSourceMapRequest: parsedPathname.isSourceMapRequest,
                requestedFingerprint: parsedPathname.requestedFingerprint,
            };
        },
    };
    function resolveInputFilePath(filePath) {
        if (filePath.startsWith('file://')) {
            return normalizeFilePath(fileURLToPath(new URL(filePath)));
        }
        if (filePath.includes('://')) {
            throw new TypeError(`Expected a file path or file:// URL, received "${filePath}"`);
        }
        return resolveFilePath(resolvedOptions.root, filePath);
    }
    function resolveServedModuleOrThrow(absolutePath) {
        let resolvedModule = resolveModulePath(absolutePath);
        if (!resolvedModule) {
            throw createScriptServerCompilationError(`Module not found: ${absolutePath}`, {
                code: 'MODULE_NOT_FOUND',
            });
        }
        if (!resolvedOptions.isAllowed(resolvedModule.identityPath)) {
            throw createScriptServerCompilationError(`Module is not allowed: ${resolvedModule.identityPath}`, {
                code: 'MODULE_NOT_ALLOWED',
            });
        }
        return resolvedModule;
    }
    async function getOrCreateResolvedModules(records) {
        return mapWithConcurrency(records, preloadConcurrency, (record) => getOrCreateResolvedModule(record));
    }
    async function getOrCreateResolvedModule(record) {
        if (record.resolved)
            return record.resolved;
        let existing = resolveInFlightByIdentityPath.get(record.identityPath);
        if (existing)
            return existing;
        let promise = (async () => {
            let startedAt = Date.now();
            let transformedModule = await getOrCreateTransformedModule(record);
            let resolveModuleResult = await resolveModule(record, transformedModule, resolveArgs);
            if (!resolveModuleResult.ok) {
                if (startedAt >= record.lastInvalidatedAt) {
                    store.setResolveFailure(record.identityPath, resolveModuleResult.tracking);
                }
                throw resolveModuleResult.error;
            }
            if (startedAt >= record.lastInvalidatedAt) {
                store.setResolved(record.identityPath, resolveModuleResult.value);
            }
            return resolveModuleResult.value;
        })();
        resolveInFlightByIdentityPath.set(record.identityPath, promise);
        try {
            return await promise;
        }
        finally {
            if (resolveInFlightByIdentityPath.get(record.identityPath) === promise) {
                resolveInFlightByIdentityPath.delete(record.identityPath);
            }
        }
    }
    async function getOrCreateTransformedModule(record) {
        if (record.transformed)
            return record.transformed;
        let startedAt = Date.now();
        let transformModuleResult = await transformModule(record, transformArgs);
        if (!transformModuleResult.ok) {
            if (startedAt >= record.lastInvalidatedAt) {
                store.setTransformFailure(record.identityPath, {
                    trackedFiles: transformModuleResult.trackedFiles,
                });
            }
            throw transformModuleResult.error;
        }
        if (startedAt >= record.lastInvalidatedAt) {
            store.setTransformed(record.identityPath, transformModuleResult.value);
        }
        return transformModuleResult.value;
    }
    async function getOrCreateEmittedModule(record) {
        if (record.emitted)
            return record.emitted;
        let existing = emitInFlightByIdentityPath.get(record.identityPath);
        if (existing)
            return existing;
        let promise = (async () => {
            let startedAt = Date.now();
            let resolvedModule = await getOrCreateResolvedModule(record);
            let emitResolvedModuleResult = await emitResolvedModule(resolvedModule, {
                getServedUrl,
                sourceMaps: resolvedOptions.sourceMaps,
            });
            if (!emitResolvedModuleResult.ok) {
                throw emitResolvedModuleResult.error;
            }
            if (startedAt >= record.lastInvalidatedAt) {
                store.setEmitted(record.identityPath, emitResolvedModuleResult.value);
            }
            return emitResolvedModuleResult.value;
        })();
        emitInFlightByIdentityPath.set(record.identityPath, promise);
        try {
            return await promise;
        }
        finally {
            if (emitInFlightByIdentityPath.get(record.identityPath) === promise) {
                emitInFlightByIdentityPath.delete(record.identityPath);
            }
        }
    }
    async function getServedUrl(identityPath) {
        return getServedUrlForResolvedModule(await getOrCreateResolvedModule(store.get(identityPath)));
    }
    function getServedUrlForResolvedModule(resolvedModule) {
        return formatFingerprintedPathname(resolvedModule.stableUrlPathname, resolvedOptions.fingerprintModules ? resolvedModule.fingerprint : null);
    }
}
function parseServedPathname(pathname) {
    let isSourceMapRequest = pathname.endsWith('.map');
    let pathWithoutMap = isSourceMapRequest ? pathname.slice(0, -4) : pathname;
    let fingerprint = parseFingerprintSuffix(pathWithoutMap);
    return {
        isSourceMapRequest,
        requestedFingerprint: fingerprint.requestedFingerprint,
        stablePathname: fingerprint.pathname,
    };
}
async function mapWithConcurrency(items, concurrency, mapper) {
    if (items.length === 0)
        return [];
    let results = new Array(items.length);
    let nextIndex = 0;
    async function worker() {
        while (nextIndex < items.length) {
            let index = nextIndex++;
            results[index] = await mapper(items[index], index);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
    return results;
}
function toModuleCompileResult(emittedModule) {
    return {
        code: emittedModule.code,
        fingerprint: emittedModule.fingerprint,
        sourceMap: emittedModule.sourceMap,
    };
}
function toStoreWatchEvent(event) {
    if (event === 'unlink')
        return 'delete';
    return event;
}
function resolveModulePath(absolutePath) {
    let resolvedPath;
    try {
        resolvedPath = normalizeFilePath(fs.realpathSync(normalizeFilePath(absolutePath)));
    }
    catch (error) {
        if (isNoEntityError(error))
            return null;
        throw error;
    }
    if (!supportedScriptExtensionSet.has(path.extname(resolvedPath).toLowerCase())) {
        return null;
    }
    return {
        identityPath: resolvedPath,
        resolvedPath,
    };
}
function resolveActualPath(identityPath) {
    try {
        return normalizeFilePath(fs.realpathSync(identityPath));
    }
    catch (error) {
        if (isNoEntityError(error))
            return null;
        throw error;
    }
}
function isPackageJsonPath(filePath) {
    return path.posix.basename(filePath) === 'package.json';
}
function isTsconfigPath(filePath) {
    return /^tsconfig(?:\..+)?\.json$/.test(path.posix.basename(filePath));
}
function isNoEntityError(error) {
    return (error instanceof Error && 'code' in error && error.code === 'ENOENT');
}
export function createResponseForModule(result, options) {
    let body;
    let etag;
    let contentType;
    if (options.isSourceMapRequest) {
        if (!result.sourceMap) {
            return new Response('Not found', { status: 404 });
        }
        body = options.method === 'HEAD' ? null : result.sourceMap.content;
        etag = result.sourceMap.etag;
        contentType = 'application/json; charset=utf-8';
    }
    else {
        body = options.method === 'HEAD' ? null : result.code.content;
        etag = result.code.etag;
        contentType = 'application/javascript; charset=utf-8';
    }
    if (IfNoneMatch.from(options.ifNoneMatch).matches(etag)) {
        return new Response(null, { status: 304, headers: { ETag: etag } });
    }
    return new Response(body, {
        headers: {
            'Cache-Control': options.cacheControl,
            'Content-Type': contentType,
            ETag: etag,
        },
    });
}
