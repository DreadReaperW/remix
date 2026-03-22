import type { Predicate, WhereInput } from '../operators.ts';
import type { AnyTable } from '../table.ts';
import type { QueryConfigState } from './config.ts';
type ResolvedPredicateColumn = {
    tableName: string;
    columnName: string;
};
type WriteStatePolicy = {
    where: boolean;
    orderBy: boolean;
    limit: boolean;
    offset: boolean;
};
export declare function assertWriteState(state: QueryConfigState, operation: 'insert' | 'insertMany' | 'update' | 'delete' | 'upsert', policy: WriteStatePolicy): void;
export declare function createPredicateColumnResolver(tables: AnyTable[]): (column: string) => ResolvedPredicateColumn;
export declare function normalizePredicateValues(predicate: Predicate<string>, resolveColumn: (column: string) => ResolvedPredicateColumn): Predicate<string>;
export declare function normalizeQueryWhereInput<column extends string>(input: WhereInput<column>, tables: AnyTable[]): Predicate<string>;
export {};
//# sourceMappingURL=predicate.d.ts.map