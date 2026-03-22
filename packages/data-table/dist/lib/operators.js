import { isColumnReference, normalizeColumnInput } from "./references.js";
export function eq(column, value) {
    return createComparisonPredicate('eq', column, value);
}
export function ne(column, value) {
    return createComparisonPredicate('ne', column, value);
}
export function gt(column, value) {
    return createComparisonPredicate('gt', column, value);
}
export function gte(column, value) {
    return createComparisonPredicate('gte', column, value);
}
export function lt(column, value) {
    return createComparisonPredicate('lt', column, value);
}
export function lte(column, value) {
    return createComparisonPredicate('lte', column, value);
}
/**
 * Builds an `IN` predicate.
 * @param column Column to compare.
 * @param values Candidate values.
 * @returns An `in` comparison predicate.
 */
export function inList(column, values) {
    return createListPredicate('in', column, values);
}
/**
 * Builds a `NOT IN` predicate.
 * @param column Column to compare.
 * @param values Candidate values.
 * @returns A `notIn` comparison predicate.
 */
export function notInList(column, values) {
    return createListPredicate('notIn', column, values);
}
/**
 * Builds a case-sensitive SQL `LIKE` predicate.
 * @param column Column to compare.
 * @param value Match pattern.
 * @returns A `like` comparison predicate.
 */
export function like(column, value) {
    return createComparisonPredicate('like', column, value);
}
/**
 * Builds a case-insensitive SQL `LIKE` predicate.
 * @param column Column to compare.
 * @param value Match pattern.
 * @returns An `ilike` comparison predicate.
 */
export function ilike(column, value) {
    return createComparisonPredicate('ilike', column, value);
}
/**
 * Builds a `BETWEEN` predicate.
 * @param column Column to compare.
 * @param lower Lower bound value.
 * @param upper Upper bound value.
 * @returns A `between` predicate.
 */
export function between(column, lower, upper) {
    return createBetweenPredicate(column, lower, upper);
}
/**
 * Builds an `IS NULL` predicate.
 * @param column Column to compare.
 * @returns An `isNull` predicate.
 */
export function isNull(column) {
    return createNullPredicate('isNull', column);
}
/**
 * Builds an `IS NOT NULL` predicate.
 * @param column Column to compare.
 * @returns A `notNull` predicate.
 */
export function notNull(column) {
    return createNullPredicate('notNull', column);
}
/**
 * Combines predicates with logical `AND`.
 * @param predicates Child predicates.
 * @returns A logical `and` predicate.
 */
export function and(...predicates) {
    return createLogicalPredicate('and', predicates);
}
/**
 * Combines predicates with logical `OR`.
 * @param predicates Child predicates.
 * @returns A logical `or` predicate.
 */
export function or(...predicates) {
    return createLogicalPredicate('or', predicates);
}
/**
 * Normalizes object shorthand into a predicate tree.
 * @param input Predicate object or shorthand where map.
 * @returns A normalized predicate.
 */
export function normalizeWhereInput(input) {
    if (isPredicateInput(input)) {
        return input;
    }
    let predicates = Object.keys(input).map((key) => eq(key, input[key]));
    return and(...predicates);
}
function isQualifiedColumnReference(value) {
    if (typeof value !== 'string') {
        return false;
    }
    return /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)+$/.test(value);
}
function resolvePredicateColumn(column) {
    return normalizeColumnInput(column);
}
function resolveComparisonValue(value) {
    if (isColumnReference(value)) {
        return normalizeColumnInput(value);
    }
    return value;
}
function createListPredicate(operator, column, values) {
    return {
        type: 'comparison',
        operator,
        column: resolvePredicateColumn(column),
        value: [...values],
        valueType: 'value',
    };
}
function createBetweenPredicate(column, lower, upper) {
    return {
        type: 'between',
        column: resolvePredicateColumn(column),
        lower,
        upper,
    };
}
function createNullPredicate(operator, column) {
    return {
        type: 'null',
        operator,
        column: resolvePredicateColumn(column),
    };
}
function createLogicalPredicate(operator, predicates) {
    return {
        type: 'logical',
        operator,
        predicates: predicates.filter(Boolean),
    };
}
function isPredicateInput(input) {
    return (typeof input === 'object' &&
        input !== null &&
        'type' in input &&
        (input.type === 'comparison' ||
            input.type === 'between' ||
            input.type === 'null' ||
            input.type === 'logical'));
}
function createComparisonPredicate(operator, column, value) {
    let normalizedColumn = resolvePredicateColumn(column);
    let normalizedValue = resolveComparisonValue(value);
    if (isQualifiedColumnReference(normalizedColumn) && isQualifiedColumnReference(normalizedValue)) {
        return {
            type: 'comparison',
            operator,
            column: normalizedColumn,
            value: normalizedValue,
            valueType: 'column',
        };
    }
    return {
        type: 'comparison',
        operator,
        column: normalizedColumn,
        value: normalizedValue,
        valueType: 'value',
    };
}
