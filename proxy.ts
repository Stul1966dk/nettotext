import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { refreshSession } from "./lib/supabase/refreshSession";

const intlProxy = createMiddleware(routing);

const erMarketingSti = (pathname: string) =>
  pathname === "/" || /^\/(da|en)(\/|$)/.test(pathname);

export default async function proxy(request: NextRequest) {
  // Marketing-siderne har sproget i URL'en og kender ikke til login.
  if (erMarketingSti(request.nextUrl.pathname)) {
    return intlProxy(request);
  }

  // Alt andet — appen, login og auth-callback — får sessionen fornyet.
  return refreshSession(request);
}

export const config = {
  // Alt undtagen Next.js' egne filer og billeder.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
