export declare const defaultTestGlob = "**/*.test?(.browser)?(.e2e).{ts,tsx}";
export interface RemixTestConfig {
    /**
     * Glob patterns to identify test files
     *  - `glob.test`: Glob pattern for all test files (--glob.test)
     */
    glob?: {
        test?: string;
    };
    /** Max number of concurrent test workers (--concurrency) */
    concurrency?: number | string;
    /**
     * Coverage configuration. `true` enables with defaults; an object enables with settings;
     * `false` disables. CLI `--coverage` flag overrides the boolean aspect.
     */
    coverage?: boolean | {
        dir?: string;
        include?: string[];
        exclude?: string[];
        statements?: number | string;
        lines?: number | string;
        branches?: number | string;
        functions?: number | string;
    };
    /**
     * Path to a module that exports `globalSetup` and/or `globalTeardown` functions,
     * called once before and after the test run respectively. (--setup)
     */
    setup?: string;
    /** Test reporter (--reporter) */
    reporter?: string;
    /** Watch mode — re-run tests on file changes (--watch) */
    watch?: boolean;
}
export interface ResolvedRemixTestConfig {
    concurrency: number;
    coverage: {
        dir: string;
        include?: string[];
        exclude?: string[];
        statements?: number;
        lines?: number;
        branches?: number;
        functions?: number;
    } | undefined;
    glob: {
        test: string;
    };
    setup?: string;
    reporter: string;
    watch?: boolean;
}
export declare function loadConfig(): Promise<ResolvedRemixTestConfig>;
//# sourceMappingURL=config.d.ts.map