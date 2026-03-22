import type { AnyQuery, QueryConfig, QueryExecutionResult } from '../query.ts';
import type { AnyTable } from '../table.ts';
import { type QueryExecutionContext } from './execution-context.ts';
type ConcreteQueryConfig = QueryConfig<Record<string, unknown>, readonly string[]>;
export declare function executeQuery<input extends AnyQuery>(database: QueryExecutionContext, input: input): Promise<QueryExecutionResult<input>>;
export declare function loadRowsWithRelationsForQuery(database: QueryExecutionContext, input: AnyQuery): Promise<Record<string, unknown>[]>;
export declare function loadRowsWithRelationsForConfig(database: QueryExecutionContext, table: AnyTable, config: ConcreteQueryConfig): Promise<Record<string, unknown>[]>;
export {};
//# sourceMappingURL=query-execution.d.ts.map