export function createInitialQueryConfig() {
    return {
        kind: 'all',
        select: '*',
        distinct: false,
        joins: [],
        where: [],
        groupBy: [],
        having: [],
        orderBy: [],
        with: {},
    };
}
export function mergeQueryConfig(config, patch) {
    let next = cloneQueryConfig(config);
    if (patch.select !== undefined) {
        next.select = cloneSelection(patch.select);
    }
    if (patch.distinct !== undefined) {
        next.distinct = patch.distinct;
    }
    if (patch.joins !== undefined) {
        next.joins = [...patch.joins];
    }
    if (patch.where !== undefined) {
        next.where = [...patch.where];
    }
    if (patch.groupBy !== undefined) {
        next.groupBy = [...patch.groupBy];
    }
    if (patch.having !== undefined) {
        next.having = [...patch.having];
    }
    if (patch.orderBy !== undefined) {
        next.orderBy = [...patch.orderBy];
    }
    if ('limit' in patch) {
        next.limit = patch.limit;
    }
    if ('offset' in patch) {
        next.offset = patch.offset;
    }
    if (patch.with !== undefined) {
        next.with = { ...patch.with };
    }
    return next;
}
export function cloneQueryConfig(config) {
    let state = cloneQueryConfigState(config);
    let cloned;
    switch (config.kind) {
        case 'all':
            cloned = { ...state, kind: 'all' };
            break;
        case 'first':
            cloned = { ...state, kind: 'first' };
            break;
        case 'find':
            cloned = {
                ...state,
                kind: 'find',
                value: clonePrimaryKeyValue(config.value),
            };
            break;
        case 'count':
            cloned = { ...state, kind: 'count' };
            break;
        case 'exists':
            cloned = { ...state, kind: 'exists' };
            break;
        case 'insert':
            cloned = {
                ...state,
                kind: 'insert',
                values: { ...config.values },
                options: config.options ? { ...config.options } : undefined,
            };
            break;
        case 'insertMany':
            cloned = {
                ...state,
                kind: 'insertMany',
                values: config.values.map((value) => ({ ...value })),
                options: config.options ? { ...config.options } : undefined,
            };
            break;
        case 'update':
            cloned = {
                ...state,
                kind: 'update',
                changes: { ...config.changes },
                options: config.options ? { ...config.options } : undefined,
            };
            break;
        case 'delete':
            cloned = {
                ...state,
                kind: 'delete',
                options: config.options ? { ...config.options } : undefined,
            };
            break;
        case 'upsert':
            cloned = {
                ...state,
                kind: 'upsert',
                values: { ...config.values },
                options: config.options
                    ? {
                        ...config.options,
                        conflictTarget: config.options.conflictTarget
                            ? [...config.options.conflictTarget]
                            : undefined,
                        update: config.options.update ? { ...config.options.update } : undefined,
                    }
                    : undefined,
            };
            break;
    }
    return cloned;
}
function cloneQueryConfigState(state) {
    return {
        select: cloneSelection(state.select),
        distinct: state.distinct,
        joins: [...state.joins],
        where: [...state.where],
        groupBy: [...state.groupBy],
        having: [...state.having],
        orderBy: [...state.orderBy],
        limit: state.limit,
        offset: state.offset,
        with: { ...state.with },
    };
}
function cloneSelection(selection) {
    if (selection === '*') {
        return '*';
    }
    return selection.map((column) => ({ ...column }));
}
function clonePrimaryKeyValue(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return value;
    }
    return { ...value };
}
