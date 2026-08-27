# ============================================================================
# MANUAL SQL BACKUP STRATEGY GUIDE
# HostelHub Electricity Management - Pre-Migration Backup
# ============================================================================

## ⚠️ CRITICAL DISCLAIMERS

### What This IS:
- **Metadata and data export** for the specific tables the migration depends on
- **Validation baseline** to verify data integrity before/after migration
- **Manual restoration reference** if you need to verify data wasn't corrupted
- **Rollback capability** for NEW electricity objects only

### What This IS NOT:
- ❌ **NOT a complete database backup** (doesn't capture everything)
- ❌ **NOT equivalent to Supabase's official backup system** (use that for full protection)
- ❌ **NOT a point-in-time restore** (cannot restore entire database state)
- ❌ **NOT captured:** Binary data, complete RLS policies, auth schema, extensions, sequences

### Recommendation:
**Use Supabase's official backup feature if available.** This manual backup is a 
supplementary safety measure for users who cannot access Supabase's premium backup 
feature, focusing specifically on the tables the electricity migration depends on.

---

## 📋 WHAT THE MIGRATION DEPENDS ON

### Migration Analysis - Foreign Key Dependencies:

The electricity migration creates 7 new tables that reference these EXISTING objects:

1. **hostels table** (referenced by 6 new tables)
   - electricity_meters.hostel_id
   - electricity_rate_history.hostel_id
   - meter_readings.hostel_id
   - billing_segments.hostel_id
   - student_electricity_charges.hostel_id
   - occupancy_change_events.hostel_id

2. **rooms table** (referenced by 5 new tables)
   - electricity_meters.room_id
   - meter_readings.room_id
   - billing_segments.room_id
   - student_electricity_charges.room_id
   - occupancy_change_events.room_id

3. **room_allocations table** (referenced by 2 new tables)
   - segment_occupants.allocation_id
   - occupancy_change_events.allocation_id

4. **auth.users table** (referenced by 7 new tables)
   - electricity_meters.created_by, deactivated_by
   - electricity_rate_history.created_by
   - meter_readings.recorded_by
   - segment_occupants.student_id
   - student_electricity_charges.student_id
   - occupancy_change_events.student_id

### What Gets Created (NEW objects):
- 3 ENUMs: reading_reason, segment_type, occupancy_change_type
- 7 Tables: electricity_meters, electricity_rate_history, meter_readings, 
  billing_segments, segment_occupants, student_electricity_charges, 
  occupancy_change_events
- 2 Triggers: trg_validate_meter_reading_value, trg_detect_occupancy_change
- 2 Functions: validate_meter_reading_value(), detect_occupancy_change()
- 21+ Indexes
- 13+ Constraints

---

## 🎯 BACKUP OBJECTIVES

1. **Capture schema metadata** for dependent tables (hostels, rooms, room_allocations)
2. **Export current data** from those tables
3. **Document baseline counts** to verify no data loss
4. **Verify prerequisites** (auth.users accessible, no naming conflicts)
5. **Enable rollback** of NEW electricity objects if migration fails

---

## 📂 FILES CREATED

### 1. manual_backup_queries.sql
**Purpose:** 10 READ-ONLY queries to export schema and data
**Safety:** 100% read-only, modifies nothing
**Run:** In Supabase SQL Editor BEFORE applying migration
**Action:** Save all query results (copy to text file or download CSV)

### 2. rollback_electricity_migration.sql
**Purpose:** Remove ALL new electricity objects if migration fails
**Safety:** Destructive - only run if rollback needed
**Run:** In Supabase SQL Editor ONLY if migration fails
**Action:** Drops 7 tables, 3 ENUMs, 2 triggers, 2 functions

---

## 🚀 STEP-BY-STEP EXECUTION PLAN

### PHASE 1: Pre-Migration Backup (REQUIRED)

**1. Open Supabase SQL Editor**
   - Go to: https://supabase.com/dashboard/project/pcwlceklvjuddghogfbf
   - Navigate: SQL Editor

**2. Run manual_backup_queries.sql**
   - Open file: manual_backup_queries.sql
   - Copy entire contents
   - Paste in SQL Editor
   - Click: RUN

**3. Save All Query Results**
   For EACH query result:
   - Copy the output table
   - Paste into a text file or spreadsheet
   - Save as: backup_results_YYYYMMDD.txt
   
   Critical queries to save:
   - Query 4: Record counts (for comparison after migration)
   - Query 5: Full hostels data
   - Query 6: Full rooms data
   - Query 7: Full room_allocations data
   - Query 10: Existing electricity objects (should be empty)

**4. Verify Backup Completeness**
   Check that you have captured:
   ✓ Schema metadata for 3 dependent tables
   ✓ All constraints and indexes
   ✓ Record counts documented
   ✓ Complete data exports saved
   ✓ Confirmation no electricity objects exist yet

---

### PHASE 2: Apply Migration (After backup complete)

**Option A: CLI (Recommended)**
\\\powershell
cd "c:\Users\BIT\Downloads\hostelhub combine\files"
supabase db push --linked
\\\

**Option B: Manual SQL**
1. Open: supabase/migrations/20260826000001_electricity_management_foundation.sql
2. Copy entire contents
3. Paste in Supabase SQL Editor
4. Run
5. Check for errors

---

### PHASE 3: Post-Migration Validation

**1. Run post_migration_validation.sql**
   Verify:
   ✓ All 3 ENUMs created
   ✓ All 7 tables created
   ✓ All triggers/functions created
   ✓ Record counts unchanged (compare with backup Query 4 results)

**2. Compare Data Counts**
   Run Query 4 from manual_backup_queries.sql again
   Compare with saved backup results
   **Expected:** Identical counts for hostels, rooms, room_allocations

---

### PHASE 4: If Migration Fails (Rollback)

**⚠️  ONLY IF MIGRATION FAILS OR ENCOUNTERS ERRORS**

**1. Open rollback_electricity_migration.sql**

**2. Review the script** (understand what it will do)

**3. Run in Supabase SQL Editor**
   - This will DROP all new electricity objects
   - Existing tables (hostels, rooms, room_allocations) remain intact

**4. Verify Rollback Completion**
   - Run Query 10 from manual_backup_queries.sql
   - Expected result: 0 electricity objects found

**5. Verify Existing Data Intact**
   - Run Query 4 from manual_backup_queries.sql
   - Compare counts with your saved backup results
   - Expected: Identical counts

---

## 📊 QUERY-BY-QUERY BREAKDOWN

### Query 1: Export table schemas
- **What it does:** Lists columns, data types, defaults for dependent tables
- **Read-only:** ✅ Yes
- **Modifies data:** ❌ No
- **Save results:** Yes (for reference)

### Query 2: Export constraints
- **What it does:** Lists primary keys, foreign keys, unique constraints
- **Read-only:** ✅ Yes
- **Modifies data:** ❌ No
- **Save results:** Yes (for reference)

### Query 3: Export indexes
- **What it does:** Lists all indexes on dependent tables
- **Read-only:** ✅ Yes
- **Modifies data:** ❌ No
- **Save results:** Yes (for reference)

### Query 4: Record counts (CRITICAL)
- **What it does:** Counts records in hostels, rooms, room_allocations
- **Read-only:** ✅ Yes
- **Modifies data:** ❌ No
- **Save results:** ✅ REQUIRED (for post-migration comparison)

### Query 5: Export hostels data
- **What it does:** Full data export of hostels table
- **Read-only:** ✅ Yes
- **Modifies data:** ❌ No
- **Save results:** ✅ REQUIRED (for manual restoration if needed)

### Query 6: Export rooms data
- **What it does:** Full data export of rooms table
- **Read-only:** ✅ Yes
- **Modifies data:** ❌ No
- **Save results:** ✅ REQUIRED (for manual restoration if needed)

### Query 7: Export room_allocations data
- **What it does:** Full data export of room_allocations table
- **Read-only:** ✅ Yes
- **Modifies data:** ❌ No
- **Save results:** ✅ REQUIRED (for manual restoration if needed)

### Query 8: Verify auth.users
- **What it does:** Confirms auth.users table is accessible
- **Read-only:** ✅ Yes
- **Modifies data:** ❌ No
- **Save results:** Yes (for reference)

### Query 9: List existing ENUMs
- **What it does:** Shows all current ENUM types
- **Read-only:** ✅ Yes
- **Modifies data:** ❌ No
- **Save results:** Yes (should NOT include electricity ENUMs)

### Query 10: Check for conflicts
- **What it does:** Searches for existing electricity-related objects
- **Read-only:** ✅ Yes
- **Modifies data:** ❌ No
- **Save results:** ✅ REQUIRED (should return 0 rows before migration)

---

## ✅ SUCCESS CRITERIA

### Before Migration:
□ All 10 backup queries completed successfully
□ All query results saved to file
□ Record counts documented (Query 4)
□ Full data exports saved (Queries 5, 6, 7)
□ Query 10 confirms no electricity objects exist (0 rows)

### After Migration:
□ post_migration_validation.sql shows all objects created
□ Record counts unchanged (compare Query 4 before/after)
□ No errors in Supabase logs

### After Rollback (if needed):
□ All electricity objects removed (Query 10 returns 0 rows)
□ Existing tables intact (hostels, rooms, room_allocations exist)
□ Record counts match backup (Query 4 matches saved results)

---

## 🆘 TROUBLESHOOTING

### If migration fails with foreign key error:
1. Check that hostels, rooms, room_allocations tables exist
2. Verify tables have data (not empty)
3. Check auth.users is accessible
4. Run rollback script
5. Review error message and diagnose

### If migration creates objects but data looks wrong:
1. Compare Query 4 results (before vs after)
2. If counts differ, investigate why
3. Check Supabase logs for errors
4. Consider rollback if data corruption suspected

### If you need to manually restore data:
1. Open saved backup results (Queries 5, 6, 7)
2. Create INSERT statements from exported data
3. This is manual and error-prone - use as last resort

---

## ⏱️ ESTIMATED TIME

- Running backup queries: 5 minutes
- Saving results: 5 minutes
- Applying migration: 1-2 minutes
- Post-migration validation: 5 minutes
- **Total: ~15-20 minutes**

If rollback needed: +5 minutes

---

## 🎓 KEY TAKEAWAYS

1. **This is NOT a complete database backup** - it's a targeted export of 
   migration dependencies

2. **Save Query 4 results** - critical for verifying no data loss

3. **The migration is additive** - creates new objects, doesn't modify existing 
   tables

4. **Rollback only affects NEW objects** - removes electricity tables/ENUMs, 
   leaves existing data intact

5. **Foreign key integrity** - migration will fail if dependent tables 
   (hostels, rooms, room_allocations) don't exist or are empty

6. **Use official backups when possible** - this manual approach is a 
   supplementary safety measure, not a replacement for proper backups

---

## 📞 NEXT STEPS

1. Run manual_backup_queries.sql and save ALL results
2. Verify backup completeness (checklist above)
3. Apply migration (CLI or manual SQL)
4. Run post_migration_validation.sql
5. Compare record counts
6. Report results

**Only run rollback script if migration fails!**

