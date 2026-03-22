import type { JoinType } from './adapter.ts';
import type { AnyQuerySource, MergeColumnTypeMaps, PrimaryKeyInputForRow, QueryColumnInput, QueryColumnName, QueryColumnTypeMap, QueryTableInput, QueryColumns, QueryResultMap, QuerySourceColumnTypes, QuerySourcePrimaryKey, QuerySourceRow, QuerySourceTableName, RelationMapForSourceName, SelectedAliasRow } from './query/types.ts';
import type { WriteResult, WriteRowResult, WriteRowsResult } from './database.ts';
import type { Predicate, WhereInput } from './operators.ts';
import type { LoadedRelationMap } from './table-relations.ts';
import type { AnyTable, TableName, TablePrimaryKey, TableRow } from './table.ts';
import type { DeleteQueryOptions, InsertQueryOptions, QueryConfig, QueryExecutionMode, UpsertQueryOptions } from './query/config.ts';
export type AnyQuery = Query<any, any, any, any, any>;
type QuerySource<input extends AnyQuery> = input extends Query<infer source, any, any, any, any> ? source : never;
type QueryColumnTypes<input extends AnyQuery> = input extends Query<any, infer columnTypes, any, any, any> ? columnTypes : never;
type QueryRow<input extends AnyQuery> = input extends Query<any, any, infer row, any, any> ? row : never;
type QueryLoaded<input extends AnyQuery> = input extends Query<any, any, any, infer loaded, any> ? loaded : never;
type QueryMode<input extends AnyQuery> = input extends Query<any, any, any, any, infer mode> ? mode : never;
type QueryTerminalResult<input extends AnyQuery, mode extends QueryExecutionMode, result> = Query<QuerySource<input>, QueryColumnTypes<input>, QueryRow<input>, QueryLoaded<input>, mode>;
export type QueryExecutionResult<input> = input extends AnyQuery ? QueryResultMap<QueryRow<input>, QueryLoaded<input>>[Extract<QueryMode<input>, QueryExecutionMode>] : never;
export declare const querySnapshot: unique symbol;
export type QuerySnapshot<source extends AnyQuerySource = AnyQuerySource, row extends Record<string, unknown> = Record<string, unknown>, mode extends QueryExecutionMode = QueryExecutionMode> = {
    table: source;
    config: QueryConfig<row, QuerySourcePrimaryKey<source>, mode>;
};
declare const queryTypeBrand: unique symbol;
export declare class Query<source extends AnyQuerySource, columnTypes extends Record<string, unknown> = QuerySourceColumnTypes<source>, row extends Record<string, unknown> = QuerySourceRow<source>, loaded extends Record<string, unknown> = {}, mode extends QueryExecutionMode = 'all'> {
    #private;
    readonly [queryTypeBrand]: {
        mode: mode;
    };
    constructor(table: source);
    select<selection extends (keyof row & string)[]>(this: Query<source, columnTypes, row, loaded, 'all'>, ...columns: selection): Query<source, columnTypes, Pick<row, selection[number]>, loaded, 'all'>;
    select<selection extends Record<string, QueryColumnInput<columnTypes>>>(this: Query<source, columnTypes, row, loaded, 'all'>, selection: selection): Query<source, columnTypes, SelectedAliasRow<columnTypes, selection>, loaded, 'all'>;
    distinct(this: Query<source, columnTypes, row, loaded, 'all'>, value?: boolean): Query<source, columnTypes, row, loaded, 'all'>;
    where(this: Query<source, columnTypes, row, loaded, 'all'>, input: WhereInput<QueryColumns<columnTypes>>): Query<source, columnTypes, row, loaded, 'all'>;
    having(this: Query<source, columnTypes, row, loaded, 'all'>, input: WhereInput<QueryColumns<columnTypes>>): Query<source, columnTypes, row, loaded, 'all'>;
    join<target extends AnyTable>(this: Query<source, columnTypes, row, loaded, 'all'>, target: target, on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>, type?: JoinType): Query<source, MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>, row, loaded, 'all'>;
    leftJoin<target extends AnyTable>(this: Query<source, columnTypes, row, loaded, 'all'>, target: target, on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>): Query<source, MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>, row, loaded, 'all'>;
    rightJoin<target extends AnyTable>(this: Query<source, columnTypes, row, loaded, 'all'>, target: target, on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>): Query<source, MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>, row, loaded, 'all'>;
    orderBy(this: Query<source, columnTypes, row, loaded, 'all'>, column: QueryColumnInput<columnTypes>, direction?: 'asc' | 'desc'): Query<source, columnTypes, row, loaded, 'all'>;
    groupBy(this: Query<source, columnTypes, row, loaded, 'all'>, ...columns: QueryColumnInput<columnTypes>[]): Query<source, columnTypes, row, loaded, 'all'>;
    limit(this: Query<source, columnTypes, row, loaded, 'all'>, value: number): Query<source, columnTypes, row, loaded, 'all'>;
    offset(this: Query<source, columnTypes, row, loaded, 'all'>, value: number): Query<source, columnTypes, row, loaded, 'all'>;
    with<relations extends RelationMapForSourceName<QuerySourceTableName<source>>>(this: Query<source, columnTypes, row, loaded, 'all'>, relations: relations): Query<source, columnTypes, row, loaded & LoadedRelationMap<relations>, 'all'>;
    all(this: Query<source, columnTypes, row, loaded, 'all'>): Query<source, columnTypes, row, loaded, 'all'>;
    first(this: Query<source, columnTypes, row, loaded, 'all'>): QueryTerminalResult<Query<source, columnTypes, row, loaded, 'all'>, 'first', (row & loaded) | null>;
    find(this: Query<source, columnTypes, row, loaded, 'all'>, value: PrimaryKeyInputForRow<row, QuerySourcePrimaryKey<source>>): QueryTerminalResult<Query<source, columnTypes, row, loaded, 'all'>, 'find', (row & loaded) | null>;
    count(this: Query<source, columnTypes, row, loaded, 'all'>): QueryTerminalResult<Query<source, columnTypes, row, loaded, 'all'>, 'count', number>;
    exists(this: Query<source, columnTypes, row, loaded, 'all'>): QueryTerminalResult<Query<source, columnTypes, row, loaded, 'all'>, 'exists', boolean>;
    insert(this: Query<source, columnTypes, row, loaded, 'all'>, values: Partial<row>, options?: InsertQueryOptions<row>): QueryTerminalResult<Query<source, columnTypes, row, loaded, 'all'>, 'insert', WriteResult | WriteRowResult<row>>;
    insertMany(this: Query<source, columnTypes, row, loaded, 'all'>, values: Partial<row>[], options?: InsertQueryOptions<row>): QueryTerminalResult<Query<source, columnTypes, row, loaded, 'all'>, 'insertMany', WriteResult | WriteRowsResult<row>>;
    update(this: Query<source, columnTypes, row, loaded, 'all'>, changes: Partial<row>, options?: InsertQueryOptions<row>): QueryTerminalResult<Query<source, columnTypes, row, loaded, 'all'>, 'update', WriteResult | WriteRowsResult<row>>;
    delete(this: Query<source, columnTypes, row, loaded, 'all'>, options?: DeleteQueryOptions<row>): QueryTerminalResult<Query<source, columnTypes, row, loaded, 'all'>, 'delete', WriteResult | WriteRowsResult<row>>;
    upsert(this: Query<source, columnTypes, row, loaded, 'all'>, values: Partial<row>, options?: UpsertQueryOptions<row>): QueryTerminalResult<Query<source, columnTypes, row, loaded, 'all'>, 'upsert', WriteResult | WriteRowResult<row>>;
    [querySnapshot](): QuerySnapshot<source, row, mode>;
}
export declare function query<table extends AnyTable>(table: table): Query<QueryTableInput<TableName<table>, TableRow<table>, TablePrimaryKey<table>>, QueryColumnTypeMap<table>, TableRow<table>, {}, 'all'>;
export type { CreateManyOptions, CreateOptions, DeleteOptions, FindManyOptions, FindOneOptions, MergeColumnTypeMaps, PrimaryKeyInputForRow, QueryColumnInput, QueryColumnName, QueryColumnTypeMap, QueryColumnTypeMapFromRow, QueryColumns, OrderByInput, OrderByTuple, QueryColumnTypesForTable, QueryTableInput, RelationMapForSourceName, SelectedAliasRow, ReturningInput, SingleTableColumn, SingleTableWhere, UpdateManyOptions, UpdateOptions, } from './query/types.ts';
export type { QueryConfig, QueryConfigPatch, QueryConfigState } from './query/config.ts';
export { cloneQueryConfig } from './query/config.ts';
//# sourceMappingURL=query.d.ts.map