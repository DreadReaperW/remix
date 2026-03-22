import { getTablePrimaryKey } from '@remix-run/data-table/adapter';
import { compilePostgresMigrationOperations as compilePostgresMigrationOperationsFromCompiler } from "./migration-compiler.js";
import { compilePostgresOperation } from "./sql-compiler.js";
import { quoteIdentifier, quoteTableRef } from "./sql-compiler-helpers.js";
/**
 * `DatabaseAdapter` implementation for postgres-compatible clients.
 */
export class PostgresDatabaseAdapter {
    /**
     * The SQL dialect identifier reported by this adapter.
     */
    dialect = 'postgres';
    /**
     * Feature flags describing the postgres behaviors supported by this adapter.
     */
    capabilities;
    #client;
    #transactions = new Map();
    #transactionCounter = 0;
    constructor(client, options) {
        this.#client = client;
        this.capabilities = {
            returning: options?.capabilities?.returning ?? true,
            savepoints: options?.capabilities?.savepoints ?? true,
            upsert: options?.capabilities?.upsert ?? true,
            transactionalDdl: options?.capabilities?.transactionalDdl ?? true,
            migrationLock: options?.capabilities?.migrationLock ?? true,
        };
    }
    /**
     * Compiles a data or migration operation to postgres SQL statements.
     * @param operation Operation to compile.
     * @returns Compiled SQL statements.
     */
    compileSql(operation) {
        switch (operation.kind) {
            case 'select':
            case 'count':
            case 'exists':
            case 'insert':
            case 'insertMany':
            case 'update':
            case 'delete':
            case 'upsert':
            case 'raw': {
                let compiled = compilePostgresOperation(operation);
                return [{ text: compiled.text, values: compiled.values }];
            }
            default:
                return compilePostgresMigrationOperationsFromCompiler(operation);
        }
    }
    /**
     * Executes a postgres data-manipulation request.
     * @param request Request to execute.
     * @returns Execution result.
     */
    async execute(request) {
        if (request.operation.kind === 'insertMany' && request.operation.values.length === 0) {
            return {
                affectedRows: 0,
                insertId: undefined,
                rows: request.operation.returning ? [] : undefined,
            };
        }
        let statement = compilePostgresOperation(request.operation);
        let client = this.#resolveClient(request.transaction);
        let result = await client.query(statement.text, statement.values);
        let rows = normalizeRows(result.rows);
        if (request.operation.kind === 'count' || request.operation.kind === 'exists') {
            rows = normalizeCountRows(rows);
        }
        return {
            rows,
            affectedRows: normalizeAffectedRows(request.operation.kind, result.rowCount, rows),
            insertId: normalizeInsertId(request.operation, rows),
        };
    }
    /**
     * Executes postgres migration operations.
     * @param request Migration request to execute.
     * @returns Migration result.
     */
    async migrate(request) {
        let statements = this.compileSql(request.operation);
        let client = this.#resolveClient(request.transaction);
        for (let statement of statements) {
            await client.query(statement.text, statement.values);
        }
        return {
            affectedOperations: statements.length,
        };
    }
    /**
     * Checks whether a table exists in postgres.
     * @param table Table reference to inspect.
     * @param transaction Optional transaction token.
     * @returns `true` when the table exists.
     */
    async hasTable(table, transaction) {
        let relation = quoteTableRef(table);
        let client = this.#resolveClient(transaction);
        let result = await client.query('select to_regclass($1) is not null as "exists"', [relation]);
        return toBooleanExists(normalizeRows(result.rows)[0]?.exists);
    }
    /**
     * Checks whether a column exists in postgres.
     * @param table Table reference to inspect.
     * @param column Column name to look up.
     * @param transaction Optional transaction token.
     * @returns `true` when the column exists.
     */
    async hasColumn(table, column, transaction) {
        let relation = quoteTableRef(table);
        let client = this.#resolveClient(transaction);
        let result = await client.query('select exists (select 1 from pg_attribute where attrelid = to_regclass($1) and attname = $2 and attnum > 0 and not attisdropped) as "exists"', [relation, column]);
        return toBooleanExists(normalizeRows(result.rows)[0]?.exists);
    }
    /**
     * Starts a postgres transaction.
     * @param options Transaction options.
     * @returns Transaction token.
     */
    async beginTransaction(options) {
        let releaseOnClose = false;
        let transactionClient;
        if (isPostgresPool(this.#client)) {
            transactionClient = await this.#client.connect();
            releaseOnClose = true;
        }
        else {
            transactionClient = this.#client;
        }
        await transactionClient.query('begin');
        if (options?.isolationLevel || options?.readOnly !== undefined) {
            await transactionClient.query(buildSetTransactionStatement(options));
        }
        this.#transactionCounter += 1;
        let token = { id: 'tx_' + String(this.#transactionCounter) };
        this.#transactions.set(token.id, {
            client: transactionClient,
            releaseOnClose,
        });
        return token;
    }
    /**
     * Commits an open postgres transaction.
     * @param token Transaction token to commit.
     * @returns A promise that resolves when the transaction is committed.
     */
    async commitTransaction(token) {
        let transaction = this.#transactions.get(token.id);
        if (!transaction) {
            throw new Error('Unknown transaction token: ' + token.id);
        }
        try {
            await transaction.client.query('commit');
        }
        finally {
            this.#transactions.delete(token.id);
            if (transaction.releaseOnClose) {
                releasePostgresClient(transaction.client);
            }
        }
    }
    /**
     * Rolls back an open postgres transaction.
     * @param token Transaction token to roll back.
     * @returns A promise that resolves when the transaction is rolled back.
     */
    async rollbackTransaction(token) {
        let transaction = this.#transactions.get(token.id);
        if (!transaction) {
            throw new Error('Unknown transaction token: ' + token.id);
        }
        try {
            await transaction.client.query('rollback');
        }
        finally {
            this.#transactions.delete(token.id);
            if (transaction.releaseOnClose) {
                releasePostgresClient(transaction.client);
            }
        }
    }
    /**
     * Creates a savepoint in an open postgres transaction.
     * @param token Transaction token to use.
     * @param name Savepoint name.
     * @returns A promise that resolves when the savepoint is created.
     */
    async createSavepoint(token, name) {
        let client = this.#transactionClient(token);
        await client.query('savepoint ' + quoteIdentifier(name));
    }
    /**
     * Rolls back to a savepoint in an open postgres transaction.
     * @param token Transaction token to use.
     * @param name Savepoint name.
     * @returns A promise that resolves when the rollback completes.
     */
    async rollbackToSavepoint(token, name) {
        let client = this.#transactionClient(token);
        await client.query('rollback to savepoint ' + quoteIdentifier(name));
    }
    /**
     * Releases a savepoint in an open postgres transaction.
     * @param token Transaction token to use.
     * @param name Savepoint name.
     * @returns A promise that resolves when the savepoint is released.
     */
    async releaseSavepoint(token, name) {
        let client = this.#transactionClient(token);
        await client.query('release savepoint ' + quoteIdentifier(name));
    }
    /**
     * Acquires the postgres migration lock.
     * @returns A promise that resolves when the lock is acquired.
     */
    async acquireMigrationLock() {
        await this.#client.query('select pg_advisory_lock(hashtext($1))', ['data_table_migrations']);
    }
    /**
     * Releases the postgres migration lock.
     * @returns A promise that resolves when the lock is released.
     */
    async releaseMigrationLock() {
        await this.#client.query('select pg_advisory_unlock(hashtext($1))', ['data_table_migrations']);
    }
    #resolveClient(token) {
        if (!token) {
            return this.#client;
        }
        return this.#transactionClient(token);
    }
    #transactionClient(token) {
        let transaction = this.#transactions.get(token.id);
        if (!transaction) {
            throw new Error('Unknown transaction token: ' + token.id);
        }
        return transaction.client;
    }
}
/**
 * Creates a postgres `DatabaseAdapter`.
 * @param client `pg` pool or pool client.
 * @param options Optional adapter capability overrides.
 * @returns A configured postgres adapter.
 * @example
 * ```ts
 * import { Pool } from 'pg'
 * import { createDatabase } from 'remix/data-table'
 * import { createPostgresDatabaseAdapter } from 'remix/data-table-postgres'
 *
 * let pool = new Pool({ connectionString: process.env.DATABASE_URL })
 * let adapter = createPostgresDatabaseAdapter(pool)
 * let db = createDatabase(adapter)
 * ```
 */
