import { getTableName } from '@remix-run/data-table/adapter';
export function compileRawOperation(statement) {
    if (!statement.text.includes('?')) {
        return {
            text: statement.text,
            values: [...statement.values],
        };
    }
    let index = 1;
    let text = statement.text.replace(/\?/g, function replaceParameter() {
        let placeholder = '$' + String(index);
        index += 1;
        return placeholder;
    });
    return {
        text,
        values: [...statement.values],
    };
}
export function compileFromClause(table, joins, context) {
    let output = ' from ' + quotePath(getTableName(table));
    for (let join of joins) {
        output += compileJoinClause(join, context);
    }
    return output;
}
export function compileWhereClause(predicates, context) {
    return compilePredicateClause('where', predicates, context);
}
export function compileGroupByClause(columns) {
    return compileDelimitedClause('group by', columns, quotePath);
}
export function compileHavingClause(predicates, context) {
    return compilePredicateClause('having', predicates, context);
}
export function compileOrderByClause(orderBy) {
    return compileDelimitedClause('order by', orderBy, (clause) => quotePath(clause.column) + ' ' + clause.direction.toUpperCase());
}
export function compileLimitClause(limit) {
    if (limit === undefined) {
        return '';
    }
    return ' limit ' + String(limit);
}
export function compileOffsetClause(offset) {
    if (offset === undefined) {
        return '';
    }
    return ' offset ' + String(offset);
}
export function compileReturningClause(returning) {
    if (!returning) {
        return '';
    }
    if (returning === '*') {
        return ' returning *';
    }
    return ' returning ' + returning.map((column) => quotePath(column)).join(', ');
}
export function quoteIdentifier(value) {
    return '"' + value.replace(/"/g, '""') + '"';
}
export function quoteTableRef(table) {
    if (table.schema) {
        return quoteIdentifier(table.schema) + '.' + quoteIdentifier(table.name);
    }
    return quoteIdentifier(table.name);
}
export function quotePath(path) {
    if (path === '*') {
        return '*';
    }
    return path
        .split('.')
        .map((segment) => {
        if (segment === '*') {
            return '*';
        }
        return quoteIdentifier(segment);
    })
        .join('.');
}
export function pushValue(context, value) {
    context.values.push(value);
    return '$' + String(context.values.length);
}
export function collectColumns(rows) {
    let columns = [];
    let seen = new Set();
    for (let row of rows) {
        appendOwnKeys(row, seen, columns);
    }
    return columns;
}
function compilePredicateClause(keyword, predicates, context) {
    if (predicates.length === 0) {
        return '';
    }
    return (' ' +
        keyword +
        ' ' +
        predicates.map((predicate) => compileWrappedPredicate(predicate, context)).join(' and '));
}
function compileDelimitedClause(keyword, values, compileValue) {
    if (values.length === 0) {
        return '';
    }
    return ' ' + keyword + ' ' + values.map(compileValue).join(', ');
}
function compileJoinClause(join, context) {
    return (' ' +
        normalizeJoinType(join.type) +
        ' join ' +
        quotePath(getTableName(join.table)) +
        ' on ' +
        compilePredicate(join.on, context));
}
function compileWrappedPredicate(predicate, context) {
    return '(' + compilePredicate(predicate, context) + ')';
}
function appendOwnKeys(row, seen, columns) {
    for (let key in row) {
        if (!Object.prototype.hasOwnProperty.call(row, key) || seen.has(key)) {
            continue;
        }
        seen.add(key);
        columns.push(key);
    }
}
function compilePredicate(predicate, context) {
    if (predicate.type === 'comparison') {
        let column = quotePath(predicate.column);
        if (predicate.operator === 'eq') {
            if (predicate.valueType === 'value' &&
                (predicate.value === null || predicate.value === undefined)) {
                return column + ' is null';
            }
            let comparisonValue = compileComparisonValue(predicate, context);
            return column + ' = ' + comparisonValue;
        }
        if (predicate.operator === 'ne') {
            if (predicate.valueType === 'value' &&
                (predicate.value === null || predicate.value === undefined)) {
                return column + ' is not null';
            }
            let comparisonValue = compileComparisonValue(predicate, context);
            return column + ' <> ' + comparisonValue;
        }
        if (predicate.operator === 'gt') {
            let comparisonValue = compileComparisonValue(predicate, context);
            return column + ' > ' + comparisonValue;
        }
        if (predicate.operator === 'gte') {
            let comparisonValue = compileComparisonValue(predicate, context);
            return column + ' >= ' + comparisonValue;
        }
        if (predicate.operator === 'lt') {
            let comparisonValue = compileComparisonValue(predicate, context);
            return column + ' < ' + comparisonValue;
        }
        if (predicate.operator === 'lte') {
            let comparisonValue = compileComparisonValue(predicate, context);
            return column + ' <= ' + comparisonValue;
        }
        if (predicate.operator === 'in' || predicate.operator === 'notIn') {
            let values = Array.isArray(predicate.value) ? predicate.value : [];
            if (values.length === 0) {
                return predicate.operator === 'in' ? '1 = 0' : '1 = 1';
            }
            let placeholders = values.map((value) => pushValue(context, value));
            let keyword = predicate.operator === 'in' ? 'in' : 'not in';
            return column + ' ' + keyword + ' (' + placeholders.join(', ') + ')';
        }
        if (predicate.operator === 'like') {
            let comparisonValue = compileComparisonValue(predicate, context);
            return column + ' like ' + comparisonValue;
        }
        if (predicate.operator === 'ilike') {
            let comparisonValue = compileComparisonValue(predicate, context);
            return column + ' ilike ' + comparisonValue;
        }
    }
    if (predicate.type === 'between') {
        return (quotePath(predicate.column) +
            ' between ' +
            pushValue(context, predicate.lower) +
            ' and ' +
            pushValue(context, predicate.upper));
    }
    if (predicate.type === 'null') {
        return (quotePath(predicate.column) + (predicate.operator === 'isNull' ? ' is null' : ' is not null'));
    }
    if (predicate.type === 'logical') {
        if (predicate.predicates.length === 0) {
            return predicate.operator === 'and' ? '1 = 1' : '1 = 0';
        }
        let childOperator = predicate.operator === 'and' ? ' and ' : ' or ';
        let childPredicates = predicate.predicates
            .map((child) => '(' + compilePredicate(child, context) + ')')
            .join(childOperator);
        return childPredicates;
    }
    throw new Error('Unsupported predicate');
}
function compileComparisonValue(predicate, context) {
    if (predicate.valueType === 'column') {
        return quotePath(predicate.value);
    }
    return pushValue(context, predicate.value);
}
function normalizeJoinType(type) {
    if (type === 'left') {
        return 'left';
    }
    if (type === 'right') {
        return 'right';
    }
    return 'inner';
}
