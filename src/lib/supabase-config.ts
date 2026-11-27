// Veřejné přístupové údaje k databázi (Supabase). Jsou veřejné z principu – data chrání pravidla RLS v databázi.
// Proměnné prostředí PUBLIC_SUPABASE_* je mohou přepsat jen tehdy, když jsou nastavené obě a ukazují jinam záměrně (SUPABASE_FROM_ENV=1).
const FROM_ENV = import.meta.env.SUPABASE_FROM_ENV === '1' || import.meta.env.PUBLIC_SUPABASE_FROM_ENV === '1';
export const SUPABASE_URL: string = (FROM_ENV && import.meta.env.PUBLIC_SUPABASE_URL) || 'https://ehakqkhmoacbziwgjniz.supabase.co';
export const SUPABASE_KEY: string = (FROM_ENV && import.meta.env.PUBLIC_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoYWtxa2htb2FjYnppd2dqbml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU3OTA3NzUsImV4cCI6MjExMTM2Njc3NX0.MQ07p0H3Kso3aYPH5GK_9dg7X3mJ8pu-JOfmYcXUAaY';
// Náhled bez databáze (claude.ai artefakt): PUBLIC_DEMO=1 při sestavení.
export const DEMO = import.meta.env.PUBLIC_DEMO === '1';
