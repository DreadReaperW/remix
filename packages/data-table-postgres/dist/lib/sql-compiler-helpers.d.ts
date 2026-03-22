import type { DataManipulationOperation, Predicate, SqlStatement, TableRef } from '@remix-run/data-table/adapter';
type JoinClause = Extract<DataManipulationOperation, {
    kind: 'select';
}>['joins'][number];
type OperationTable = Extract<DataManipulationOperation, {
    kind: 'select';
}>['table'];
type CompileContext = {
    values: unknown[];
};
export type { CompileContext, JoinClause, OperationTable };
export declare function compileRawOperation(statement: SqlStatement): SqlStatement;
export declare function compileFromClause(table: OperationTable, joins: JoinClause[], context: CompileContext): string;
export declare function compileWhereClause(predicates: Predicate[], context: CompileContext): string;
export declare function compileGroupByClause(columns: string[]): string;
export declare function compileHavingClause(predicates: Predicate[], context: CompileContext): string;
export declare function compileOrderByClause(orderBy: {
    column: string;
    direction: 'asc' | 'desc';
}[]): string;
export declare function compileLimitClause(limit: number | undefined): string;
export declare function compileOffsetClause(offset: number | undefined): string;
export declare function compileReturningClause(returning: '*' | string[] | undefined): string;
export declare function quoteIdentifier(value: string): string;
export declare function quoteTableRef(table: TableRef): string;
export declare function quotePath(path: string): string;
export declare function pushValue(context: CompileContext, value: unknown): string;
export declare function collectColumns(rows: Record<string, unknown>[]): string[];
//# sourceMappingURL=sql-compiler-helpers.d.ts.map