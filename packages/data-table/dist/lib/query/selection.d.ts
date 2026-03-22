import type { SelectColumn } from '../adapter.ts';
import type { QueryColumnInput } from './types.ts';
export declare function isSelectionMap<columnTypes extends Record<string, unknown>>(input: readonly unknown[]): input is readonly [Record<string, QueryColumnInput<columnTypes>>];
export declare function normalizeSelection<row extends Record<string, unknown>, columnTypes extends Record<string, unknown>>(input: readonly [Record<string, QueryColumnInput<columnTypes>>]): SelectColumn[];
export declare function normalizeSelection<row extends Record<string, unknown>, columnTypes extends Record<string, unknown>>(input: readonly (keyof row & string)[]): SelectColumn[];
export declare function normalizeSelection<row extends Record<string, unknown>, columnTypes extends Record<string, unknown>>(input: readonly [Record<string, QueryColumnInput<columnTypes>>] | readonly (keyof row & string)[]): SelectColumn[];
//# sourceMappingURL=selection.d.ts.map