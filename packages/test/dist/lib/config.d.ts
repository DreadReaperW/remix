import type { PlaywrightTestConfig } from 'playwright/test';
export declare const defaultTestGlob = "**/*.test?(.browser)?(.e2e).{ts,tsx}";
export interface RemixTestConfig {
    /**
     * Options for controlling the playwright browser
     *  - `browser.echo`: Echo browser console output to stdout (--browser.echo)
     *  - `browser.open`: Open browser window and keep open after test finish (--browser.open)
     */
    browser?: {
        echo?: boolean;
        open?: boolean;
    };
    /**
     * Glob patterns to identify test files
     *  - `glob.test`: Glob pattern for all test files (--glob.test)
     *  - `glob.e2e`: Glob pattern for the subset of e2e test files (--glob.e2e)
     */
    glob?: {
        test?: string;
        e2e?: string;
    };
    /** Max number of concurrent test workers (--concurrency) */
    concurrency?: number | string;
    /**
     * Path to a module that exports `globalSetup` and/or `globalTeardown` functions,
     * called once before and after the test run respectively. (--setup)
     */
    setup?: string;
    /**
     * Playwright configuration — either a path to a playwright config file or an inline
     * PlaywrightTestConfig object. CLI `--playwrightConfig` only accepts a file path.
     */
    playwrightConfig?: string | PlaywrightTestConfig;
    /** Filter tests to a specific playwright project (--project) */
    project?: string;
    /** Test reporter (--reporter) */
    reporter?: string;
    /** Comma-separated list of test types to run: server,browser,e2e (--type) */
    type?: string;
    /** Watch mode — re-run tests on file changes (--watch) */
    watch?: boolean;
}
export interface ResolvedRemixTestConfig {
    browser: {
        echo?: boolean;
        open?: boolean;
    };
    concurrency: number;
    glob: {
        test: string;
        e2e: string;
    };
    setup?: string;
    playwrightConfig?: string | PlaywrightTestConfig;
    project?: string;
    reporter: string;
    type: string;
    watch?: boolean;
}
export declare function loadConfig(): Promise<ResolvedRemixTestConfig>;
//# sourceMappingURL=config.d.ts.map