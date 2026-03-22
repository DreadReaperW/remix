import { DataTableQueryError } from "../errors.js";
import { normalizeWhereInput } from "../operators.js";
import { cloneQueryConfig, querySnapshot } from "../query.js";
import { getTableName, getTablePrimaryKey } from "../table.js";
import { executeOperation } from "./execution-context.js";
import { buildPrimaryKeyPredicate, hasScopedWriteModifiers, loadPrimaryKeyRowsForScope, } from "./helpers.js";
import { loadRelationsForRows } from "./relations.js";
import { applyAfterReadHooksToLoadedRows, applyAfterReadHooksToRows, assertReturningCapability, normalizeReturningSelection, prepareInsertValues, prepareUpdateValues, runAfterDeleteHook, runAfterWriteHook, runBeforeDeleteHook, } from "./write-lifecycle.js";
export async function executeQuery(database, input) {
    let snapshot = input[querySnapshot]();
    let { table, config } = snapshot;
    let result;
    switch (config.kind) {
        case 'all':
            result = await executeAll(database, table, config);
            break;
        case 'first':
            result = await executeFirst(database, table, config);
            break;
        case 'find':
            result = await executeFind(database, table, config, config.value);
            break;
        case 'count':
            result = await executeCount(database, table, config);
            break;
        case 'exists':
            result = await executeExists(database, table, config);
            break;
        case 'insert':
            result = await executeInsert(database, table, expectRecord(config.values, 'Invalid insert() values'), config.options);
            break;
        case 'insertMany':
            result = await executeInsertMany(database, table, expectRecordArray(config.values, 'Invalid insertMany() values'), config.options);
            break;
        case 'update':
            result = await executeUpdate(database, table, config, expectRecord(config.changes, 'Invalid update() changes'), config.options);
            break;
        case 'delete':
            result = await executeDelete(database, table, config, config.options);
            break;
        case 'upsert':
            result = await executeUpsert(database, table, expectRecord(config.values, 'Invalid upsert() values'), config.options);
            break;
        default:
            throw new DataTableQueryError('Unknown query execution mode');
    }
    return result;
}
export async function loadRowsWithRelationsForQuery(database, input) {
    let { table, config } = input[querySnapshot]();
    return loadRowsWithRelationsForConfig(database, table, config);
}
export async function loadRowsWithRelationsForConfig(database, table, config) {
    let operation = createSelectOperation(table, config);
    let result = await database[executeOperation](operation);
    let rows = normalizeRows(result.rows);
    if (Object.keys(config.with).length === 0) {
        return rows;
    }
    return loadRelationsForRows(database, table, rows, config.with);
}
async function executeAll(database, table, config) {
    let rows = await loadRowsWithRelationsForConfig(database, table, config);
    return applyAfterReadHooksToLoadedRows(table, rows, config.with);
}
async function executeFirst(database, table, config) {
    let rows = await executeAll(database, table, {
        ...cloneQueryConfig(config),
        limit: 1,
    });
    return rows[0] ?? null;
}
async function executeFind(database, table, config, value) {
    let scopedConfig = cloneQueryConfig(config);
    scopedConfig.where.push(normalizeWhereInput(getFindWhereObject(table, value)));
    return executeFirst(database, table, scopedConfig);
}
async function executeCount(database, table, config) {
    let operation = {
        kind: 'count',
        table,
        joins: [...config.joins],
        where: [...config.where],
        groupBy: [...config.groupBy],
        having: [...config.having],
    };
    let result = await database[executeOperation](operation);
    let count = getNumberField(result.rows, 'count');
    if (count !== undefined) {
        return count;
    }
    if (result.rows) {
        return result.rows.length;
    }
    return 0;
}
async function executeExists(database, table, config) {
    let operation = {
        kind: 'exists',
        table,
        joins: [...config.joins],
        where: [...config.where],
        groupBy: [...config.groupBy],
        having: [...config.having],
    };
    let result = await database[executeOperation](operation);
    let exists = getBooleanField(result.rows, 'exists');
    if (exists !== undefined) {
        return exists;
    }
    let count = getNumberField(result.rows, 'count');
    if (count !== undefined) {
        return count > 0;
    }
    return Boolean(result.rows && result.rows.length > 0);
}
async function executeInsert(database, table, values, options) {
    let preparedValues = prepareInsertValues(table, values, database.now(), options?.touch ?? true);
    let returning = options?.returning;
    assertReturningCapability(database.adapter, 'insert', returning);
    if (returning) {
        let operation = {
            kind: 'insert',
            table,
            values: preparedValues,
            returning: normalizeReturningSelection(returning),
        };
        let result = await database[executeOperation](operation);
        let row = applyAfterReadHooksToRows(table, normalizeRows(result.rows))[0] ?? null;
        let affectedRows = result.affectedRows ?? 0;
        runAfterWriteHook(table, {
            operation: 'create',
            tableName: getTableName(table),
            values: [preparedValues],
            affectedRows,
            insertId: result.insertId,
        });
        return {
            affectedRows,
            insertId: result.insertId,
            row,
        };
    }
    let operation = {
        kind: 'insert',
        table,
        values: preparedValues,
    };
    let result = await database[executeOperation](operation);
    let affectedRows = result.affectedRows ?? 0;
    runAfterWriteHook(table, {
        operation: 'create',
        tableName: getTableName(table),
        values: [preparedValues],
        affectedRows,
        insertId: result.insertId,
    });
    return {
        affectedRows,
        insertId: result.insertId,
    };
}
async function executeInsertMany(database, table, values, options) {
    let preparedValues = values.map((value) => prepareInsertValues(table, value, database.now(), options?.touch ?? true));
    if (preparedValues.length > 0 &&
        preparedValues.every((preparedValue) => Object.keys(preparedValue).length === 0)) {
        throw new DataTableQueryError('insertMany() requires at least one explicit value across the batch');
    }
    let returning = options?.returning;
    assertReturningCapability(database.adapter, 'insertMany', returning);
    if (returning) {
        let operation = {
            kind: 'insertMany',
            table,
            values: preparedValues,
            returning: normalizeReturningSelection(returning),
        };
        let result = await database[executeOperation](operation);
        let affectedRows = result.affectedRows ?? 0;
        runAfterWriteHook(table, {
            operation: 'create',
            tableName: getTableName(table),
            values: preparedValues,
            affectedRows,
            insertId: result.insertId,
        });
        return {
            affectedRows,
            insertId: result.insertId,
            rows: applyAfterReadHooksToRows(table, normalizeRows(result.rows)),
        };
    }
    let operation = {
        kind: 'insertMany',
        table,
        values: preparedValues,
    };
    let result = await database[executeOperation](operation);
    let affectedRows = result.affectedRows ?? 0;
    runAfterWriteHook(table, {
        operation: 'create',
        tableName: getTableName(table),
        values: preparedValues,
        affectedRows,
        insertId: result.insertId,
    });
    return {
        affectedRows,
        insertId: result.insertId,
    };
}
async function executeUpdate(database, table, config, changes, options) {
    let returning = options?.returning;
    assertReturningCapability(database.adapter, 'update', returning);
    let preparedChanges = prepareUpdateValues(table, changes, database.now(), options?.touch ?? true);
    if (Object.keys(preparedChanges).length === 0) {
        throw new DataTableQueryError('update() requires at least one change');
    }
    let result = await executeScopedWriteOperation(database, table, config, returning, (where) => ({
        kind: 'update',
        table,
        changes: preparedChanges,
        where,
        returning: returning ? normalizeReturningSelection(returning) : undefined,
    }));
    let affectedRows = result.affectedRows ?? 0;
    runAfterWriteHook(table, {
        operation: 'update',
        tableName: getTableName(table),
        values: [preparedChanges],
        affectedRows,
        insertId: result.insertId,
    });
    if (!returning) {
        return {
            affectedRows,
            insertId: result.insertId,
        };
    }
    return {
        affectedRows,
        insertId: result.insertId,
        rows: applyAfterReadHooksToRows(table, normalizeRows(result.rows)),
    };
}
async function executeDelete(database, table, config, options) {
    let returning = options?.returning;
    assertReturningCapability(database.adapter, 'delete', returning);
    let tableName = getTableName(table);
    let deleteContext = {
        tableName,
        where: [...config.where],
        orderBy: [...config.orderBy],
        limit: config.limit,
        offset: config.offset,
    };
    runBeforeDeleteHook(table, deleteContext);
    let result = await executeScopedWriteOperation(database, table, config, returning, (where) => ({
        kind: 'delete',
        table,
        where,
        returning: returning ? normalizeReturningSelection(returning) : undefined,
    }));
    let affectedRows = result.affectedRows ?? 0;
    runAfterDeleteHook(table, {
        tableName,
        where: deleteContext.where,
        orderBy: deleteContext.orderBy,
        limit: deleteContext.limit,
        offset: deleteContext.offset,
        affectedRows,
    });
    if (!returning) {
        return {
            affectedRows,
            insertId: result.insertId,
        };
    }
    return {
        affectedRows,
        insertId: result.insertId,
        rows: applyAfterReadHooksToRows(table, normalizeRows(result.rows)),
    };
}
async function executeUpsert(database, table, values, options) {
    if (!database.adapter.capabilities.upsert) {
        throw new DataTableQueryError('Adapter does not support upsert');
    }
    let preparedValues = prepareInsertValues(table, values, database.now(), options?.touch ?? true);
    let updateChanges = options?.update
        ? prepareUpdateValues(table, options.update, database.now(), options?.touch ?? true, 'create')
        : undefined;
    let returning = options?.returning;
    assertReturningCapability(database.adapter, 'upsert', returning);
    if (returning) {
        let operation = {
            kind: 'upsert',
            table,
            values: preparedValues,
            conflictTarget: options?.conflictTarget ? [...options.conflictTarget] : undefined,
            update: updateChanges,
            returning: normalizeReturningSelection(returning),
        };
        let result = await database[executeOperation](operation);
        let row = applyAfterReadHooksToRows(table, normalizeRows(result.rows))[0] ?? null;
        let affectedRows = result.affectedRows ?? 0;
        let preparedWriteValues = updateChanges ? [preparedValues, updateChanges] : [preparedValues];
        runAfterWriteHook(table, {
            operation: 'create',
            tableName: getTableName(table),
            values: preparedWriteValues,
            affectedRows,
            insertId: result.insertId,
        });
        return {
            affectedRows,
            insertId: result.insertId,
            row,
        };
    }
    let operation = {
        kind: 'upsert',
        table,
        values: preparedValues,
        conflictTarget: options?.conflictTarget ? [...options.conflictTarget] : undefined,
        update: updateChanges,
    };
    let result = await database[executeOperation](operation);
    let affectedRows = result.affectedRows ?? 0;
    let preparedWriteValues = updateChanges ? [preparedValues, updateChanges] : [preparedValues];
    runAfterWriteHook(table, {
        operation: 'create',
        tableName: getTableName(table),
        values: preparedWriteValues,
        affectedRows,
        insertId: result.insertId,
    });
    return {
        affectedRows,
        insertId: result.insertId,
    };
}
function cloneSelection(selection) {
    if (selection === '*') {
        return '*';
    }
    return selection.map((column) => ({ ...column }));
}
function createSelectOperation(table, config) {
    let clonedConfig = cloneQueryConfig(config);
    return {
        kind: 'select',
        table,
        select: cloneSelection(clonedConfig.select),
        distinct: clonedConfig.distinct,
        joins: clonedConfig.joins,
        where: clonedConfig.where,
        groupBy: clonedConfig.groupBy,
        having: clonedConfig.having,
        orderBy: clonedConfig.orderBy,
        limit: clonedConfig.limit,
        offset: clonedConfig.offset,
    };
}
function normalizeRows(rows) {
    if (!rows) {
        return [];
    }
    return rows.map((row) => ({ ...row }));
}
async function executeScopedWriteOperation(database, table, config, returning, createOperation) {
    if (!hasScopedWriteModifiers(config)) {
        return database[executeOperation](createOperation([...config.where]));
    }
    return database.transaction(async (tx) => {
        let primaryKeys = await loadPrimaryKeyRowsForScope(tx, table, config);
        let primaryKeyPredicate = buildPrimaryKeyPredicate(table, primaryKeys);
        if (!primaryKeyPredicate) {
            return {
                affectedRows: 0,
                insertId: undefined,
                rows: returning ? [] : undefined,
            };
        }
        return tx[executeOperation](createOperation([primaryKeyPredicate]));
    });
}
function expectRecord(value, errorMessage) {
    if (isRecord(value)) {
        return value;
    }
    throw new DataTableQueryError(errorMessage);
}
function expectRecordArray(value, errorMessage) {
    if (Array.isArray(value) && value.every(isRecord)) {
        return value;
    }
    throw new DataTableQueryError(errorMessage);
}
function getBooleanField(rows, key) {
    if (!rows || !rows[0] || typeof rows[0][key] !== 'boolean') {
        return undefined;
    }
    return rows[0][key];
}
function getNumberField(rows, key) {
    if (!rows || !rows[0] || typeof rows[0][key] !== 'number') {
        return undefined;
    }
    return rows[0][key];
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function getFindWhereObject(table, value) {
    let primaryKey = getTablePrimaryKey(table);
    if (primaryKey.length === 1 && !isRecord(value)) {
        return { [primaryKey[0]]: value };
    }
    if (!isRecord(value)) {
        throw new DataTableQueryError('Composite primary keys require an object value');
    }
    let tableName = getTableName(table);
    let output = {};
    for (let column of primaryKey) {
        if (!(column in value)) {
            throw new DataTableQueryError('Missing key "' + column + '" for primary key lookup on "' + tableName + '"');
        }
        output[column] = value[column];
    }
    return output;
}
