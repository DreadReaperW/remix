import type { Predicate, WhereInput } from './operators.ts';
import type { AnyTable, QualifiedTableColumnName, TableColumnInput, TableColumnName, TableRow, TableRowWith } from './table/metadata.ts';
import type { OrderByClause, OrderDirection } from './table/ordering.ts';
import type { Pretty } from './types.ts';
/**
 * Cardinality of a relation.
 */
export type RelationCardinality = 'one' | 'many';
/**
 * Supported relation kinds.
 */
export type RelationKind = 'hasMany' | 'hasOne' | 'belongsTo' | 'hasManyThrough';
export type RelationResult<relation extends AnyRelation> = relation extends Relation<any, infer target, infer cardinality, infer loaded> ? cardinality extends 'many' ? Array<TableRowWith<target, loaded>> : TableRowWith<target, loaded> | null : never;
/**
 * Named relation map for a source table.
 */
export type RelationMapForTable<table extends AnyTable> = Record<string, Relation<table, AnyTable, RelationCardinality, any>>;
export type LoadedRelationMap<relations extends RelationMapForTable<any>> = Pretty<{
    [name in keyof relations]: RelationResult<relations[name]>;
}>;
/**
 * Column or column list used to join relations.
 */
export type KeySelector<table extends AnyTable> = (keyof TableRow<table> & string) | readonly (keyof TableRow<table> & string)[];
/**
 * Options for defining a {@link hasMany} relation.
 */
export type HasManyOptions<source extends AnyTable, target extends AnyTable> = {
    foreignKey?: KeySelector<target>;
    targetKey?: KeySelector<source>;
};
/**
 * Options for defining a {@link hasOne} relation.
 */
export type HasOneOptions<source extends AnyTable, target extends AnyTable> = {
    foreignKey?: KeySelector<target>;
    targetKey?: KeySelector<source>;
};
/**
 * Options for defining a {@link belongsTo} relation.
 */
export type BelongsToOptions<source extends AnyTable, target extends AnyTable> = {
    foreignKey?: KeySelector<source>;
    targetKey?: KeySelector<target>;
};
/**
 * Options for defining a {@link hasManyThrough} relation.
 */
export type HasManyThroughOptions<source extends AnyTable, target extends AnyTable> = {
    through: Relation<source, AnyTable, RelationCardinality, any>;
    throughForeignKey?: KeySelector<target>;
    throughTargetKey?: string | string[];
};
export type RelationModifiers<target extends AnyTable> = {
    where: Predicate[];
    orderBy: OrderByClause[];
    limit?: number;
    offset?: number;
    with: RelationMapForTable<target>;
};
export type ThroughRelationMetadata = {
    relation: AnyRelation;
    throughSourceKey: string[];
    throughTargetKey: string[];
};
/**
 * Relation descriptor used by query loading.
 */
export type Relation<source extends AnyTable, target extends AnyTable, cardinality extends RelationCardinality, loaded extends Record<string, unknown> = {}> = {
    kind: 'relation';
    relationKind: RelationKind;
    sourceTable: source;
    targetTable: target;
    cardinality: cardinality;
    sourceKey: string[];
    targetKey: string[];
    through?: ThroughRelationMetadata;
    modifiers: RelationModifiers<target>;
    where(input: WhereInput<TableColumnName<target> | QualifiedTableColumnName<target>>): Relation<source, target, cardinality, loaded>;
    orderBy(column: TableColumnInput<target>, direction?: OrderDirection): Relation<source, target, cardinality, loaded>;
    limit(value: number): Relation<source, target, cardinality, loaded>;
    offset(value: number): Relation<source, target, cardinality, loaded>;
    with<relations extends RelationMapForTable<target>>(relations: relations): Relation<source, target, cardinality, loaded & LoadedRelationMap<relations>>;
};
/**
 * Relation descriptor with erased table types.
 */
export type AnyRelation = Relation<AnyTable, AnyTable, RelationCardinality, any>;
/**
 * Defines a one-to-many relation from `source` to `target`.
 * @param source Source table.
 * @param target Target table.
 * @param relationOptions Relation key configuration.
 * @returns A relation descriptor.
 */
export declare function hasMany<source extends AnyTable, target extends AnyTable>(source: source, target: target, relationOptions?: HasManyOptions<source, target>): Relation<source, target, 'many'>;
/**
 * Defines a one-to-one relation from `source` to `target` where the foreign key lives on `target`.
 * @param source Source table.
 * @param target Target table.
 * @param relationOptions Relation key configuration.
 * @returns A relation descriptor.
 */
export declare function hasOne<source extends AnyTable, target extends AnyTable>(source: source, target: target, relationOptions?: HasOneOptions<source, target>): Relation<source, target, 'one'>;
/**
 * Defines a one-to-one relation from `source` to `target`.
 * @param source Source table.
 * @param target Target table.
 * @param relationOptions Relation key configuration.
 * @returns A relation descriptor.
 */
export declare function belongsTo<source extends AnyTable, target extends AnyTable>(source: source, target: target, relationOptions?: BelongsToOptions<source, target>): Relation<source, target, 'one'>;
/**
 * Defines a one-to-many relation from `source` to `target` through an intermediate relation.
 * @param source Source table.
 * @param target Target table.
 * @param relationOptions Through relation configuration.
 * @returns A relation descriptor.
 */
export declare function hasManyThrough<source extends AnyTable, target extends AnyTable>(source: source, target: target, relationOptions: HasManyThroughOptions<source, target>): Relation<source, target, 'many'>;
//# sourceMappingURL=table-relations.d.ts.map