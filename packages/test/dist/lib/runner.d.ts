import type { Reporter } from './reporter.ts';
import { type PlaywrightUseOpts } from './playwright.ts';
import type { Counts } from './utils.ts';
export declare function runServerTests(files: string[], reporter: Reporter, concurrency: number, type: 'server' | 'e2e', options?: {
    open?: boolean;
    playwrightUseOpts?: PlaywrightUseOpts;
    projectName?: string;
}): Promise<Counts>;
//# sourceMappingURL=runner.d.ts.map