# IMPLEMENTATION PLAN
## Google OAuth Comprehensive Fix

---

## PHASE 1: FIX THE 401 BUG (CRITICAL)

### File: app/api/auth/onboarding/password/route.ts

**Current code (Line ~45):**
```typescript
const { error: passwordError } = await supabaseServer.auth.admin.updateUserById(
  user.id,
  { password },
);
```

**Change to:**
```typescript
const { error: passwordError } = await sessionClient.auth.updateUser({ password });
```

**Why this works:**
- `auth.updateUser()` is called on the session-aware SSR client
- Supabase Auth updates the password AND refreshes the session atomically
- Browser receives new session cookie via SSR cookie middleware
- Next API call (`/api/auth/onboarding/student`) succeeds

**Validation:**
- Test Google signup: password setup → student onboarding (must get 200, not 401)
- Test email/OTP signup: same flow (shares password route)
- Test owner signup: password setup → complete (no student step)

---

## PHASE 2: SINGLE SOURCE OF TRUTH

### File: app/api/auth/account-state/route.ts (NEW)

**Purpose:** Expose `get_account_state()` to authenticated users

**Full implementation:**
```typescript
import { NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sessionClient = createClient();
  const { data: { user }, error: userError } = await sessionClient.auth.getUser();

  if (userError || !user?.email) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { data, error } = await supabaseServer.rpc('get_account_state', {
    p_email: user.email,
  });

  if (error) {
    console.error('Account state lookup failed:', error);
    return NextResponse.json(
      { error: 'Unable to determine account state.' },
      { status: 500 }
    );
  }

  const state = Array.isArray(data) ? data[0] : data;

  if (!state || state.user_id !== user.id) {
    return NextResponse.json(
      { error: 'Account state mismatch.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    missing_step: state.missing_step,
    is_complete: state.is_complete,
    role: state.role,
    password_set: state.password_set,
  });
}
```

**Security:**
- Requires authenticated session (not publicly accessible)
- Only returns user's own state (checked via user_id match)
- Uses service-role client internally (get_account_state requires service_role grant)

---

### File: lib/auth/context.tsx

**Current code (Lines ~45-85):** Reimplements completion logic client-side

**Change to:**

```typescript
const refreshAuthState = async (): Promise<void> => {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;

  if (!session?.user) {
    setUser(null);
    setProfile(null);
    setAccountCompletionStep(null);
    return;
  }

  setUser(session.user);

  // Fetch profile for UI display purposes
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  setProfile(profileData as Profile | null);

  if (!profileData) {
    setAccountCompletionStep(null);
    return;
  }

  // Get canonical completion state from server (single source of truth).
  // This replaces the previous client-side logic that duplicated the
  // get_account_state() SQL function's completion rules.
  try {
    const response = await fetch('/api/auth/account-state');
    if (response.ok) {
      const state = await response.json();
      const step = state.missing_step === 'complete' ? 'complete' : state.missing_step;
      setAccountCompletionStep(step as AccountCompletionStep);
    } else {
      // Fallback: if API fails, assume incomplete to be safe
      setAccountCompletionStep(null);
    }
  } catch (error) {
    console.error('Unable to fetch account state:', error);
    setAccountCompletionStep(null);
  }
};
```

**Benefits:**
- ✅ Eliminates duplicate completion logic
- ✅ Client and server always agree on completion state
- ✅ Changes to completion requirements only need SQL function update

---

## PHASE 3: FIX LOGIN PAGE TAB BEHAVIOR

### File: app/auth/login/page.tsx

**Current code (Lines ~190-220):**
```typescript
useEffect(() => {
  const reason = searchParams.get('reason');
  
  if (reason === 'no-account') {
    setAuthMessage({ ... });
    router.replace(`/auth/login?tab=${activeTab}`);  // ❌ BUG
  }
}, [searchParams, router, activeTab]);
```

**Change to:**
```typescript
useEffect(() => {
  const error = searchParams.get('error');
  const reason = searchParams.get('reason');

  if (reason === 'no-account') {
    setAuthMessage({
      variant: 'error',
      title: 'Account not found',
      description: 'No HostelHub account exists with this Google email. Please create an account first.',
      action: {
        label: 'Create account',
        onClick: () => {
          setAuthMessage(null);
          setActiveTab('signup');
          router.replace('/auth/login?tab=signup');
        },
      },
    });
    // ✅ REMOVED: router.replace(`/auth/login?tab=${activeTab}`)
    return;
  }

  if (reason === 'signin') {
    setAuthMessage({
      variant: 'error',
      title: 'Account already exists',
      description: 'An account with this Google email already exists. Please sign in instead.',
      action: {
        label: 'Sign in',
        onClick: () => {
          setAuthMessage(null);
          setActiveTab('login');
          router.replace('/auth/login?tab=login');
        },
      },
    });
    // ✅ REMOVED: router.replace(`/auth/login?tab=${activeTab}`)
    return;
  }

  if (error || reason) {
    setAuthMessage({
      variant: 'error',
      title: 'Sign-in issue',
      description: 'Unable to complete that sign-in request. Please sign in to continue.',
    });
    router.replace('/auth/login');
  }
}, [searchParams, router]);  // ✅ REMOVED: activeTab dependency
```

