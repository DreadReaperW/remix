import type { ColumnDefinition, CreateTableOperation, ForeignKeyConstraint, TableRef } from '../adapter.ts';
import { ColumnBuilder } from '../column.ts';
import type { CreateIndexOptions, ForeignKeyOptions, KeyColumns, NamedConstraintOptions, TableInput } from '../migrations.ts';
import type { AnyTable } from '../table.ts';
export declare function toMigrationTableRef(value: TableInput): TableRef;
export declare function toMigrationColumnDefinition(definition: ColumnDefinition | ColumnBuilder): ColumnDefinition;
export declare function lowerTableForCreate(table: AnyTable): CreateTableOperation;
export declare function createIndexOperation(table: TableInput, columns: string | string[], options?: CreateIndexOptions): ReturnType<typeof createIndexOperationForTableRef>;
export declare function createIndexOperationForTableRef(table: TableRef, columns: string | string[], options?: CreateIndexOptions): {
    kind: 'createIndex';
    index: {
        table: TableRef;
        name: string;
        columns: string[];
        unique?: boolean;
        using?: CreateIndexOptions['using'];
        where?: string;
    };
    ifNotExists?: boolean;
};
export declare function createForeignKeyConstraint(table: TableRef, columns: KeyColumns, refTable: TableInput, refColumns?: KeyColumns, options?: ForeignKeyOptions): ForeignKeyConstraint;
export declare function createCheckConstraint(table: TableRef, expression: string, options?: NamedConstraintOptions): {
    expression: string;
    name: string;
};
//# sourceMappingURL=schema-operations.d.ts.map