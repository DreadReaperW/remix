import type { MigrationDescriptor, MigrationRegistry } from '../migrations.ts';
/**
 * Creates an in-memory migration registry.
 * @param initial Optional initial migration list.
 * @returns A migration registry with duplicate-id protection.
 * @example
 * ```ts
 * import { createMigrationRegistry } from 'remix/data-table/migrations'
 *
 * let registry = createMigrationRegistry()
 * registry.register({ id, name, migration })
 * ```
 */
export declare function createMigrationRegistry(initial?: MigrationDescriptor[]): MigrationRegistry;
//# sourceMappingURL=registry.d.ts.map