**Key changes:**
1. Remove `router.replace(\`/auth/login?tab=${activeTab}\`)` calls
2. Only call `router.replace` in action button onClick after explicit user action
3. Remove `activeTab` from effect dependencies

---

## PHASE 4: DOCUMENTATION UPDATE

### File: components/dashboard-layout.tsx

**Change:** Add comment explaining server-derived state (no behavior change)

```typescript
// Account completion check now uses server-derived state from AuthProvider,
// which calls /api/auth/account-state → get_account_state(). This is the
// single source of truth for account completion. Direct navigation to dashboard
// routes with an incomplete account will be caught here and redirected to the
// appropriate onboarding step.
useEffect(() => {
  if (loading || !profile) return;

  if (accountCompletionStep === 'role') {
    router.push('/auth/select-role');
    return;
  }

  if (accountCompletionStep === 'password' || accountCompletionStep === 'student_onboarding') {
    router.push('/auth/setup-password');
  }
}, [loading, profile, accountCompletionStep, router]);
```

---

## VALIDATION PLAN

### Build Verification
```bash
npx tsc --noEmit
npm run build
```

### Test Matrix

**Test A: New Google Signup**
1. Logout
2. Click "Create Account" → Google (new identity)
3. Select student role
4. Enter password
5. **Verify:** POST /api/auth/onboarding/password → 200
6. **Verify:** POST /api/auth/onboarding/student → 200 (NOT 401)
7. **Verify:** Redirected to /student/dashboard
8. **Verify:** Dashboard renders without redirect

**Test B: Abandoned After Role**
1. Day 1: Signup → Google → Select student → Close tab
2. Day 2: Click "Create Account" → Google (same identity)
3. **Verify:** Redirected to /auth/select-role (NOT /auth/setup-password)
4. Select student → password → complete
5. **Verify:** Dashboard access granted

**Test D: Completed Account + Signup**
1. Have completed student account
2. Logout
3. Click "Create Account" → Google
4. **Verify:** Shows "Account already exists"
5. **Verify:** Stays on Create Account tab (no automatic switch)
6. Click "Sign in instead" button
7. **Verify:** Now switches to Sign In tab

**Test F: Missing Account + Login**
1. Click "Sign In" → Google (never signed up)
2. **Verify:** Shows "Account not found"
3. **Verify:** Stays on Sign In tab (no automatic switch)
4. Click "Create account" button
5. **Verify:** Now switches to Create Account tab

**Test H: Direct Dashboard Access**
1. Have incomplete account (role + no password)
2. Type /student/dashboard in URL bar
3. **Verify:** Redirected to /auth/setup-password
4. Complete password setup
5. **Verify:** Redirected to /student/dashboard
6. **Verify:** Dashboard renders

**Test I: Google Password → Student (401 fix)**
1. Google signup → student role → password page
2. Enter password
3. **Verify:** Console shows POST /api/auth/onboarding/password → 200
4. **Verify:** Console shows POST /api/auth/onboarding/student → 200 (NOT 401)
5. **Verify:** No authentication errors

**Test K: Owner Flow**
1. Google signup → owner role → password
2. **Verify:** Redirected to /owner/dashboard (no student step)
3. **Verify:** Dashboard renders

---

## SUCCESS CRITERIA

### Must Pass
✅ Build: `npx tsc --noEmit` and `npm run build` succeed
✅ Test A: 401 eliminated for Google signup
✅ Test B: Abandoned signup restarts from role
✅ Test D: No automatic tab switch for completed account
✅ Test F: No automatic tab switch for missing account
✅ Test H: Incomplete accounts redirected from dashboard
✅ Test I: Student onboarding succeeds after password
✅ Test K: Owner flow completes without errors

### No Regressions
✅ Email/OTP signup still works
✅ Owner onboarding still works
✅ Completed accounts cannot be reset
✅ No service-role credentials exposed

---

## ROLLBACK PLAN

If critical issues found post-deployment:

1. **Revert password route change:**
   ```typescript
   // Restore admin API temporarily
   await supabaseServer.auth.admin.updateUserById(user.id, { password })
   ```

2. **Revert context.tsx changes:**
   Restore client-side completion logic

3. **Remove account-state API:**
   Delete app/api/auth/account-state/route.ts

4. **Revert login page:**
   Restore router.replace calls

---

END OF IMPLEMENTATION PLAN
