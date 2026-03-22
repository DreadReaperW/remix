/**
 * Symbol key used to store non-enumerable table metadata.
 */
export { columnMetadataKey, tableMetadataKey } from "./references.js";
export { getTableAfterDelete, getTableAfterRead, getTableAfterWrite, getTableBeforeDelete, getTableBeforeWrite, getTableColumnDefinitions, getTableColumns, getTableName, getTablePrimaryKey, getTableReference, getTableTimestamps, getTableValidator, } from "./table/metadata.js";
export { table } from "./table/factory.js";
