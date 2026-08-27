import '@testing-library/jest-dom/vitest';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://dummy-project.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy-service-role-key';
process.env.CRON_SECRET = 'replace_with_a_random_server_only_secret_of_at_least_32_characters';
