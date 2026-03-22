import { getTableName, getTablePrimaryKey } from '@remix-run/data-table/adapter';
import { collectColumns, compileFromClause, compileGroupByClause, compileHavingClause, compileLimitClause, compileOffsetClause, compileOrderByClause, compileRawOperation, compileReturningClause, compileWhereClause, pushValue, quoteIdentifier, quotePath, } from "./sql-compiler-helpers.js";
export function compilePostgresOperation(operation) {
    switch (operation.kind) {
        case 'raw':
            return compileRawOperation(operation.sql);
        case 'select': {
            let context = { values: [] };
            return {
                text: compileSelectOperation(operation, context),
                values: context.values,
            };
        }
        case 'count':
        case 'exists': {
            let context = { values: [] };
            return {
                text: compileCountOperation(operation, context),
                values: context.values,
            };
        }
        case 'insert': {
            let context = { values: [] };
            return compileInsertOperation(operation.table, operation.values, operation.returning, context);
        }
        case 'insertMany': {
            let context = { values: [] };
            return compileInsertManyOperation(operation.table, operation.values, operation.returning, context);
        }
        case 'update': {
            let context = { values: [] };
            return {
                text: 'update ' +
                    quotePath(getTableName(operation.table)) +
                    ' set ' +
                    compileAssignments(operation.changes, context) +
                    compileWhereClause(operation.where, context) +
                    compileReturningClause(operation.returning),
                values: context.values,
            };
        }
        case 'delete': {
            let context = { values: [] };
            return {
                text: 'delete from ' +
                    quotePath(getTableName(operation.table)) +
                    compileWhereClause(operation.where, context) +
                    compileReturningClause(operation.returning),
                values: context.values,
            };
        }
        case 'upsert': {
            let context = { values: [] };
            return compileUpsertOperation(operation, context);
        }
    }
    throw new Error('Unsupported operation kind');
}
function compileSelectOperation(operation, context) {
    return ('select ' +
        (operation.distinct ? 'distinct ' : '') +
        compileSelection(operation.select) +
        compileFromClause(operation.table, operation.joins, context) +
        compileWhereClause(operation.where, context) +
        compileGroupByClause(operation.groupBy) +
        compileHavingClause(operation.having, context) +
        compileOrderByClause(operation.orderBy) +
        compileLimitClause(operation.limit) +
        compileOffsetClause(operation.offset));
}
function compileCountOperation(operation, context) {
    let inner = 'select 1' +
        compileFromClause(operation.table, operation.joins, context) +
        compileWhereClause(operation.where, context) +
        compileGroupByClause(operation.groupBy) +
        compileHavingClause(operation.having, context);
    return ('select count(*) as ' +
        quoteIdentifier('count') +
        ' from (' +
        inner +
        ') as ' +
        quoteIdentifier('__dt_count'));
}
function compileSelection(selection) {
    if (selection === '*') {
        return '*';
    }
    return selection
        .map((field) => quotePath(field.column) + ' as ' + quoteIdentifier(field.alias))
        .join(', ');
}
function compileAssignments(changes, context) {
    return Object.keys(changes)
        .map((column) => quotePath(column) + ' = ' + pushValue(context, changes[column]))
        .join(', ');
}
function compileInsertOperation(table, values, returning, context) {
    let columns = Object.keys(values);
    if (columns.length === 0) {
        return {
            text: 'insert into ' +
                quotePath(getTableName(table)) +
                ' default values' +
                compileReturningClause(returning),
            values: context.values,
        };
    }
    let quotedColumns = columns.map((column) => quotePath(column));
    let placeholders = columns.map((column) => pushValue(context, values[column]));
    return {
        text: 'insert into ' +
            quotePath(getTableName(table)) +
            ' (' +
            quotedColumns.join(', ') +
            ') values (' +
            placeholders.join(', ') +
            ')' +
            compileReturningClause(returning),
        values: context.values,
    };
}
function compileInsertManyOperation(table, rows, returning, context) {
    if (rows.length === 0) {
        return {
            text: 'select 0 where 1 = 0',
            values: context.values,
        };
    }
    let columns = collectColumns(rows);
    if (columns.length === 0) {
        return {
            text: 'insert into ' +
                quotePath(getTableName(table)) +
                ' default values' +
                compileReturningClause(returning),
            values: context.values,
        };
    }
    let quotedColumns = columns.map((column) => quotePath(column));
    let valueSets = rows.map((row) => {
        let placeholders = columns.map((column) => {
            let value = Object.prototype.hasOwnProperty.call(row, column) ? row[column] : null;
            return pushValue(context, value);
        });
        return '(' + placeholders.join(', ') + ')';
    });
    return {
        text: 'insert into ' +
            quotePath(getTableName(table)) +
            ' (' +
            quotedColumns.join(', ') +
            ') values ' +
            valueSets.join(', ') +
            compileReturningClause(returning),
        values: context.values,
    };
}
function compileUpsertOperation(operation, context) {
    let insertColumns = Object.keys(operation.values);
    let conflictTarget = operation.conflictTarget ?? [...getTablePrimaryKey(operation.table)];
    if (insertColumns.length === 0) {
        throw new Error('upsert requires at least one value');
    }
    let quotedInsertColumns = insertColumns.map((column) => quotePath(column));
    let insertPlaceholders = insertColumns.map((column) => pushValue(context, operation.values[column]));
    let updateValues = operation.update ?? operation.values;
    let updateColumns = Object.keys(updateValues);
    let onConflictClause = '';
    if (updateColumns.length === 0) {
        onConflictClause =
            ' on conflict (' +
                conflictTarget.map((column) => quotePath(column)).join(', ') +
                ') do nothing';
    }
    else {
        onConflictClause =
            ' on conflict (' +
                conflictTarget.map((column) => quotePath(column)).join(', ') +
                ') do update set ' +
                updateColumns
                    .map((column) => quotePath(column) + ' = ' + pushValue(context, updateValues[column]))
                    .join(', ');
    }
    return {
        text: 'insert into ' +
            quotePath(getTableName(operation.table)) +
            ' (' +
            quotedInsertColumns.join(', ') +
            ') values (' +
            insertPlaceholders.join(', ') +
            ')' +
            onConflictClause +
            compileReturningClause(operation.returning),
        values: context.values,
    };
}
