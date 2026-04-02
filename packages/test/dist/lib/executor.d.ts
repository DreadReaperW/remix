import type { Browser, BrowserContextOptions } from 'playwright';
import type { CreateServerFunction } from './e2e-server.ts';
export interface TestResult {
    name: string;
    suiteName: string;
    filePath?: string;
    status: 'passed' | 'failed' | 'skipped' | 'todo';
    error?: {
        message: string;
        stack?: string;
    };
    duration: number;
}
export interface TestResults {
    passed: number;
    failed: number;
    skipped: number;
    todo: number;
    tests: TestResult[];
}
export declare function runTests(options?: {
    createServer?: CreateServerFunction;
    browser?: Browser;
    open?: boolean;
    playwrightPageOptions?: BrowserContextOptions;
}): Promise<TestResults>;
//# sourceMappingURL=executor.d.ts.map