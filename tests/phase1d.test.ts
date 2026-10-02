import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 1D: Remove Legacy bills Application Dependencies & Final Migration', () => {
  const rootDir = path.resolve(__dirname, '..');
  const migrationPath = path.join(
    rootDir,
    'supabase',
    'migrations',
    '20261001040000_remove_legacy_bills.sql'
  );

  test('app/owner/students/[id]/page.tsx no longer queries bills and uses student_electricity_charges', () => {
    const filePath = path.join(rootDir, 'app', 'owner', 'students', '[id]', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).not.toContain(".from('bills')");
    expect(content).not.toContain('.from("bills")');
    expect(content).toContain(".from('student_electricity_charges')");
    expect(content).toContain('charge_amount_paise');
  });

  test('app/admin/dashboard/page.tsx no longer queries bills and uses student_fees', () => {
    const filePath = path.join(rootDir, 'app', 'admin', 'dashboard', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).not.toContain(".from('bills')");
    expect(content).not.toContain('.from("bills")');
    expect(content).toContain('.from("student_fees")');
  });

  test('app/owner/hostels/[id]/page.tsx no longer queries bills and uses student_fees', () => {
    const filePath = path.join(rootDir, 'app', 'owner', 'hostels', '[id]', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).not.toContain(".from('bills')");
    expect(content).not.toContain('.from("bills")');
    expect(content).toContain(".from('student_fees')");
  });

  test('types/database.ts does not export Bill interface or include bill_id in Payment', () => {
    const filePath = path.join(rootDir, 'types', 'database.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).not.toContain('interface Bill');
    expect(content).not.toContain('bill_id');
  });

  test('No executable application code in app/, components/, lib/, or types/ queries bills table', () => {
    const targetDirs = ['app', 'components', 'lib', 'types'];

    function scanDir(dir: string): string[] {
      const results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results.push(...scanDir(fullPath));
        } else if (/\.(ts|tsx|js|jsx)$/.test(file)) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const allCodeFiles = targetDirs.flatMap((d) => scanDir(path.join(rootDir, d)));

    const matchingFiles: string[] = [];
    for (const file of allCodeFiles) {
      const code = fs.readFileSync(file, 'utf-8');
      if (code.includes(".from('bills')") || code.includes('.from("bills")') || code.includes('.from(`bills`)')) {
        matchingFiles.push(file);
      }
    }

    expect(matchingFiles).toEqual([]);
  });

  test('lib/electricity core files are intact and unmodified by Phase 1D', () => {
    const electricityDir = path.join(rootDir, 'lib', 'electricity');
    expect(fs.existsSync(electricityDir)).toBe(true);

    const files = fs.readdirSync(electricityDir);
    expect(files.length).toBeGreaterThan(0);
  });

  // Migration file tests
  test('Phase 1D migration file exists with correct naming convention', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  test('Migration is wrapped in a transaction block', () => {
    const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
    expect(migrationContent).toMatch(/^\s*BEGIN;/m);
    expect(migrationContent).toMatch(/COMMIT;\s*$/m);
  });

  test('Migration includes safety assertion aborting if public.bills contains rows', () => {
    const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
    expect(migrationContent).toContain('SELECT COUNT(*) INTO v_bills_count FROM public.bills');
    expect(migrationContent).toContain('v_bills_count > 0');
    expect(migrationContent).toMatch(/RAISE\s+EXCEPTION/i);
  });

  test('Migration drops public.bills strictly without CASCADE', () => {
    const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
    expect(migrationContent).toMatch(/DROP\s+TABLE\s+public\.bills\s*;/i);
    expect(migrationContent).not.toMatch(/DROP\s+TABLE[^\n;]*CASCADE/i);
  });
});
