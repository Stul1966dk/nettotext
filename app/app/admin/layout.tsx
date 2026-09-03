import { notFound } from "next/navigation";

import { hentAdmin } from "@/lib/admin";

/**
 * Adgangen til hele /app/admin ligger her, på samme måde som /app-layoutet
 * afgør, om man er logget ind. Så er hver fremtidig underside beskyttet
 * automatisk, uden at nogen skal huske det.
 *
 * `notFound()` og ikke en fejlbesked: en almindelig bruger, der gætter på
 * adressen, skal ikke få at vide, at der findes en adminside, hun ikke må
 * se. Siden findes ikke for hende.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await hentAdmin();
  if (!admin) notFound();

  return <>{children}</>;
}
