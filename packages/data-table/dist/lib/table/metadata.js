import { tableMetadataKey } from "../references.js";
/**
 * Creates a plain table reference snapshot from a table instance.
 * @param table Source table instance.
 * @returns Table metadata snapshot.
 */
export function getTableReference(table) {
    let metadata = getTableMetadata(table);
    return {
        kind: 'table',
        name: metadata.name,
        columns: metadata.columns,
        primaryKey: metadata.primaryKey,
        timestamps: metadata.timestamps,
    };
}
/**
 * Returns a table's SQL name.
 * @param table Source table instance.
 * @returns Table SQL name.
 */
export function getTableName(table) {
    return getTableMetadata(table).name;
}
/**
 * Returns a table's column builder map.
 * @param table Source table instance.
 * @returns Table column builder map.
 */
export function getTableColumns(table) {
    return getTableMetadata(table).columns;
}
/**
 * Returns a table's resolved physical column definitions.
 * @param table Source table instance.
 * @returns Column definition map.
 */
export function getTableColumnDefinitions(table) {
    return getTableMetadata(table).columnDefinitions;
}
/**
 * Returns a table's optional write validator.
 * @param table Source table instance.
 * @returns Validation function or `undefined`.
 */
export function getTableValidator(table) {
    return getTableMetadata(table).validate;
}
/**
 * Returns a table's optional before-write lifecycle callback.
 * @param table Source table instance.
 * @returns Before-write callback or `undefined`.
 */
export function getTableBeforeWrite(table) {
    return getTableMetadata(table).beforeWrite;
}
/**
 * Returns a table's optional after-write lifecycle callback.
 * @param table Source table instance.
 * @returns After-write callback or `undefined`.
 */
export function getTableAfterWrite(table) {
    return getTableMetadata(table).afterWrite;
}
/**
 * Returns a table's optional before-delete lifecycle callback.
 * @param table Source table instance.
 * @returns Before-delete callback or `undefined`.
 */
export function getTableBeforeDelete(table) {
    return getTableMetadata(table).beforeDelete;
}
/**
 * Returns a table's optional after-delete lifecycle callback.
 * @param table Source table instance.
 * @returns After-delete callback or `undefined`.
 */
export function getTableAfterDelete(table) {
    return getTableMetadata(table).afterDelete;
}
/**
 * Returns a table's optional after-read lifecycle callback.
 * The callback receives the current read shape, which may be a projected partial row.
 * @param table Source table instance.
 * @returns After-read callback or `undefined`.
 */
export function getTableAfterRead(table) {
    return getTableMetadata(table).afterRead;
}
/**
 * Returns a table's primary key columns.
 * @param table Source table instance.
 * @returns Primary key columns.
 */
export function getTablePrimaryKey(table) {
    return getTableMetadata(table).primaryKey;
}
/**
 * Returns a table's resolved timestamp configuration.
 * @param table Source table instance.
 * @returns Timestamp configuration or `null`.
 */
export function getTableTimestamps(table) {
    return getTableMetadata(table).timestamps;
}
function getTableMetadata(table) {
    return table[tableMetadataKey];
}
