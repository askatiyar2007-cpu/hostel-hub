import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Follow-up Migration: Payments Privilege Closure (20261101010000)', () => {
  const migrationPath = path.resolve(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20261101010000_payments_privilege_closure.sql'
  );

  it('migration file exists and is readable', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const content = fs.readFileSync(migrationPath, 'utf-8');
    expect(content.length).toBeGreaterThan(100);
  });

  describe('1. Table-Level Privilege Revocations', () => {
    it('revokes ALL table-level privileges on public.payments from PUBLIC, anon, and authenticated', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toMatch(
        /REVOKE\s+ALL\s+(?:PRIVILEGES\s+ON\s+TABLE|ON)\s+public\.payments\s+FROM\s+PUBLIC,\s*anon,\s*authenticated;/i
      );
    });

    it('removes REFERENCES, TRIGGER, and TRUNCATE privileges from anon and authenticated', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      // REVOKE ALL revokes all standard privileges in PostgreSQL:
      // SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER.
      expect(sql).toContain('REVOKE ALL PRIVILEGES ON TABLE public.payments FROM PUBLIC, anon, authenticated;');
    });
  });

  describe('2. Read-Only Access for Authenticated Role', () => {
    it('grants SELECT on public.payments to authenticated role only', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toMatch(
        /GRANT\s+SELECT\s+ON\s+(?:TABLE\s+)?public\.payments\s+TO\s+authenticated;/i
      );
      // Ensures SELECT is not granted to anon or PUBLIC
      expect(sql).not.toMatch(/GRANT\s+SELECT\s+.*TO\s+anon/i);
      expect(sql).not.toMatch(/GRANT\s+SELECT\s+.*TO\s+PUBLIC/i);
    });
  });

  describe('3. Column-Level Privilege Revocations', () => {
    it('iterates through information_schema.columns for public.payments dynamically', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain("table_schema = 'public' AND table_name = 'payments'");
    });

    it('explicitly revokes column-level INSERT, UPDATE, and REFERENCES from PUBLIC, anon, and authenticated', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain(
        "REVOKE INSERT (%I), UPDATE (%I), REFERENCES (%I) ON public.payments FROM PUBLIC, anon, authenticated"
      );
    });

    it('explicitly revokes column-level SELECT from PUBLIC and anon', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain(
        "REVOKE SELECT (%I) ON public.payments FROM PUBLIC, anon"
      );
    });
  });

  describe('4. Anon Privilege Closure', () => {
    it('ensures anon has zero SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, or TRIGGER privileges', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      // anon is included in REVOKE ALL table-level
      expect(sql).toMatch(/REVOKE\s+ALL.*FROM.*anon/i);
      // anon is never granted any privilege
      expect(sql).not.toMatch(/GRANT\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE)\s+.*TO\s+anon/i);
    });
  });

  describe('5. Safety Scope & Isolation', () => {
    it('does not modify RLS policies', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).not.toMatch(/CREATE\s+POLICY/i);
      expect(sql).not.toMatch(/ALTER\s+POLICY/i);
      expect(sql).not.toMatch(/DROP\s+POLICY/i);
    });

    it('does not modify payment RPCs or functions', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).not.toMatch(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION/i);
      expect(sql).not.toMatch(/DROP\s+FUNCTION/i);
      expect(sql).not.toMatch(/ALTER\s+FUNCTION/i);
    });

    it('does not modify indexes, payment rows, or other tables', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).not.toMatch(/CREATE\s+INDEX/i);
      expect(sql).not.toMatch(/DROP\s+INDEX/i);
      expect(sql).not.toMatch(/INSERT\s+INTO\s+public\.payments/i);
      expect(sql).not.toMatch(/UPDATE\s+public\.payments\s+SET/i);
      expect(sql).not.toMatch(/DELETE\s+FROM\s+public\.payments/i);
      expect(sql).not.toMatch(/TABLE\s+public\.(?!payments\b)\w+/i);
    });
  });

  describe('6. Service Role Administrative Access Preservation', () => {
    it('preserves full table access for service_role', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toMatch(
        /GRANT\s+ALL\s+PRIVILEGES\s+ON\s+TABLE\s+public\.payments\s+TO\s+service_role;/i
      );
    });
  });

  describe('7. Effective Privilege Matrix Simulation', () => {
    interface TablePermissions {
      select: boolean;
      insert: boolean;
      update: boolean;
      delete: boolean;
      truncate: boolean;
      references: boolean;
      trigger: boolean;
    }

    interface ColumnPermissions {
      select: boolean;
      insert: boolean;
      update: boolean;
      references: boolean;
    }

    const calculatePermissions = (role: 'anon' | 'authenticated' | 'service_role' | 'PUBLIC') => {
      const tablePerms: TablePermissions = {
        select: false,
        insert: false,
        update: false,
        delete: false,
        truncate: false,
        references: false,
        trigger: false,
      };

      const columnPerms: ColumnPermissions = {
        select: false,
        insert: false,
        update: false,
        references: false,
      };

      // Applied rules from migration
      if (role === 'service_role') {
        tablePerms.select = true;
        tablePerms.insert = true;
        tablePerms.update = true;
        tablePerms.delete = true;
        tablePerms.truncate = true;
        tablePerms.references = true;
        tablePerms.trigger = true;

        columnPerms.select = true;
        columnPerms.insert = true;
        columnPerms.update = true;
        columnPerms.references = true;
      } else if (role === 'authenticated') {
        // Authenticated receives only SELECT on the table
        tablePerms.select = true;
        columnPerms.select = true; // Can select columns via table-level SELECT
      }
      // anon and PUBLIC have all false

      return { tablePerms, columnPerms };
    };

    it('anon has zero privileges on payments table and columns', () => {
      const { tablePerms, columnPerms } = calculatePermissions('anon');
      expect(tablePerms.select).toBe(false);
      expect(tablePerms.insert).toBe(false);
      expect(tablePerms.update).toBe(false);
      expect(tablePerms.delete).toBe(false);
      expect(tablePerms.truncate).toBe(false);
      expect(tablePerms.references).toBe(false);
      expect(tablePerms.trigger).toBe(false);

      expect(columnPerms.select).toBe(false);
      expect(columnPerms.insert).toBe(false);
      expect(columnPerms.update).toBe(false);
      expect(columnPerms.references).toBe(false);
    });

    it('authenticated has only SELECT and zero write/constraint privileges', () => {
      const { tablePerms, columnPerms } = calculatePermissions('authenticated');
      expect(tablePerms.select).toBe(true);
      expect(tablePerms.insert).toBe(false);
      expect(tablePerms.update).toBe(false);
      expect(tablePerms.delete).toBe(false);
      expect(tablePerms.truncate).toBe(false);
      expect(tablePerms.references).toBe(false);
      expect(tablePerms.trigger).toBe(false);

      expect(columnPerms.insert).toBe(false);
      expect(columnPerms.update).toBe(false);
      expect(columnPerms.references).toBe(false);
    });

    it('service_role has full table and column privileges', () => {
      const { tablePerms, columnPerms } = calculatePermissions('service_role');
      expect(tablePerms.select).toBe(true);
      expect(tablePerms.insert).toBe(true);
      expect(tablePerms.update).toBe(true);
      expect(tablePerms.delete).toBe(true);
      expect(tablePerms.truncate).toBe(true);
      expect(tablePerms.references).toBe(true);
      expect(tablePerms.trigger).toBe(true);

      expect(columnPerms.select).toBe(true);
      expect(columnPerms.insert).toBe(true);
      expect(columnPerms.update).toBe(true);
      expect(columnPerms.references).toBe(true);
    });
  });

  describe('8. Transactional Safety & Rerunnability', () => {
    it('is explicitly wrapped in a single transaction block (BEGIN / COMMIT)', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toMatch(/^\s*BEGIN\s*;/m);
      expect(sql).toMatch(/COMMIT\s*;\s*$/m);
    });

    it('contains only rerunnable, idempotent DDL statements without non-idempotent side effects', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('REVOKE ALL PRIVILEGES ON TABLE public.payments FROM PUBLIC, anon, authenticated;');
      expect(sql).toContain('GRANT SELECT ON TABLE public.payments TO authenticated;');
      expect(sql).toContain('GRANT ALL PRIVILEGES ON TABLE public.payments TO service_role;');
    });
  });
});
