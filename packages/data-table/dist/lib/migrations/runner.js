import { createDatabase, Database } from "../database.js";
import { deleteJournalRow, ensureMigrationJournal, getBatch, hasMigrationJournal, insertJournalRow, loadJournalRows, normalizeChecksum, } from "./journal-store.js";
import { createDryRunDatabase } from "./dry-run-database.js";
import { assertMigrateOptions, assertNoMigrationDrift, assertStepOption, assertTargetOption, createMigrationStatusEntries, listMigrations, selectMigrationsToRun, } from "./planning.js";
import { createMigrationSchema } from "./schema-api.js";
async function runMigrations(input) {
    let adapter = input.adapter;
    let migrations = input.migrations;
    let journalTable = input.journalTable;
    let dryRun = Boolean(input.options.dryRun);
    let target = input.options.to;
    let step = input.options.step;
    assertMigrateOptions(input.options);
    assertStepOption(step);
    assertTargetOption(migrations, target);
    let sql = [];
    await adapter.acquireMigrationLock?.();
    try {
        let journal = [];
        if (dryRun) {
            let canReadJournal = await hasMigrationJournal(adapter, journalTable);
            if (canReadJournal) {
                journal = await loadJournalRows(adapter, journalTable);
            }
        }
        else {
            await ensureMigrationJournal(adapter, journalTable);
            journal = await loadJournalRows(adapter, journalTable);
        }
        assertNoMigrationDrift(migrations, journal);
        let toRun = selectMigrationsToRun(input.direction, migrations, journal, input.options);
        let applied = [];
        let reverted = [];
        let batch = getBatch(journal);
        for (let migration of toRun) {
            if (migration.migration.transaction === 'required' &&
                !adapter.capabilities.transactionalDdl) {
                throw new Error('Migration "' +
                    migration.id +
                    '" requires transactional DDL, but adapter does not support it');
            }
            let shouldUseTransaction = !dryRun &&
                migration.migration.transaction !== 'none' &&
                adapter.capabilities.transactionalDdl;
            let token;
            if (shouldUseTransaction) {
                token = await adapter.beginTransaction();
            }
            let db = dryRun
                ? createDryRunDatabase(adapter)
                : token
                    ? new Database(adapter, {
                        token,
                        savepointCounter: { value: 0 },
                    })
                    : createDatabase(adapter);
            let schema = createMigrationSchema(db, async (operation) => {
                let compiled = adapter.compileSql(operation);
                sql.push(...compiled);
                if (!dryRun) {
                    await adapter.migrate({ operation, transaction: token });
                }
            }, { transaction: token });
            let context = {
                db,
                schema,
            };
            try {
                if (input.direction === 'up') {
                    await migration.migration.up(context);
                    if (!dryRun) {
                        await insertJournalRow(adapter, journalTable, buildJournalRow(migration, batch), token);
                    }
                    applied.push({
                        id: migration.id,
                        name: migration.name,
                        status: 'applied',
                    });
                }
                else {
                    await migration.migration.down(context);
                    if (!dryRun) {
                        await deleteJournalRow(adapter, journalTable, migration.id, token);
                    }
                    reverted.push({
                        id: migration.id,
                        name: migration.name,
                        status: 'pending',
                    });
                }
                if (token) {
                    await adapter.commitTransaction(token);
                }
            }
            catch (error) {
                if (token) {
                    await adapter.rollbackTransaction(token);
                }
                throw error;
            }
        }
        return {
            applied,
            reverted,
            sql,
        };
    }
    finally {
        await adapter.releaseMigrationLock?.();
    }
}
/**
 * Creates a migration runner for applying/reverting migrations against an adapter.
 * @param adapter Database adapter used to compile and execute migration operations.
 * @param migrations Migration descriptors or registry.
 * @param options Optional runner configuration.
 * @returns A migration runner instance.
 * @example
 * ```ts
 * import { createMigrationRunner } from 'remix/data-table/migrations'
 *
 * let runner = createMigrationRunner(adapter, migrations, {
 *   journalTable: 'app_migrations',
 * })
 * await runner.up()
 * ```
 */
export function createMigrationRunner(adapter, migrations, options = {}) {
    let journalTable = options.journalTable ?? 'data_table_migrations';
    return {
        async up(runOptions = {}) {
            return runMigrations({
                adapter,
                migrations: listMigrations(migrations),
                journalTable,
                direction: 'up',
                options: runOptions,
            });
        },
        async down(runOptions = {}) {
            return runMigrations({
                adapter,
                migrations: listMigrations(migrations),
                journalTable,
                direction: 'down',
                options: runOptions,
            });
        },
        async status() {
            await ensureMigrationJournal(adapter, journalTable);
            let journal = await loadJournalRows(adapter, journalTable);
            let sortedMigrations = listMigrations(migrations);
            return createMigrationStatusEntries(sortedMigrations, journal);
        },
    };
}
function buildJournalRow(migration, batch) {
    return {
        id: migration.id,
        name: migration.name,
        checksum: normalizeChecksum(migration),
        batch,
    };
}
