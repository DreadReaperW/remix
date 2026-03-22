import { createDatabase } from "../database.js";
export function createDryRunDatabase(adapter) {
    let error = new Error('Cannot execute data operations while running migrations with dryRun');
    let throwDryRunError = async () => {
        throw error;
    };
    let dryRunAdapter = {
        dialect: adapter.dialect,
        capabilities: adapter.capabilities,
        compileSql(operation) {
            return adapter.compileSql(operation);
        },
        async hasTable(table) {
            return adapter.hasTable(table);
        },
        async hasColumn(table, column) {
            return adapter.hasColumn(table, column);
        },
        execute: throwDryRunError,
        migrate: throwDryRunError,
        beginTransaction: throwDryRunError,
        commitTransaction: throwDryRunError,
        rollbackTransaction: throwDryRunError,
        createSavepoint: throwDryRunError,
        rollbackToSavepoint: throwDryRunError,
        releaseSavepoint: throwDryRunError,
    };
    return createDatabase(dryRunAdapter);
}
