import * as fs from 'node:fs';
import * as path from 'node:path';
import { createScriptServerCompilationError, isScriptServerCompilationError, } from "./compilation-error.js";
import { normalizeFilePath } from "./paths.js";
export const resolverExtensionAlias = {
    '.js': ['.js', '.ts', '.tsx', '.jsx'],
    '.jsx': ['.jsx', '.tsx'],
    '.mjs': ['.mjs', '.mts'],
};
export const resolverExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs'];
export const supportedScriptExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs'];
const supportedScriptExtensionSet = new Set(supportedScriptExtensions);
export async function resolveModule(record, transformed, args) {
    let trackedFiles = new Set(transformed.trackedFiles);
    let trackedResolutions = [];
    let resolvedImports;
    try {
        resolvedImports =
            transformed.unresolvedImports.length > 0
                ? await batchResolveSpecifiers(getUniqueSpecifiers(transformed.unresolvedImports), transformed.resolvedPath, args.resolverFactory)
                : new Map();
    }
    catch (error) {
        return failResolve(error, trackedFiles, trackedResolutions, transformed.resolvedPath);
    }
    let importsWithPaths = [];
    let deps = new Set();
    for (let unresolved of transformed.unresolvedImports) {
        let trackedResolution = getTrackedRelativeImportResolution(transformed.importerDir, unresolved.specifier);
        let resolvedSpec = resolvedImports.get(unresolved.specifier);
        if (!resolvedSpec?.absolutePath) {
            return failResolve(createScriptServerCompilationError(`Failed to resolve import "${unresolved.specifier}" in ${transformed.resolvedPath}. ` +
                `Ensure it resolves to a file within the configured script-server routes, or mark it as external.`, {
                code: 'IMPORT_RESOLUTION_FAILED',
            }), trackedFiles, trackedResolutions, transformed.resolvedPath, trackedResolution);
        }
        let resolvedImport = args.resolveModulePath(resolvedSpec.absolutePath);
        if (!resolvedImport) {
            return failResolve(createScriptServerCompilationError(`Resolved import "${unresolved.specifier}" in ${transformed.resolvedPath} is not a supported script module. ` +
                `Supported extensions are ${supportedScriptExtensions.join(', ')}.`, {
                code: 'IMPORT_NOT_SUPPORTED',
            }), trackedFiles, trackedResolutions, transformed.resolvedPath, trackedResolution);
        }
        if (!args.isAllowed(resolvedImport.identityPath)) {
            return failResolve(createScriptServerCompilationError(`Resolved import "${unresolved.specifier}" in ${transformed.resolvedPath} points outside the script-server routing/allow configuration. ` +
                `Add a matching route and allow rule, or mark this import as external.`, {
                code: 'IMPORT_NOT_ALLOWED',
            }), trackedFiles, trackedResolutions, transformed.resolvedPath, trackedResolution);
        }
        let stableUrlPathname = args.routes.toUrlPathname(resolvedImport.identityPath);
        if (!stableUrlPathname) {
            return failResolve(createScriptServerCompilationError(`Resolved import "${unresolved.specifier}" in ${transformed.resolvedPath} points outside the script-server routing/allow configuration. ` +
                `Add a matching route and allow rule, or mark this import as external.`, {
                code: 'IMPORT_NOT_ALLOWED',
            }), trackedFiles, trackedResolutions, transformed.resolvedPath, trackedResolution);
        }
        deps.add(resolvedImport.identityPath);
        if (transformed.packageSpecifiers.includes(unresolved.specifier)) {
            let packageJsonPath = resolvedSpec.packageJsonPath ?? findNearestPackageJsonPath(resolvedImport.resolvedPath);
            if (packageJsonPath)
                trackedFiles.add(packageJsonPath);
        }
        if (trackedResolution) {
            trackedResolutions.push({
                ...trackedResolution,
                resolvedIdentityPath: resolvedImport.identityPath,
            });
        }
        importsWithPaths.push({
            depPath: resolvedImport.identityPath,
            end: unresolved.end,
            quote: unresolved.quote,
            start: unresolved.start,
        });
    }
    return {
        ok: true,
        value: {
            deps: [...deps],
            fingerprint: transformed.fingerprint,
            identityPath: record.identityPath,
            imports: importsWithPaths,
            trackedFiles: [...trackedFiles],
            trackedResolutions,
            rawCode: transformed.rawCode,
            resolvedPath: transformed.resolvedPath,
            sourceMap: transformed.sourceMap,
            stableUrlPathname: transformed.stableUrlPathname,
        },
    };
}
function findNearestPackageJsonPath(filePath) {
    let directory = path.dirname(filePath);
    while (true) {
        let packageJsonPath = path.join(directory, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            return normalizeFilePath(packageJsonPath);
        }
        let parentDirectory = path.dirname(directory);
        if (parentDirectory === directory)
            return null;
        directory = parentDirectory;
    }
}
function isRelativeImportSpecifier(specifier) {
    return specifier.startsWith('./') || specifier.startsWith('../');
}
function getTrackedRelativeImportResolution(importerDir, specifier) {
    if (!isRelativeImportSpecifier(specifier))
        return null;
    let candidatePath = resolveCandidateBasePath(importerDir, specifier);
    let extension = path.extname(specifier);
    if (extension === '') {
        return {
            candidatePaths: [
                candidatePath,
                ...supportedScriptExtensions.map((candidateExtension) => `${candidatePath}${candidateExtension}`),
            ],
            candidatePrefixes: [`${candidatePath}/`],
            specifier,
        };
    }
    let candidateExtensions = resolverExtensionAlias[extension];
    if (!candidateExtensions && !supportedScriptExtensionSet.has(extension)) {
        return {
            candidatePaths: [
                candidatePath,
                ...supportedScriptExtensions.map((candidateExtension) => `${candidatePath}${candidateExtension}`),
            ],
            candidatePrefixes: [`${candidatePath}/`],
            specifier,
        };
    }
    if (!candidateExtensions)
        return null;
    return {
        candidatePaths: [
            candidatePath,
            ...candidateExtensions.map((candidateExtension) => `${candidatePath.slice(0, candidatePath.length - extension.length)}${candidateExtension}`),
        ],
        candidatePrefixes: [`${candidatePath}/`],
        specifier,
    };
}
function resolveCandidateBasePath(importerDir, specifier) {
    return normalizeFilePath(path.resolve(importerDir, specifier));
}
async function batchResolveSpecifiers(specifiers, importerPath, resolverFactory) {
    let resolvedBySpecifier = new Map();
    if (specifiers.length === 0)
        return resolvedBySpecifier;
    try {
        for (let specifier of specifiers) {
            let resolutionResult = await resolverFactory.resolveFileAsync(importerPath, specifier);
            if (resolutionResult.error) {
                throw createScriptServerCompilationError(`Failed to resolve import "${specifier}" in ${importerPath}. ` +
                    `Ensure it resolves to a file within the configured script-server routes, or mark it as external.`, {
                    code: 'IMPORT_RESOLUTION_FAILED',
                });
            }
            resolvedBySpecifier.set(specifier, {
                absolutePath: resolutionResult.path && path.isAbsolute(resolutionResult.path)
                    ? normalizeFilePath(resolutionResult.path)
                    : null,
                packageJsonPath: resolutionResult.packageJsonPath
                    ? normalizeFilePath(resolutionResult.packageJsonPath)
                    : null,
                specifier,
            });
        }
    }
    catch (error) {
        if (isScriptServerCompilationError(error) && error.code === 'IMPORT_RESOLUTION_FAILED') {
            throw error;
        }
        throw createScriptServerCompilationError(`Failed to resolve imports in ${importerPath}. ${formatUnknownError(error)}`, {
            cause: error,
            code: 'IMPORT_RESOLUTION_FAILED',
        });
    }
    return resolvedBySpecifier;
}
function getUniqueSpecifiers(unresolvedImports) {
    return [...new Set(unresolvedImports.map((unresolved) => unresolved.specifier))];
}
function formatUnknownError(error) {
    return error instanceof Error ? error.message : String(error);
}
function failResolve(error, trackedFiles, trackedResolutions, importerPath, trackedResolution) {
    return {
        ok: false,
        error: toResolveError(error, importerPath),
        tracking: {
            trackedFiles: [...trackedFiles],
            trackedResolutions: appendFailedTrackedResolution(trackedResolutions, trackedResolution),
        },
    };
}
function appendFailedTrackedResolution(trackedResolutions, trackedResolution) {
    if (trackedResolution == null)
        return [...trackedResolutions];
    return [
        ...trackedResolutions,
        {
            ...trackedResolution,
            resolvedIdentityPath: null,
        },
    ];
}
function toResolveError(error, importerPath) {
    if (isScriptServerCompilationError(error))
        return error;
    return createScriptServerCompilationError(`Failed to resolve imports in ${importerPath}. ${formatUnknownError(error)}`, {
        cause: error,
        code: 'IMPORT_RESOLUTION_FAILED',
    });
}
