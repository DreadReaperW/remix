import type { AlterTableChange, ColumnDefinition, DataMigrationOperation, TableRef } from '../adapter.ts';
import type { ColumnBuilder } from '../column.ts';
import type { AlterTableBuilder, CreateIndexOptions, ForeignKeyOptions, KeyColumns, NamedConstraintOptions, TableInput } from '../migrations.ts';
export declare class AlterTableBuilderRuntime implements AlterTableBuilder {
    alterChanges: AlterTableChange[];
    extraStatements: DataMigrationOperation[];
    table: TableRef;
    constructor(table: TableRef);
    addColumn(name: string, definition: ColumnDefinition | ColumnBuilder): void;
    changeColumn(name: string, definition: ColumnDefinition | ColumnBuilder): void;
    renameColumn(from: string, to: string): void;
    dropColumn(name: string, options?: {
        ifExists?: boolean;
    }): void;
    addPrimaryKey(columns: KeyColumns, options?: NamedConstraintOptions): void;
    dropPrimaryKey(name: string): void;
    addUnique(columns: KeyColumns, options?: NamedConstraintOptions): void;
    dropUnique(name: string): void;
    addForeignKey(columns: KeyColumns, refTable: TableInput, refColumns?: KeyColumns, options?: ForeignKeyOptions): void;
    dropForeignKey(name: string): void;
    addCheck(expression: string, options?: NamedConstraintOptions): void;
    dropCheck(name: string): void;
    addIndex(columns: string | string[], options?: CreateIndexOptions): void;
    dropIndex(name: string): void;
    comment(text: string): void;
}
//# sourceMappingURL=alter-table-builder.d.ts.map