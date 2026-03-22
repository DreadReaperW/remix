/**
 * Symbol key used to store non-enumerable table metadata.
 */
export const tableMetadataKey = Symbol('data-table.tableMetadata');
/**
 * Symbol key used to store non-enumerable column metadata.
 */
export const columnMetadataKey = Symbol('data-table.columnMetadata');
/**
 * Returns `true` when a value is a `data-table` column reference.
 * @param value Value to inspect.
 * @returns Whether the value is a column reference object.
 */
export function isColumnReference(value) {
    return (typeof value === 'object' &&
        value !== null &&
        'kind' in value &&
        value.kind === 'column' &&
        columnMetadataKey in value);
}
export function normalizeColumnInput(input) {
    if (typeof input === 'string') {
        return input;
    }
    return input[columnMetadataKey].qualifiedName;
}
