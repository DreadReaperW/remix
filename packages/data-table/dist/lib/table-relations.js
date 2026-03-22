import { inferForeignKey } from "./inflection.js";
import { normalizeWhereInput } from "./operators.js";
import { normalizeColumnInput } from "./references.js";
import { getTableColumns, getTableName, getTablePrimaryKey } from "./table/metadata.js";
/**
 * Defines a one-to-many relation from `source` to `target`.
 * @param source Source table.
 * @param target Target table.
 * @param relationOptions Relation key configuration.
 * @returns A relation descriptor.
 */
export function hasMany(source, target, relationOptions) {
    let { sourceKey, targetKey } = resolveRelationKeys(source, target, {
        sourceSelector: relationOptions?.targetKey,
        sourceOptionName: 'targetKey',
        sourceDefault: getTablePrimaryKey(source),
        targetSelector: relationOptions?.foreignKey,
        targetOptionName: 'foreignKey',
        targetDefault: [inferForeignKey(getTableName(source))],
    });
    return createRelation({
        relationKind: 'hasMany',
        cardinality: 'many',
        sourceTable: source,
        targetTable: target,
        sourceKey,
        targetKey,
    });
}
/**
 * Defines a one-to-one relation from `source` to `target` where the foreign key lives on `target`.
 * @param source Source table.
 * @param target Target table.
 * @param relationOptions Relation key configuration.
 * @returns A relation descriptor.
 */
export function hasOne(source, target, relationOptions) {
    let { sourceKey, targetKey } = resolveRelationKeys(source, target, {
        sourceSelector: relationOptions?.targetKey,
        sourceOptionName: 'targetKey',
        sourceDefault: getTablePrimaryKey(source),
        targetSelector: relationOptions?.foreignKey,
        targetOptionName: 'foreignKey',
        targetDefault: [inferForeignKey(getTableName(source))],
    });
    return createRelation({
        relationKind: 'hasOne',
        cardinality: 'one',
        sourceTable: source,
        targetTable: target,
        sourceKey,
        targetKey,
    });
}
/**
 * Defines a one-to-one relation from `source` to `target`.
 * @param source Source table.
 * @param target Target table.
 * @param relationOptions Relation key configuration.
 * @returns A relation descriptor.
 */
export function belongsTo(source, target, relationOptions) {
    let { sourceKey, targetKey } = resolveRelationKeys(source, target, {
        sourceSelector: relationOptions?.foreignKey,
        sourceOptionName: 'foreignKey',
        sourceDefault: [inferForeignKey(getTableName(target))],
        targetSelector: relationOptions?.targetKey,
        targetOptionName: 'targetKey',
        targetDefault: getTablePrimaryKey(target),
    });
    return createRelation({
        relationKind: 'belongsTo',
        cardinality: 'one',
        sourceTable: source,
        targetTable: target,
        sourceKey,
        targetKey,
    });
}
/**
 * Defines a one-to-many relation from `source` to `target` through an intermediate relation.
 * @param source Source table.
 * @param target Target table.
 * @param relationOptions Through relation configuration.
 * @returns A relation descriptor.
 */
