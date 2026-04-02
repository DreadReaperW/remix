import type { ScriptRouteDefinition } from './routes.ts';
type ScriptServerWatcherOptions = {
    ignore?: readonly string[];
    poll?: boolean;
    pollInterval?: number;
    onFileEvent(filePath: string, event: ScriptServerWatchEvent): Promise<void>;
    root: string;
    routes: readonly ScriptRouteDefinition[];
};
type ScriptServerWatchEvent = 'add' | 'change' | 'unlink';
export type ScriptServerWatcher = {
    close(): Promise<void>;
    getWatchedDirectories(): string[];
    whenReady(): Promise<void>;
};
export declare function createScriptServerWatcher(options: ScriptServerWatcherOptions): ScriptServerWatcher;
export {};
//# sourceMappingURL=watch.d.ts.map