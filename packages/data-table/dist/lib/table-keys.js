import { getTableName, getTablePrimaryKey } from "./table/metadata.js";
/**
 * Normalizes a primary-key input into an object keyed by primary-key columns.
 * @param table Source table.
 * @param value Primary-key input value.
 * @returns Primary-key object.
 */
export function getPrimaryKeyObject(table, value) {
    let keys = getTablePrimaryKey(table);
    if (keys.length === 1) {
        if (!isPlainObject(value)) {
            return createPrimaryKeyObject(keys[0], value);
        }
    }
    if (!isPlainObject(value)) {
        throw new Error('Composite primary keys require an object value');
    }
    let objectValue = value;
    let output = {};
    for (let key of keys) {
        if (!(key in objectValue)) {
            throw new Error('Missing key "' + key + '" for primary key lookup on "' + getTableName(table) + '"');
        }
        Object.assign(output, { [key]: objectValue[key] });
    }
    return output;
}
function createPrimaryKeyObject(key, value) {
    let output = {};
    output[key] = value;
    return output;
}
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/**
 * Builds a stable key for a row tuple.
 * @param row Source row.
 * @param columns Columns included in the tuple.
 * @returns Stable tuple key.
 */
export function getCompositeKey(row, columns) {
    let values = columns.map((column) => {
        let value = row[column];
        if (value === null) {
            return 'null';
        }
        if (value === undefined) {
            return 'undefined';
        }
        if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
            return String(value);
        }
        if (typeof value === 'string') {
            return JSON.stringify(value);
        }
        if (value instanceof Date) {
            return 'date:' + value.toISOString();
        }
        return JSON.stringify(value);
    });
    return values.join('::');
}
