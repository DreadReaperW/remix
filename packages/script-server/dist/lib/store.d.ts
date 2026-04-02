import type { EmittedModule } from './emit.ts';
import type { ResolutionFailureState, ResolvedModule, TrackedResolution } from './resolve.ts';
import type { TransformFailureState, TransformedModule } from './transform.ts';
export type ModuleWatchEvent = 'change' | 'add' | 'delete';
type ModuleRecordState = {
    identityPath: string;
    lastInvalidatedAt: number;
    transformed?: TransformedModule;
    resolved?: ResolvedModule;
    emitted?: EmittedModule;
    trackedFiles: ReadonlySet<string>;
    trackedResolutions: readonly TrackedResolution[];
};
export type ModuleRecord = Readonly<ModuleRecordState>;
type ModuleStore = {
    get(identityPath: string): ModuleRecord;
    setTransformFailure(identityPath: string, failure: TransformFailureState): void;
    setTransformed(identityPath: string, transformed: TransformedModule): void;
    setResolved(identityPath: string, resolved: ResolvedModule): void;
    setResolveFailure(identityPath: string, failure: ResolutionFailureState): void;
    setEmitted(identityPath: string, emitted: EmittedModule): void;
    invalidateForFileEvent(filePath: string, event: ModuleWatchEvent): void;
    invalidateAll(): void;
};
export declare function createModuleStore(): ModuleStore;
export {};
//# sourceMappingURL=store.d.ts.map