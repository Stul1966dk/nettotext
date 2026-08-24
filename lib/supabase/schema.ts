/**
 * Databasen deles med andre projekter, så alle NettoText-tabeller ligger i
 * deres eget skema i stedet for i public. Skemaet skal være slået til under
 * Supabase → Project Settings → API → Exposed schemas.
 */
export const DB_SCHEMA = "nettotext";
