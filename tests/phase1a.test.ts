import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Phase 1A: Student Fees Deduplication & Room Vacation Architecture', () => {
  const migrationPath = resolve(__dirname, '../supabase/migrations/20261001000000_phase1a_fees_and_room_vacation.sql');
  const migrationContent = readFileSync(migrationPath, 'utf-8');

  test('Migration includes pre-check that detects and halts on existing duplicate fees', () => {
    expect(migrationContent).toContain('MIGRATION STOPPED: Found % duplicate');
    expect(migrationContent).toContain('GROUP BY allocation_id, month_year');
    expect(migrationContent).toContain('HAVING COUNT(*) > 1');
  });

  test('Migration establishes unique constraint on student_fees(allocation_id, month_year)', () => {
    expect(migrationContent).toContain('uq_student_fees_allocation_month');
    expect(migrationContent).toContain('UNIQUE (allocation_id, month_year)');
  });

  test('Migration ensures create_student_fees is strictly idempotent with conflict target', () => {
    expect(migrationContent).toContain('ON CONFLICT (allocation_id, month_year) DO NOTHING');
    expect(migrationContent).toContain('CREATE OR REPLACE FUNCTION public.create_student_fees');
  });

  test('Migration defines vacate_room_allocation with caller authentication and authorization', () => {
    expect(migrationContent).toContain('CREATE OR REPLACE FUNCTION public.vacate_room_allocation');
    expect(migrationContent).toContain('Authentication required to vacate room allocation');
    expect(migrationContent).toContain('r_alloc.hostel_owner_id = v_caller_id');
    expect(migrationContent).toContain('r_alloc.student_user_id = v_caller_id');
    expect(migrationContent).toContain('public.has_role(v_caller_id, \'super_admin\'::public.app_role)');
  });

  test('vacate_room_allocation synchronizes room occupancy and does NOT create mock payments', () => {
    expect(migrationContent).toContain('PERFORM public.sync_room_occupancy(r_alloc.room_id)');
    expect(migrationContent).not.toMatch(/INSERT INTO public\.payments/);
    expect(migrationContent).not.toMatch(/mock_order_/);
  });

  test('vacate_room_allocation safely handles future pending fees without altering paid or past fees', () => {
    expect(migrationContent).toContain("UPDATE public.student_fees");
    expect(migrationContent).toContain("SET status = 'cancelled'");
    expect(migrationContent).toContain("status = 'pending'");
    expect(migrationContent).toContain("due_date > CURRENT_DATE");
    // Ensure paid fees are never touched
    expect(migrationContent).not.toContain("WHERE status = 'paid'");
  });

  test('All 4 application callers have replaced checkout_student with vacate_room_allocation', () => {
    const ownerRequests = readFileSync(resolve(__dirname, '../app/owner/requests/page.tsx'), 'utf-8');
    const ownerStudents = readFileSync(resolve(__dirname, '../app/owner/students/page.tsx'), 'utf-8');
    const ownerStudentDetail = readFileSync(resolve(__dirname, '../app/owner/students/[id]/page.tsx'), 'utf-8');
    const studentDashboard = readFileSync(resolve(__dirname, '../app/student/dashboard/page.tsx'), 'utf-8');

    expect(ownerRequests).toContain("supabase.rpc('vacate_room_allocation'");
    expect(ownerRequests).not.toContain("checkout_student");

    expect(ownerStudents).toContain("supabase.rpc('vacate_room_allocation'");
    expect(ownerStudents).not.toContain("checkout_student");

    expect(ownerStudentDetail).toContain("supabase.rpc('vacate_room_allocation'");
    expect(ownerStudentDetail).not.toContain("checkout_student");

    expect(studentDashboard).toContain("supabase.rpc('vacate_room_allocation'");
    expect(studentDashboard).not.toContain("checkout_student");
  });

  test('Migration revokes execution permissions for both legacy checkout_student overloads', () => {
    expect(migrationContent).toContain('REVOKE ALL ON FUNCTION public.checkout_student(UUID) FROM anon, authenticated, public;');
    expect(migrationContent).toContain('REVOKE ALL ON FUNCTION public.checkout_student(UUID, UUID, NUMERIC) FROM anon, authenticated, public;');
  });
});
