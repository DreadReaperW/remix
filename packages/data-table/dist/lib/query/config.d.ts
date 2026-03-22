import type { JoinClause, SelectColumn } from '../adapter.ts';
import type { PrimaryKeyInputForRow, ReturningInput } from '../database.ts';
import type { Predicate } from '../operators.ts';
import type { AnyRelation } from '../table-relations.ts';
import type { OrderByClause } from '../table.ts';
export type InsertQueryOptions<row extends Record<string, unknown>> = {
    returning?: ReturningInput<row>;
    touch?: boolean;
};
export type DeleteQueryOptions<row extends Record<string, unknown>> = {
    returning?: ReturningInput<row>;
};
export type UpsertQueryOptions<row extends Record<string, unknown>> = {
    returning?: ReturningInput<row>;
    touch?: boolean;
    conflictTarget?: (keyof row & string)[];
    update?: Partial<row>;
};
export type QueryConfigState = {
    select: '*' | SelectColumn[];
    distinct: boolean;
    joins: JoinClause[];
    where: Predicate<string>[];
    groupBy: string[];
    having: Predicate<string>[];
    orderBy: OrderByClause[];
    limit?: number;
    offset?: number;
    with: Record<string, AnyRelation>;
};
type QueryConfigMap<row extends Record<string, unknown>, primaryKey extends readonly string[]> = {
    all: {
        kind: 'all';
    };
    first: {
        kind: 'first';
    };
    find: {
        kind: 'find';
        value: PrimaryKeyInputForRow<row, primaryKey>;
    };
    count: {
        kind: 'count';
    };
    exists: {
        kind: 'exists';
    };
    insert: {
        kind: 'insert';
        values: Partial<row>;
        options?: InsertQueryOptions<row>;
    };
    insertMany: {
        kind: 'insertMany';
        values: Partial<row>[];
        options?: InsertQueryOptions<row>;
    };
    update: {
        kind: 'update';
        changes: Partial<row>;
        options?: InsertQueryOptions<row>;
    };
    delete: {
        kind: 'delete';
        options?: DeleteQueryOptions<row>;
    };
    upsert: {
        kind: 'upsert';
        values: Partial<row>;
        options?: UpsertQueryOptions<row>;
    };
};
export type QueryExecutionMode = keyof QueryConfigMap<Record<string, unknown>, readonly string[]>;
type QueryConfigAction<row extends Record<string, unknown>, primaryKey extends readonly string[], mode extends QueryExecutionMode> = QueryConfigMap<row, primaryKey>[mode];
export type QueryConfig<row extends Record<string, unknown>, primaryKey extends readonly string[], mode extends QueryExecutionMode = QueryExecutionMode> = QueryConfigState & QueryConfigAction<row, primaryKey, mode>;
export type QueryConfigPatch = Partial<QueryConfigState>;
export declare function createInitialQueryConfig<row extends Record<string, unknown>, primaryKey extends readonly string[]>(): QueryConfig<row, primaryKey, 'all'>;
export declare function mergeQueryConfig<row extends Record<string, unknown>, primaryKey extends readonly string[], mode extends QueryExecutionMode>(config: QueryConfig<row, primaryKey, mode>, patch: QueryConfigPatch): QueryConfig<row, primaryKey, mode>;
export declare function cloneQueryConfig<row extends Record<string, unknown>, primaryKey extends readonly string[], mode extends QueryExecutionMode>(config: QueryConfig<row, primaryKey, mode>): QueryConfig<row, primaryKey, mode>;
export {};
//# sourceMappingURL=config.d.ts.map