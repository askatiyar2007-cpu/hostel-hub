-- Fix signup trigger failure caused by missing raw_user_meta_data and not-null full_name constraint
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert into profiles table with metadata fallbacks
  INSERT INTO public.profiles (user_id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(NEW.email, '@', 1),
      'User'
    ),
    NEW.email,
    CASE 
      WHEN NEW.raw_user_meta_data->>'role' IN ('super_admin', 'hostel_owner', 'student', 'parent') 
      THEN (NEW.raw_user_meta_data->>'role')::public.app_role
      ELSE 'student'::public.app_role
    END
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert into user_roles table with validation
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE 
      WHEN NEW.raw_user_meta_data->>'role' IN ('super_admin', 'hostel_owner', 'student', 'parent') 
      THEN (NEW.raw_user_meta_data->>'role')::public.app_role
      ELSE 'student'::public.app_role
    END
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;
