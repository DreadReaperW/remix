import { ColumnBuilder } from "../column.js";
import { columnMetadataKey, tableMetadataKey } from "../references.js";
const defaultTimestampConfig = {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
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
export function table(options) {
    let tableName = options.name;
    let columns = options.columns;
    let table = Object.create(null);
    let resolvedPrimaryKey = normalizePrimaryKey(tableName, columns, options.primaryKey);
    let timestampConfig = normalizeTimestampConfig(options.timestamps);
    let columnDefinitions = resolveTableColumns(tableName, columns);
    Object.defineProperty(table, tableMetadataKey, {
        value: Object.freeze({
            name: tableName,
            columns,
            primaryKey: resolvedPrimaryKey,
            timestamps: timestampConfig,
            columnDefinitions,
            beforeWrite: options.beforeWrite,
            afterWrite: options.afterWrite,
            beforeDelete: options.beforeDelete,
            afterDelete: options.afterDelete,
            afterRead: options.afterRead,
            validate: options.validate,
        }),
        enumerable: false,
        writable: false,
        configurable: false,
    });
    for (let columnName in columns) {
        if (!Object.prototype.hasOwnProperty.call(columns, columnName)) {
            continue;
        }
        let column = createColumnReference(tableName, columnName);
        Object.defineProperty(table, columnName, {
            value: column,
            enumerable: true,
            writable: false,
            configurable: false,
        });
    }
    Object.freeze(table);
    return table;
}
function createColumnReference(tableName, columnName) {
    let column = {
        kind: 'column',
        [columnMetadataKey]: {
            tableName,
            columnName,
            qualifiedName: `${tableName}.${columnName}`,
        },
    };
    Object.freeze(column);
    return column;
}
function resolveTableColumns(tableName, columns) {
    let columnDefinitions = Object.create(null);
    for (let columnName in columns) {
        if (!Object.prototype.hasOwnProperty.call(columns, columnName)) {
            continue;
        }
        let column = columns[columnName];
        if (!(column instanceof ColumnBuilder)) {
            throw new Error('Invalid column "' +
                columnName +
                '" for table "' +
                tableName +
                '". Expected a column(...) builder');
        }
        columnDefinitions[columnName] = column.build();
    }
    Object.freeze(columnDefinitions);
    return columnDefinitions;
}
function normalizePrimaryKey(tableName, columns, primaryKey) {
    if (primaryKey === undefined) {
        if (!Object.prototype.hasOwnProperty.call(columns, 'id')) {
            throw new Error('Table "' + tableName + '" must include an "id" column or an explicit primaryKey');
        }
        return ['id'];
    }
    let keys = Array.isArray(primaryKey) ? [...primaryKey] : [primaryKey];
    if (keys.length === 0) {
        throw new Error('Table "' + tableName + '" primaryKey must contain at least one column');
    }
    for (let key of keys) {
        if (!Object.prototype.hasOwnProperty.call(columns, key)) {
            throw new Error('Table "' + tableName + '" primaryKey column "' + key + '" does not exist');
        }
    }
    return keys;
}
function normalizeTimestampConfig(options) {
    if (!options) {
        return null;
    }
    if (options === true) {
        return { ...defaultTimestampConfig };
    }
    return {
        createdAt: options.createdAt ?? defaultTimestampConfig.createdAt,
        updatedAt: options.updatedAt ?? defaultTimestampConfig.updatedAt,
    };
}
