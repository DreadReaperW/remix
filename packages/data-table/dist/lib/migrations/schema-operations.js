import { ColumnBuilder } from "../column.js";
import { getTableColumnDefinitions, getTableName, getTablePrimaryKey } from "../table.js";
import { createCheckName, createForeignKeyName, createIndexName, createPrimaryKeyName, createUniqueName, normalizeKeyColumns, toTableRef, } from "./helpers.js";
export function toMigrationTableRef(value) {
    if (typeof value === 'string') {
        return toTableRef(value);
    }
    return toTableRef(getTableName(value));
}
export function toMigrationColumnDefinition(definition) {
    if (definition instanceof ColumnBuilder) {
        return definition.build();
    }
    return definition;
}
export function lowerTableForCreate(table) {
    let tableRef = toTableRef(getTableName(table));
    let sourceColumnDefinitions = getTableColumnDefinitions(table);
    let columns = {};
    let uniques = [];
    let checks = [];
    let foreignKeys = [];
    for (let columnName in sourceColumnDefinitions) {
        if (!Object.prototype.hasOwnProperty.call(sourceColumnDefinitions, columnName)) {
            continue;
        }
        let sourceDefinition = sourceColumnDefinitions[columnName];
        let columnDefinition = {
            ...sourceDefinition,
            checks: undefined,
            references: undefined,
            primaryKey: undefined,
        };
        let unique = sourceDefinition.unique;
        if (unique) {
            let uniqueName = typeof unique === 'object' && unique.name
                ? unique.name
                : createUniqueName(tableRef, [columnName]);
            uniques.push({
                name: uniqueName,
                columns: [columnName],
            });
            columnDefinition.unique = undefined;
        }
        if (sourceDefinition.checks) {
            for (let check of sourceDefinition.checks) {
                checks.push({
                    name: check.name || createCheckName(tableRef, check.expression),
                    expression: check.expression,
                });
            }
        }
        if (sourceDefinition.references) {
            let referenceColumns = [...sourceDefinition.references.columns];
            let referencesTable = { ...sourceDefinition.references.table };
            foreignKeys.push({
                name: sourceDefinition.references.name ||
                    createForeignKeyName(tableRef, [columnName], referencesTable, referenceColumns),
                columns: [columnName],
                references: {
                    table: referencesTable,
                    columns: referenceColumns,
                },
                onDelete: sourceDefinition.references.onDelete,
                onUpdate: sourceDefinition.references.onUpdate,
            });
        }
        columns[columnName] = columnDefinition;
    }
    let primaryKeyColumns = [...getTablePrimaryKey(table)];
    let primaryKey = primaryKeyColumns.length
        ? {
            columns: primaryKeyColumns,
            name: createPrimaryKeyName(tableRef),
        }
        : undefined;
    return {
        kind: 'createTable',
        table: tableRef,
        columns,
        primaryKey,
        uniques: uniques.length ? uniques : undefined,
        checks: checks.length ? checks : undefined,
        foreignKeys: foreignKeys.length ? foreignKeys : undefined,
    };
}
export function createIndexOperation(table, columns, options) {
    return createIndexOperationForTableRef(toMigrationTableRef(table), columns, options);
}
export function createIndexOperationForTableRef(table, columns, options) {
    return buildCreateIndexOperation(table, columns, options);
}
function buildCreateIndexOperation(table, columns, options) {
    let normalizedColumns = normalizeKeyColumns(columns);
    let { name, ifNotExists, ...indexOptions } = options ?? {};
    return {
        kind: 'createIndex',
        index: {
            table,
            name: name ?? createIndexName(table, normalizedColumns),
            columns: normalizedColumns,
            ...indexOptions,
        },
        ifNotExists,
    };
}
export function createForeignKeyConstraint(table, columns, refTable, refColumns, options) {
    let normalizedColumns = normalizeKeyColumns(columns);
    let referencesTable = toMigrationTableRef(refTable);
    let normalizedReferenceColumns = refColumns ? normalizeKeyColumns(refColumns) : ['id'];
    return {
        columns: normalizedColumns,
        references: {
            table: referencesTable,
            columns: normalizedReferenceColumns,
        },
        name: options?.name ??
            createForeignKeyName(table, normalizedColumns, referencesTable, normalizedReferenceColumns),
        onDelete: options?.onDelete,
        onUpdate: options?.onUpdate,
    };
}
export function createCheckConstraint(table, expression, options) {
    return {
        expression,
        name: options?.name ?? createCheckName(table, expression),
    };
}
