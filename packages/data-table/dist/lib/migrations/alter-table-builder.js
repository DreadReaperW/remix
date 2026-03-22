import { createCheckName, createPrimaryKeyName, createUniqueName, normalizeKeyColumns, } from "./helpers.js";
import { createForeignKeyConstraint, createCheckConstraint, createIndexOperationForTableRef, toMigrationColumnDefinition, } from "./schema-operations.js";
export class AlterTableBuilderRuntime {
    alterChanges = [];
    extraStatements = [];
    table;
    constructor(table) {
        this.table = table;
    }
    addColumn(name, definition) {
        this.alterChanges.push({
            kind: 'addColumn',
            column: name,
            definition: toMigrationColumnDefinition(definition),
        });
    }
    changeColumn(name, definition) {
        this.alterChanges.push({
            kind: 'changeColumn',
            column: name,
            definition: toMigrationColumnDefinition(definition),
        });
    }
    renameColumn(from, to) {
        this.alterChanges.push({ kind: 'renameColumn', from, to });
    }
    dropColumn(name, options) {
        this.alterChanges.push({ kind: 'dropColumn', column: name, ifExists: options?.ifExists });
    }
    addPrimaryKey(columns, options) {
        let normalizedColumns = normalizeKeyColumns(columns);
        this.alterChanges.push({
            kind: 'addPrimaryKey',
            constraint: {
                columns: normalizedColumns,
                name: options?.name ?? createPrimaryKeyName(this.table),
            },
        });
    }
    dropPrimaryKey(name) {
        this.alterChanges.push({ kind: 'dropPrimaryKey', name });
    }
    addUnique(columns, options) {
        let normalizedColumns = normalizeKeyColumns(columns);
        this.alterChanges.push({
            kind: 'addUnique',
            constraint: {
                columns: normalizedColumns,
                name: options?.name ?? createUniqueName(this.table, normalizedColumns),
            },
        });
    }
    dropUnique(name) {
        this.alterChanges.push({ kind: 'dropUnique', name });
    }
    addForeignKey(columns, refTable, refColumns, options) {
        this.alterChanges.push({
            kind: 'addForeignKey',
            constraint: createForeignKeyConstraint(this.table, columns, refTable, refColumns, options),
        });
    }
    dropForeignKey(name) {
        this.alterChanges.push({ kind: 'dropForeignKey', name });
    }
    addCheck(expression, options) {
        this.alterChanges.push({
            kind: 'addCheck',
            constraint: createCheckConstraint(this.table, expression, options),
        });
    }
    dropCheck(name) {
        this.alterChanges.push({ kind: 'dropCheck', name });
    }
    addIndex(columns, options) {
        this.extraStatements.push(createIndexOperationForTableRef(this.table, columns, options));
    }
    dropIndex(name) {
        this.extraStatements.push({
            kind: 'dropIndex',
            table: this.table,
            name,
        });
    }
    comment(text) {
        this.alterChanges.push({ kind: 'setTableComment', comment: text });
    }
}
