import type { Reporter } from './reporter.ts';
import { type CoverageConfig, type CoverageMap } from './coverage.ts';
import type { Counts } from './utils.ts';
export declare function runServerTests(files: string[], reporter: Reporter, concurrency: number, type: 'server' | 'e2e', options?: {
    coverage?: CoverageConfig;
}): Promise<Counts & {
    coverageMap: CoverageMap | null;
}>;
//# sourceMappingURL=runner.d.ts.map