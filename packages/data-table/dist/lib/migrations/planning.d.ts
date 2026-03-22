import type { MigrateOptions, MigrationDescriptor, MigrationDirection, MigrationJournalRow, MigrationRegistry, MigrationStatusEntry } from '../migrations.ts';
export declare function listMigrations(migrations: MigrationDescriptor[] | MigrationRegistry): MigrationDescriptor[];
export declare function assertStepOption(step: number | undefined): void;
export declare function assertMigrateOptions(options: MigrateOptions): void;
export declare function assertTargetOption(migrations: MigrationDescriptor[], to: string | undefined): void;
export declare function assertNoMigrationDrift(migrations: MigrationDescriptor[], journal: MigrationJournalRow[]): void;
export declare function selectMigrationsToRun(direction: MigrationDirection, migrations: MigrationDescriptor[], journal: MigrationJournalRow[], options: MigrateOptions): MigrationDescriptor[];
export declare function createMigrationStatusEntries(migrations: MigrationDescriptor[], journal: MigrationJournalRow[]): MigrationStatusEntry[];
//# sourceMappingURL=planning.d.ts.map