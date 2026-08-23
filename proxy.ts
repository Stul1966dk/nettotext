import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Kun forsiden og sprog-stierne. /app, /api og statiske filer røres ikke —
  // appen bag login har sproget som brugerindstilling, ikke i URL'en.
  matcher: ["/", "/(da|en)/:path*"],
};
