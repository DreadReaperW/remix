import { DataTableAdapterError, DataTableQueryError } from "./errors.js";
import { executeOperation } from "./database/execution-context.js";
import { executeQuery } from "./database/query-execution.js";
import { isSqlStatement } from "./sql.js";
/**
 * High-level database runtime used to build and execute data manipulation operations.
 *
 * Create instances directly with `new Database(adapter, options)` or use
 * `createDatabase(adapter, options)` as a thin wrapper.
 */
export class Database {
    #adapter;
    #token;
    #now;
    #savepointCounter;
    constructor(adapter, options) {
        this.#adapter = adapter;
        this.#now = options?.now ?? defaultNow;
        this.#token = options?.token;
        this.#savepointCounter = options?.savepointCounter ?? { value: 0 };
    }
    get adapter() {
        return this.#adapter;
    }
    now() {
        return this.#now();
    }
    async exec(statementOrInput, values = []) {
        if (typeof statementOrInput === 'string' || isSqlStatement(statementOrInput)) {
            let sqlStatement = typeof statementOrInput === 'string'
                ? { text: statementOrInput, values }
                : statementOrInput;
            return this[executeOperation]({
                kind: 'raw',
                sql: sqlStatement,
            });
        }
        return executeQuery(this, statementOrInput);
    }
    async transaction(callback, options) {
        if (!this.#token) {
            let token = await this.#adapter.beginTransaction(options);
            let tx = new Database(this.#adapter, {
                now: this.#now,
                token,
                savepointCounter: this.#savepointCounter,
            });
            try {
                let result = await callback(tx);
                await this.#adapter.commitTransaction(token);
                return result;
            }
            catch (error) {
                await this.#adapter.rollbackTransaction(token);
                throw error;
            }
        }
        if (!this.#adapter.capabilities.savepoints) {
            throw new DataTableQueryError('Nested transactions require adapter savepoint support');
        }
        let savepointName = 'sp_' + String(this.#savepointCounter.value);
        this.#savepointCounter.value += 1;
        await this.#adapter.createSavepoint(this.#token, savepointName);
        try {
            let result = await callback(this);
            await this.#adapter.releaseSavepoint(this.#token, savepointName);
            return result;
        }
        catch (error) {
            await this.#adapter.rollbackToSavepoint(this.#token, savepointName);
            await this.#adapter.releaseSavepoint(this.#token, savepointName);
            throw error;
        }
    }
    async [executeOperation](operation) {
        try {
            return await this.#adapter.execute({
                operation,
                transaction: this.#token,
            });
        }
        catch (error) {
            throw new DataTableAdapterError('Adapter execution failed', {
                cause: error,
                metadata: {
                    dialect: this.#adapter.dialect,
                    operationKind: operation.kind,
                },
            });
        }
    }
}
/**
 * Creates a database runtime from an adapter.
 * Thin wrapper around `new Database(adapter, options)`.
 * @param adapter Adapter implementation responsible for SQL execution.
 * @param options Optional runtime options.
 * @param options.now Clock function used for auto-managed timestamps.
 * @returns A {@link Database} API instance.
 * @example
 * ```ts
 * import { column as c, createDatabase, table } from 'remix/data-table'
 *
 * let users = table({
 *   name: 'users',
 *   columns: {
 *     id: c.integer(),
 *     email: c.varchar(255),
 *   },
 * })
 *
 * let db = createDatabase(adapter)
 * let rows = await db.exec(query(users).where({ id: 1 }).all())
 * ```
 */
export function createDatabase(adapter, options) {
    return new Database(adapter, options);
}
function defaultNow() {
    return new Date();
}
