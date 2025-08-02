#!/usr/bin/env node

import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { config } from 'dotenv';

config();

interface MigrationFile {
  id: string;
  name: string;
  path: string;
  checksum: string;
}

/*
interface MigrationLog { // Unused interface
  id: string;
  name: string;
  applied_at: Date;
  checksum: string;
  execution_time_ms: number;
  success: boolean;
  error_message?: string;
}
*/

class DatabaseMigrationRunner {
  private pool: Pool;
  private migrationsDir: string;
  private rollbackDir: string;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env['DATABASE_URL'] || 
        `postgresql://${process.env['DB_USER'] || 'postgres'}:${process.env['DB_PASSWORD']}@${process.env['DB_HOST'] || 'localhost'}:${process.env['DB_PORT'] || '5432'}/${process.env['DB_NAME'] || 'signatureauth'}`,
      ssl: process.env['NODE_ENV'] === 'production' ? {
        rejectUnauthorized: false
      } : undefined
    });

    this.migrationsDir = path.join(process.cwd(), 'migrations');
    this.rollbackDir = path.join(this.migrationsDir, 'rollback');
  }

  /**
   * Initialize migrations table if it doesn't exist
   */
  private async initializeMigrationsTable(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations_log (
        id VARCHAR(10) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
        checksum VARCHAR(64) NOT NULL,
        execution_time_ms INTEGER NOT NULL,
        success BOOLEAN NOT NULL DEFAULT TRUE,
        error_message TEXT,
        rolled_back_at TIMESTAMP
      )
    `);
  }

  /**
   * Calculate checksum for a file
   */
  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get list of migration files
   */
  private getMigrationFiles(): MigrationFile[] {
    const files = fs.readdirSync(this.migrationsDir)
      .filter(f => f.endsWith('.sql') && !f.includes('rollback'))
      .sort();

    return files.map(filename => {
      const filepath = path.join(this.migrationsDir, filename);
      const content = fs.readFileSync(filepath, 'utf8');
      const parts = filename.split('_');
      const id = parts[0];
      
      if (!id) {
        throw new Error(`Invalid migration filename: ${filename}`);
      }
      
      return {
        id,
        name: filename,
        path: filepath,
        checksum: this.calculateChecksum(content)
      };
    });
  }

  /**
   * Check if a migration has been applied
   */
  private async isMigrationApplied(client: PoolClient, id: string): Promise<boolean> {
    const result = await client.query(
      'SELECT id FROM migrations_log WHERE id = $1 AND success = TRUE AND rolled_back_at IS NULL',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Apply a single migration
   */
  private async applyMigration(client: PoolClient, migration: MigrationFile): Promise<void> {
    const startTime = Date.now();
    const content = fs.readFileSync(migration.path, 'utf8');

    console.log(`\n📋 Applying migration: ${migration.name}`);
    console.log('─'.repeat(50));

    try {
      // Execute the migration
      await client.query(content);
      
      const executionTime = Date.now() - startTime;
      
      // Log successful migration
      await client.query(`
        INSERT INTO migrations_log (id, name, checksum, execution_time_ms, success)
        VALUES ($1, $2, $3, $4, TRUE)
      `, [migration.id, migration.name, migration.checksum, executionTime]);

      console.log(`✅ Migration ${migration.name} applied successfully (${executionTime}ms)`);
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Log failed migration
      await client.query(`
        INSERT INTO migrations_log (id, name, checksum, execution_time_ms, success, error_message)
        VALUES ($1, $2, $3, $4, FALSE, $5)
      `, [migration.id, migration.name, migration.checksum, executionTime, errorMessage]);

      throw new Error(`Migration ${migration.name} failed: ${errorMessage}`);
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(dryRun: boolean = false): Promise<void> {
    const client = await this.pool.connect();

    try {
      // Start transaction
      await client.query('BEGIN');

      // Initialize migrations table
      await this.initializeMigrationsTable(client);

      // Get all migration files
      const migrations = this.getMigrationFiles();
      console.log(`Found ${migrations.length} migration files`);

      // Check for pending migrations
      const pendingMigrations: MigrationFile[] = [];
      for (const migration of migrations) {
        const isApplied = await this.isMigrationApplied(client, migration.id);
        if (!isApplied) {
          pendingMigrations.push(migration);
        }
      }

      if (pendingMigrations.length === 0) {
        console.log('\n✅ No pending migrations');
        await client.query('COMMIT');
        return;
      }

      console.log(`\n📦 ${pendingMigrations.length} pending migration(s) to apply:`);
      pendingMigrations.forEach(m => console.log(`  - ${m.name}`));

      if (dryRun) {
        console.log('\n🔍 DRY RUN MODE - No changes will be made');
        await client.query('ROLLBACK');
        return;
      }

      // Apply each pending migration
      for (const migration of pendingMigrations) {
        await this.applyMigration(client, migration);
      }

      // Commit all migrations
      await client.query('COMMIT');
      console.log('\n✅ All migrations completed successfully!');

    } catch (error) {
      // Rollback on any error
      await client.query('ROLLBACK');
      console.error('\n❌ Migration failed, rolling back all changes');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Rollback a specific migration
   */
  async rollbackMigration(migrationId: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Check if migration exists and was applied
      const result = await client.query(
        'SELECT * FROM migrations_log WHERE id = $1 AND success = TRUE AND rolled_back_at IS NULL',
        [migrationId]
      );

      if (result.rowCount === 0) {
        throw new Error(`Migration ${migrationId} not found or already rolled back`);
      }

      // Find rollback file
      const rollbackFiles = fs.readdirSync(this.rollbackDir)
        .filter(f => f.startsWith(`${migrationId}_rollback`));

      if (rollbackFiles.length === 0) {
        throw new Error(`No rollback file found for migration ${migrationId}`);
      }

      const rollbackFile = rollbackFiles[0];
      if (!rollbackFile) {
        throw new Error(`No rollback file found for migration ${migrationId}`);
      }
      const rollbackPath = path.join(this.rollbackDir, rollbackFile);
      const rollbackContent = fs.readFileSync(rollbackPath, 'utf8');

      console.log(`\n🔄 Rolling back migration: ${migrationId}`);
      console.log('─'.repeat(50));

      // Execute rollback
      await client.query(rollbackContent);

      // Update migration log
      await client.query(
        'UPDATE migrations_log SET rolled_back_at = NOW() WHERE id = $1',
        [migrationId]
      );

      await client.query('COMMIT');
      console.log(`✅ Migration ${migrationId} rolled back successfully`);

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('\n❌ Rollback failed');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Show migration status
   */
  async showStatus(): Promise<void> {
    const client = await this.pool.connect();

    try {
      await this.initializeMigrationsTable(client);

      const result = await client.query(`
        SELECT id, name, applied_at, execution_time_ms, success, rolled_back_at
        FROM migrations_log
        ORDER BY applied_at DESC
      `);

      console.log('\n📊 Migration Status');
      console.log('─'.repeat(80));
      
      if (result.rows.length === 0) {
        console.log('No migrations have been applied yet');
      } else {
        result.rows.forEach((row: any) => {
          const status = row.rolled_back_at ? '🔄 ROLLED BACK' : 
                        row.success ? '✅ APPLIED' : '❌ FAILED';
          console.log(`${status} ${row.id} - ${row.name}`);
          console.log(`   Applied: ${row.applied_at.toLocaleString()}, Time: ${row.execution_time_ms}ms`);
          if (row.rolled_back_at) {
            console.log(`   Rolled back: ${row.rolled_back_at.toLocaleString()}`);
          }
        });
      }

      // Check pending migrations
      const migrations = this.getMigrationFiles();
      const pending = [];
      for (const migration of migrations) {
        const isApplied = await this.isMigrationApplied(client, migration.id);
        if (!isApplied) {
          pending.push(migration);
        }
      }

      if (pending.length > 0) {
        console.log('\n⏳ Pending Migrations:');
        pending.forEach(m => console.log(`   - ${m.name}`));
      }

    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// CLI handling
async function main() {
  const runner = new DatabaseMigrationRunner();
  const command = process.argv[2];

  try {
    switch (command) {
      case 'up':
      case 'migrate':
        await runner.runMigrations();
        break;
      
      case 'dry-run':
        await runner.runMigrations(true);
        break;
      
      case 'rollback': {
        const migrationId = process.argv[3];
        if (!migrationId) {
          console.error('Please specify migration ID to rollback');
          process.exit(1);
        }
        await runner.rollbackMigration(migrationId);
        break;
      }
      
      case 'status':
        await runner.showStatus();
        break;
      
      default:
        console.log(`
Database Migration Runner

Usage:
  npm run migrate:up         Run all pending migrations
  npm run migrate:dry-run    Show what would be migrated (no changes)
  npm run migrate:rollback <id>  Rollback specific migration
  npm run migrate:status     Show migration status

Examples:
  npm run migrate:up
  npm run migrate:rollback 001
  npm run migrate:status
        `);
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await runner.close();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { DatabaseMigrationRunner };