export function hasManyThrough(source, target, relationOptions) {
    let throughRelation = relationOptions.through;
    if (throughRelation.sourceTable !== source) {
        throw new Error('hasManyThrough expects a through relation whose source table matches ' +
            getTableName(source));
    }
    let { sourceKey: throughTargetKey, targetKey: throughForeignKey } = resolveRelationKeys(throughRelation.targetTable, target, {
        sourceSelector: relationOptions.throughTargetKey,
        sourceOptionName: 'throughTargetKey',
        sourceDefault: getTablePrimaryKey(throughRelation.targetTable),
        targetSelector: relationOptions.throughForeignKey,
        targetOptionName: 'throughForeignKey',
        targetDefault: [inferForeignKey(getTableName(throughRelation.targetTable))],
    });
    return createRelation({
        relationKind: 'hasManyThrough',
        cardinality: 'many',
        sourceTable: source,
        targetTable: target,
        sourceKey: throughRelation.sourceKey,
        targetKey: throughRelation.targetKey,
        through: {
            relation: throughRelation,
            throughSourceKey: throughTargetKey,
            throughTargetKey: throughForeignKey,
        },
    });
}
function normalizeKeysForTable(table, selector, optionName, defaultValue) {
    if (selector === undefined) {
        return [...defaultValue];
    }
    let keys = Array.isArray(selector) ? [...selector] : [selector];
    if (keys.length === 0) {
        throw new Error('Option "' + optionName + '" for table "' + getTableName(table) + '" must not be empty');
    }
    let columns = getTableColumns(table);
    for (let key of keys) {
        if (!Object.prototype.hasOwnProperty.call(columns, key)) {
            throw new Error('Unknown column "' +
                key +
                '" in option "' +
                optionName +
                '" for table "' +
                getTableName(table) +
                '"');
        }
    }
    return keys;
}
function resolveRelationKeys(sourceTable, targetTable, options) {
    let sourceKey = normalizeKeysForTable(sourceTable, options.sourceSelector, options.sourceOptionName, options.sourceDefault);
    let targetKey = normalizeKeysForTable(targetTable, options.targetSelector, options.targetOptionName, options.targetDefault);
    assertKeyLengths(getTableName(sourceTable), getTableName(targetTable), sourceKey, targetKey);
    return { sourceKey, targetKey };
}
function assertKeyLengths(sourceTableName, targetTableName, sourceKey, targetKey) {
    if (sourceKey.length !== targetKey.length) {
        throw new Error('Relation key mismatch between "' +
            sourceTableName +
            '" (' +
            sourceKey.join(', ') +
            ') and "' +
            targetTableName +
            '" (' +
            targetKey.join(', ') +
            ')');
    }
}
function createRelation(options) {
    let relation = {
        kind: 'relation',
        relationKind: options.relationKind,
        sourceTable: options.sourceTable,
        targetTable: options.targetTable,
        cardinality: options.cardinality,
        sourceKey: [...options.sourceKey],
        targetKey: [...options.targetKey],
        through: options.through,
        modifiers: createRelationModifiers(options.modifiers),
        where(input) {
            let predicate = normalizeWhereInput(input);
            return cloneRelation(relation, {
                where: [...relation.modifiers.where, predicate],
            });
        },
        orderBy(column, direction = 'asc') {
            return cloneRelation(relation, {
                orderBy: [
                    ...relation.modifiers.orderBy,
                    {
                        column: normalizeColumnInput(column),
                        direction,
                    },
                ],
            });
        },
        limit(value) {
            return cloneRelation(relation, {
                limit: value,
            });
        },
        offset(value) {
            return cloneRelation(relation, {
                offset: value,
            });
        },
        with(relations) {
            return createRelation({
                relationKind: relation.relationKind,
                cardinality: relation.cardinality,
                sourceTable: relation.sourceTable,
                targetTable: relation.targetTable,
                sourceKey: relation.sourceKey,
                targetKey: relation.targetKey,
                through: relation.through,
                modifiers: {
                    ...relation.modifiers,
                    with: {
                        ...relation.modifiers.with,
                        ...relations,
                    },
                },
            });
        },
    };
    return relation;
}
function cloneRelation(relation, patch) {
    return createRelation({
        relationKind: relation.relationKind,
        cardinality: relation.cardinality,
        sourceTable: relation.sourceTable,
        targetTable: relation.targetTable,
        sourceKey: relation.sourceKey,
        targetKey: relation.targetKey,
        through: relation.through,
        modifiers: cloneRelationModifiers(relation.modifiers, patch),
    });
}
function createRelationModifiers(modifiers) {
    return {
        where: modifiers?.where ? [...modifiers.where] : [],
        orderBy: modifiers?.orderBy ? [...modifiers.orderBy] : [],
        limit: modifiers?.limit,
        offset: modifiers?.offset,
        with: modifiers?.with ? { ...modifiers.with } : {},
    };
}
function cloneRelationModifiers(modifiers, patch) {
    return createRelationModifiers({
        where: patch.where ?? modifiers.where,
        orderBy: patch.orderBy ?? modifiers.orderBy,
        limit: patch.limit ?? modifiers.limit,
        offset: patch.offset ?? modifiers.offset,
        with: patch.with ?? modifiers.with,
    });
}
