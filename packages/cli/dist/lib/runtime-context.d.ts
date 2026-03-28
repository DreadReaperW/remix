export interface CliRuntimeContext {
    cwd?: string;
    remixVersion?: string;
}
export declare function getCliRuntimeContext(): CliRuntimeContext;
export declare function getRuntimeRemixVersion(): string | undefined;
export declare function getRuntimeCwd(): string;
export declare function setCliRuntimeContext(context: CliRuntimeContext): CliRuntimeContext;
//# sourceMappingURL=runtime-context.d.ts.map