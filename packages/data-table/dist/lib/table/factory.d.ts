import type { TableAfterDelete, TableAfterRead, TableAfterWrite, TableBeforeDelete, TableBeforeWrite, TableValidate } from './lifecycle.ts';
import type { TableColumnsDefinition, Table, TableRowFromColumns, TimestampOptions } from './metadata.ts';
type ColumnNameFromColumns<columns extends TableColumnsDefinition> = keyof columns & string;
type DefaultPrimaryKey<columns extends TableColumnsDefinition> = 'id' extends ColumnNameFromColumns<columns> ? readonly ['id'] : readonly ColumnNameFromColumns<columns>[];
type NormalizePrimaryKey<columns extends TableColumnsDefinition, primaryKey extends ColumnNameFromColumns<columns> | readonly ColumnNameFromColumns<columns>[] | undefined> = primaryKey extends readonly (infer column extends ColumnNameFromColumns<columns>)[] ? readonly [...column[]] : primaryKey extends ColumnNameFromColumns<columns> ? readonly [primaryKey] : DefaultPrimaryKey<columns>;
/**
 * Table declaration options.
 */
export type CreateTableOptions<name extends string, columns extends TableColumnsDefinition, primaryKey extends ColumnNameFromColumns<columns> | readonly ColumnNameFromColumns<columns>[] | undefined> = {
    name: name;
    columns: columns;
    primaryKey?: primaryKey;
    timestamps?: TimestampOptions;
    beforeWrite?: TableBeforeWrite<TableRowFromColumns<columns>>;
    afterWrite?: TableAfterWrite<TableRowFromColumns<columns>>;
    beforeDelete?: TableBeforeDelete;
    afterDelete?: TableAfterDelete;
    afterRead?: TableAfterRead<TableRowFromColumns<columns>>;
    validate?: TableValidate<TableRowFromColumns<columns>>;
};
/**
 * Creates a table object with symbol-backed metadata and direct column references.
 * @param options Table declaration options.
 * @returns A frozen table object.
 * @example
 * ```ts
 * import { column as c, table } from 'remix/data-table'
 *
 * let users = table({
 *   name: 'users',
 *   columns: {
 *     id: c.integer(),
 *     email: c.varchar(255),
 *   },
 *   primaryKey: 'id',
 * })
 * ```
 */
export declare function table<name extends string, columns extends TableColumnsDefinition, primaryKey extends ColumnNameFromColumns<columns> | readonly ColumnNameFromColumns<columns>[] | undefined = undefined>(options: CreateTableOptions<name, columns, primaryKey>): Table<name, columns, NormalizePrimaryKey<columns, primaryKey>>;
export {};
//# sourceMappingURL=factory.d.ts.map