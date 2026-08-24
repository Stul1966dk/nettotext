import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { logUd } from "./actions";

/**
 * Adgangskontrollen for hele appen ligger her — ikke i proxy.ts.
 * getUser() spørger Supabase, om sessionen er ægte; getSession() ville
 * blot stole på en cookie fra browseren.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/log-ind");
  }

  const t = await getTranslations("app");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-kant bg-kort">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-gran-let">
            NettoText
          </span>

          <div className="flex items-center gap-4">
            <span className="truncate text-sm text-gran-let">{user.email}</span>
            <form action={logUd}>
              <button
                type="submit"
                className="rounded-lg border border-kant px-3 py-1.5 text-sm text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran"
              >
                {t("logUd")}
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        {children}
      </main>
    </div>
  );
}
