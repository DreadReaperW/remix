import type { CompiledRoutes } from './routes.ts';
import type { ScriptServerTarget } from './script-server.ts';
import type { EmittedAsset } from './emit.ts';
type ModuleCompileResult = {
    code: EmittedAsset;
    fingerprint: string | null;
    sourceMap: EmittedAsset | null;
};
type ModuleCompilerOptions = {
    buildId?: string;
    define?: Record<string, string>;
    external: string[];
    fingerprintModules: boolean;
    isAllowed(absolutePath: string): boolean;
    minify: boolean;
    root: string;
    routes: CompiledRoutes;
    sourceMapSourcePaths: 'absolute' | 'url';
    sourceMaps?: 'external' | 'inline';
    target?: ScriptServerTarget;
};
type ModuleWatchEvent = 'add' | 'change' | 'unlink';
type ModuleCompiler = {
    compileModule(filePath: string): Promise<ModuleCompileResult>;
    getPreloadUrls(filePath: string | readonly string[]): Promise<string[]>;
    getHref(filePath: string): Promise<string>;
    handleFileEvent(filePath: string, event: ModuleWatchEvent): Promise<void>;
    parseRequestPathname(pathname: string): ParsedRequestPathname | null;
};
type ParsedRequestPathname = {
    cacheControl: string;
    filePath: string;
    isSourceMapRequest: boolean;
    requestedFingerprint: string | null;
};
export declare function createModuleCompiler(options: ModuleCompilerOptions): ModuleCompiler;
export declare function createResponseForModule(result: ModuleCompileResult, options: {
    cacheControl: string;
    ifNoneMatch: string | null;
    isSourceMapRequest: boolean;
    method: string;
}): Response;
export {};
//# sourceMappingURL=compiler.d.ts.map