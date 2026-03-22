import { normalizeColumnInput } from "./references.js";
import { assertWriteState, createPredicateColumnResolver, normalizePredicateValues, normalizeQueryWhereInput, } from "./query/predicate.js";
import { cloneQueryConfig, createInitialQueryConfig, mergeQueryConfig } from "./query/config.js";
import { normalizeSelection } from "./query/selection.js";
export const querySnapshot = Symbol('querySnapshot');
export class Query {
    #table;
    #config;
    constructor(table) {
        this.#table = table;
        this.#config = createInitialQueryConfig();
    }
    static #createInternal(table, config) {
        let output = new Query(table);
        output.#config = cloneQueryConfig(config);
        return output;
    }
    select(...input) {
        return this.#clone({ select: normalizeSelection(input) });
    }
    distinct(value = true) {
        return this.#clone({ distinct: value });
    }
    where(input) {
        return this.#clone({
            where: [...this.#config.where, normalizeQueryWhereInput(input, this.#predicateTables())],
        });
    }
    having(input) {
        return this.#clone({
            having: [...this.#config.having, normalizeQueryWhereInput(input, this.#predicateTables())],
        });
    }
    join(target, on, type = 'inner') {
        let normalizedOn = normalizePredicateValues(on, createPredicateColumnResolver([...this.#predicateTables(), target]));
        return this.#clone({
            joins: [...this.#config.joins, { type, table: target, on: normalizedOn }],
        });
    }
    leftJoin(target, on) {
        return this.join(target, on, 'left');
    }
    rightJoin(target, on) {
        return this.join(target, on, 'right');
    }
    orderBy(column, direction = 'asc') {
        return this.#clone({
            orderBy: [...this.#config.orderBy, { column: normalizeColumnInput(column), direction }],
        });
    }
    groupBy(...columns) {
        return this.#clone({
            groupBy: [...this.#config.groupBy, ...columns.map((column) => normalizeColumnInput(column))],
        });
    }
    limit(value) {
        return this.#clone({ limit: value });
    }
    offset(value) {
        return this.#clone({ offset: value });
    }
    with(relations) {
        return this.#clone({
            with: {
                ...this.#config.with,
                ...relations,
            },
        });
    }
    all() {
        return this.#withConfig({ ...this.#config, kind: 'all' });
    }
    first() {
        return this.#resolveTerminal({ ...this.#config, kind: 'first' });
    }
    find(value) {
        return this.#resolveTerminal({ ...this.#config, kind: 'find', value });
    }
    count() {
        return this.#resolveTerminal({ ...this.#config, kind: 'count' });
    }
    exists() {
        return this.#resolveTerminal({ ...this.#config, kind: 'exists' });
    }
    insert(values, options) {
        assertWriteState(this.#config, 'insert', {
            where: false,
            orderBy: false,
            limit: false,
            offset: false,
        });
        return this.#resolveTerminal({ ...this.#config, kind: 'insert', values, options });
    }
    insertMany(values, options) {
        assertWriteState(this.#config, 'insertMany', {
            where: false,
            orderBy: false,
            limit: false,
            offset: false,
        });
        return this.#resolveTerminal({ ...this.#config, kind: 'insertMany', values, options });
    }
    update(changes, options) {
        assertWriteState(this.#config, 'update', {
            where: true,
            orderBy: true,
            limit: true,
            offset: true,
        });
        return this.#resolveTerminal({ ...this.#config, kind: 'update', changes, options });
    }
    delete(options) {
        assertWriteState(this.#config, 'delete', {
            where: true,
            orderBy: true,
            limit: true,
            offset: true,
        });
        return this.#resolveTerminal({ ...this.#config, kind: 'delete', options });
    }
    upsert(values, options) {
        assertWriteState(this.#config, 'upsert', {
            where: false,
            orderBy: false,
            limit: false,
            offset: false,
        });
        return this.#resolveTerminal({ ...this.#config, kind: 'upsert', values, options });
    }
    [querySnapshot]() {
        return {
            table: this.#table,
            config: cloneQueryConfig(this.#config),
        };
    }
    #resolveTerminal(config) {
        return this.#withConfig(config);
    }
    #clone(patch) {
        return Query.#createInternal(this.#table, mergeQueryConfig(this.#config, patch));
    }
    #withConfig(config) {
        return Query.#createInternal(this.#table, config);
    }
    #predicateTables() {
        return [this.#table, ...this.#config.joins.map((join) => join.table)];
    }
}
export function query(table) {
    return new Query(table);
}
export { cloneQueryConfig } from "./query/config.js";
