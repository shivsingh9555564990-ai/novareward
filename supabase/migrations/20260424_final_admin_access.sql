-- 1. Purani policies ko hatana (Clean up)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own transactions" ON profiles;

-- 2. Profiles table ke liye Full Access (Anon Role ke liye)
CREATE POLICY "Master_Admin_Access" 
ON public.profiles 
FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);

-- 3. Transactions table ke liye Full Access
CREATE POLICY "Master_Trans_Access" 
ON public.transactions 
FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);

-- 4. Database level par permissions dena
GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.transactions TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;

-- 5. Row Level Security ko Force refresh karna
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

