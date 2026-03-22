import { DataTableQueryError, DataTableValidationError } from "../errors.js";
import { normalizeWhereInput } from "../operators.js";
import { getTableColumns, getTableName } from "../table.js";
export function assertWriteState(state, operation, policy) {
    let unsupported = [];
    if (state.select !== '*')
        unsupported.push('select()');
    if (state.distinct)
        unsupported.push('distinct()');
    if (state.joins.length > 0)
        unsupported.push('join()');
    if (state.groupBy.length > 0)
        unsupported.push('groupBy()');
    if (state.having.length > 0)
        unsupported.push('having()');
    if (Object.keys(state.with).length > 0)
        unsupported.push('with()');
    if (!policy.where && state.where.length > 0)
        unsupported.push('where()');
    if (!policy.orderBy && state.orderBy.length > 0)
        unsupported.push('orderBy()');
    if (!policy.limit && state.limit !== undefined)
        unsupported.push('limit()');
    if (!policy.offset && state.offset !== undefined)
        unsupported.push('offset()');
    if (unsupported.length > 0) {
        throw new DataTableQueryError(operation + '() does not support these query modifiers: ' + unsupported.join(', '));
    }
}
export function createPredicateColumnResolver(tables) {
    let qualifiedColumns = new Map();
    let unqualifiedColumns = new Map();
    let ambiguousColumns = new Set();
    for (let table of tables) {
        let tableColumns = getTableColumns(table);
        let tableName = getTableName(table);
        for (let columnName in tableColumns) {
            if (!Object.prototype.hasOwnProperty.call(tableColumns, columnName)) {
                continue;
            }
            let resolvedColumn = {
                tableName,
                columnName,
            };
            qualifiedColumns.set(tableName + '.' + columnName, resolvedColumn);
            if (ambiguousColumns.has(columnName)) {
                continue;
            }
            if (unqualifiedColumns.has(columnName)) {
                unqualifiedColumns.delete(columnName);
                ambiguousColumns.add(columnName);
                continue;
            }
            unqualifiedColumns.set(columnName, resolvedColumn);
        }
    }
    return function resolveColumn(column) {
        let qualified = qualifiedColumns.get(column);
        if (qualified)
            return qualified;
        if (column.includes('.')) {
            throw new DataTableQueryError('Unknown predicate column "' + column + '"');
        }
        if (ambiguousColumns.has(column)) {
            throw new DataTableQueryError('Ambiguous predicate column "' + column + '". Use a qualified column name');
        }
        let unqualified = unqualifiedColumns.get(column);
        if (!unqualified) {
            throw new DataTableQueryError('Unknown predicate column "' + column + '"');
        }
        return unqualified;
    };
}
export function normalizePredicateValues(predicate, resolveColumn) {
    if (predicate.type === 'comparison') {
        let column = resolveColumn(predicate.column);
        if (predicate.valueType === 'column') {
            resolveColumn(predicate.value);
            return predicate;
        }
        if (predicate.operator === 'in' || predicate.operator === 'notIn') {
            if (!Array.isArray(predicate.value)) {
                throw new DataTableValidationError('Invalid filter value for column "' +
                    column.columnName +
                    '" in table "' +
                    column.tableName +
                    '"', [{ message: 'Expected an array value for "' + predicate.operator + '" predicate' }], {
                    metadata: {
                        table: column.tableName,
                        column: column.columnName,
                    },
                });
            }
            return predicate;
        }
        return predicate;
    }
    if (predicate.type === 'between') {
        resolveColumn(predicate.column);
        return predicate;
    }
    if (predicate.type === 'null') {
        resolveColumn(predicate.column);
        return predicate;
    }
    return {
        ...predicate,
        predicates: predicate.predicates.map((child) => normalizePredicateValues(child, resolveColumn)),
    };
}
export function normalizeQueryWhereInput(input, tables) {
    return normalizePredicateValues(normalizeWhereInput(input), createPredicateColumnResolver(tables));
}
