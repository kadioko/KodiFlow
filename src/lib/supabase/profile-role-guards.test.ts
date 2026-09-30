import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

describe('profile role guards', () => {
  let db: PGlite

  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`
      CREATE ROLE authenticated;
      CREATE ROLE anon;
      CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
        $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
      CREATE TABLE public.profiles (
        id uuid PRIMARY KEY, full_name text,
        admin_role text NOT NULL DEFAULT 'none'
      );
      ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Users can view own profile" ON public.profiles
        FOR SELECT USING (id = auth.uid());
      CREATE POLICY "Users can insert own profile" ON public.profiles
        FOR INSERT WITH CHECK (id = auth.uid());
      CREATE POLICY "Users can update own profile" ON public.profiles
        FOR UPDATE USING (id = auth.uid());
      CREATE POLICY "Admins can view admin profiles" ON public.profiles
        FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()));
      GRANT USAGE ON SCHEMA public, auth TO authenticated, anon, service_role;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
      INSERT INTO public.profiles VALUES ('00000000-0000-0000-0000-000000000001', 'Manager', 'none');
    `)
    const migration = readFileSync(resolve('supabase/migrations/202609100001_protect_profile_roles.sql'), 'utf8')
    await db.exec(migration)
    await db.exec(migration)
  }, 20_000)

  beforeEach(async () => { await db.exec('BEGIN; SET LOCAL ROLE authenticated;') })
  afterEach(async () => { await db.exec('ROLLBACK;') })
  afterAll(async () => { await db.close() })

  it('reads and updates ordinary profile settings without recursive RLS', async () => {
    const result = await db.query("UPDATE public.profiles SET full_name = 'Updated' RETURNING full_name")
    expect(result.rows).toEqual([{ full_name: 'Updated' }])
  })

  it('rejects self-promotion through a profile update', async () => {
    await expect(db.exec("UPDATE public.profiles SET admin_role = 'super_admin'"))
      .rejects.toMatchObject({ code: '42501' })
  })

  it('rejects inserting an elevated profile or promoting through upsert', async () => {
    await expect(db.exec(`INSERT INTO public.profiles (id, admin_role)
      VALUES (auth.uid(), 'admin') ON CONFLICT (id) DO UPDATE SET admin_role = EXCLUDED.admin_role`))
      .rejects.toMatchObject({ code: '42501' })
  })

  it('allows the server service role to assign operational roles', async () => {
    await db.exec('SET LOCAL ROLE service_role')
    const result = await db.query("UPDATE public.profiles SET admin_role = 'accountant' RETURNING admin_role")
    expect(result.rows).toEqual([{ admin_role: 'accountant' }])
  })
})
