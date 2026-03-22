import type { ColumnInput as ColumnBuilderInput } from './column.ts';
import type { AnyTable, TableColumns, TablePrimaryKey, TableRow } from './table/metadata.ts';
import type { WhereObject } from './operators.ts';
import type { Pretty } from './types.ts';
/**
 * Primary-key input accepted by `find()`, `update()`, and similar helpers.
 */
export type PrimaryKeyInput<table extends AnyTable> = TablePrimaryKey<table> extends readonly [infer column extends string] ? column extends keyof TableColumns<table> & string ? ColumnBuilderInput<TableColumns<table>[column]> : never : Pretty<{
    [column in TablePrimaryKey<table>[number] & keyof TableColumns<table> & string]: ColumnBuilderInput<TableColumns<table>[column]>;
}>;
/**
 * Normalizes a primary-key input into an object keyed by primary-key columns.
 * @param table Source table.
 * @param value Primary-key input value.
 * @returns Primary-key object.
 */
export declare function getPrimaryKeyObject<table extends AnyTable>(table: table, value: PrimaryKeyInput<table>): WhereObject<keyof TableRow<table> & string>;
/**
 * Builds a stable key for a row tuple.
 * @param row Source row.
 * @param columns Columns included in the tuple.
 * @returns Stable tuple key.
 */
export declare function getCompositeKey(row: Record<string, unknown>, columns: readonly string[]): string;
//# sourceMappingURL=table-keys.d.ts.map