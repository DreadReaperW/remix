import type { DataManipulationOperation, DataManipulationResult, DatabaseAdapter, TransactionOptions, TransactionToken } from '../adapter.ts';
import type { CountOptions, CreateManyResultOptions, CreateManyRowsOptions, CreateResultOptions, CreateRowOptions, DeleteManyOptions, FindManyOptions, FindOneOptions, QueryMethod, RelationMapForSourceName, UpdateManyOptions, UpdateOptions, WriteResult } from '../database.ts';
import type { SqlStatement } from '../sql.ts';
import type { AnyTable, LoadedRelationMap, PrimaryKeyInput, TableName, TableRow, TableRowWith } from '../table.ts';
import { executeOperation, type QueryExecutionContext } from './execution-context.ts';
type SavepointCounter = {
    value: number;
};
type DatabaseOptions = {
    now?: () => unknown;
};
type DatabaseInternalOptions = {
    token?: TransactionToken;
    savepointCounter?: SavepointCounter;
};
export declare function withDatabaseInternals(options: DatabaseOptions | undefined, internal: DatabaseInternalOptions): DatabaseOptions;
/**
 * High-level database runtime used to build and execute data manipulation operations.
 *
 * Create instances directly with `new Database(adapter, options)` or use
 * `createDatabase(adapter, options)` as a thin wrapper.
 */
export declare class Database implements QueryExecutionContext {
    #private;
    constructor(adapter: DatabaseAdapter, options?: DatabaseOptions);
    get adapter(): DatabaseAdapter;
    now(): unknown;
    query: QueryMethod;
    create<table extends AnyTable>(table: table, values: Partial<TableRow<table>>, options?: CreateResultOptions): Promise<WriteResult>;
    create<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}>(table: table, values: Partial<TableRow<table>>, options: CreateRowOptions<table, relations>): Promise<TableRowWith<table, LoadedRelationMap<relations>>>;
    createMany<table extends AnyTable>(table: table, values: Array<Partial<TableRow<table>>>, options?: CreateManyResultOptions): Promise<WriteResult>;
    createMany<table extends AnyTable>(table: table, values: Array<Partial<TableRow<table>>>, options: CreateManyRowsOptions): Promise<TableRow<table>[]>;
    find<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}>(table: table, value: PrimaryKeyInput<table>, options?: {
        with?: relations;
    }): Promise<TableRowWith<table, LoadedRelationMap<relations>> | null>;
    findOne<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}>(table: table, options: FindOneOptions<table, relations>): Promise<TableRowWith<table, LoadedRelationMap<relations>> | null>;
    findMany<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}>(table: table, options?: FindManyOptions<table, relations>): Promise<Array<TableRowWith<table, LoadedRelationMap<relations>>>>;
    count<table extends AnyTable>(table: table, options?: CountOptions<table>): Promise<number>;
    update<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}>(table: table, value: PrimaryKeyInput<table>, changes: Partial<TableRow<table>>, options?: UpdateOptions<table, relations>): Promise<TableRowWith<table, LoadedRelationMap<relations>>>;
    updateMany<table extends AnyTable>(table: table, changes: Partial<TableRow<table>>, options: UpdateManyOptions<table>): Promise<WriteResult>;
    delete<table extends AnyTable>(table: table, value: PrimaryKeyInput<table>): Promise<boolean>;
    deleteMany<table extends AnyTable>(table: table, options: DeleteManyOptions<table>): Promise<WriteResult>;
    exec(statement: string | SqlStatement, values?: unknown[]): Promise<DataManipulationResult>;
    transaction<result>(callback: (database: Database) => Promise<result>, options?: TransactionOptions): Promise<result>;
    [executeOperation](operation: DataManipulationOperation): Promise<DataManipulationResult>;
}
export {};
//# sourceMappingURL=runtime.d.ts.map