export function createPostgresDatabaseAdapter(client, options) {
    return new PostgresDatabaseAdapter(client, options);
}
function isPostgresPool(client) {
    return 'connect' in client && typeof client.connect === 'function';
}
function releasePostgresClient(client) {
    if (!hasReleaseMethod(client)) {
        return;
    }
    client.release();
}
function buildSetTransactionStatement(options) {
    let parts = ['set transaction'];
    if (options.isolationLevel) {
        parts.push('isolation level ' + options.isolationLevel);
    }
    if (options.readOnly !== undefined) {
        parts.push(options.readOnly ? 'read only' : 'read write');
    }
    return parts.join(' ');
}
function normalizeRows(rows) {
    return rows.map(copyRecord);
}
function normalizeCountRows(rows) {
    return rows.map((row) => {
        let count = row.count;
        if (typeof count === 'string') {
            let numeric = Number(count);
            if (!Number.isNaN(numeric)) {
                return {
                    ...row,
                    count: numeric,
                };
            }
        }
        if (typeof count === 'bigint') {
            return {
                ...row,
                count: Number(count),
            };
        }
        return row;
    });
}
function normalizeAffectedRows(kind, rowCount, rows) {
    if (kind === 'select' || kind === 'count' || kind === 'exists') {
        return undefined;
    }
    if (rowCount !== null) {
        return rowCount;
    }
    if (kind === 'raw') {
        return undefined;
    }
    return rows.length;
}
function normalizeInsertId(operation, rows) {
    if (operation.kind !== 'insert' &&
        operation.kind !== 'insertMany' &&
        operation.kind !== 'upsert') {
        return undefined;
    }
    let primaryKey = getTablePrimaryKey(operation.table);
    if (primaryKey.length !== 1) {
        return undefined;
    }
    let key = primaryKey[0];
    let row = rows[rows.length - 1];
    return row ? row[key] : undefined;
}
function toBooleanExists(value) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return value > 0;
    }
    if (typeof value === 'string') {
        return value === 't' || value === 'true' || value === '1';
    }
    return false;
}
function copyRecord(value) {
    if (typeof value !== 'object' || value === null) {
        return {};
    }
    let record = {};
    for (let [key, entry] of Object.entries(value)) {
        record[key] = entry;
    }
    return record;
}
function hasReleaseMethod(client) {
    return 'release' in client && typeof client.release === 'function';
}
