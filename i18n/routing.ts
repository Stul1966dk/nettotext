import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // V1 kører kun på dansk. Tilføj "en" her, når engelsk skal med.
  locales: ["da"],
  defaultLocale: "da",
  // Sprogkoden står altid i URL'en (/da/...). Nødvendigt for at Google kan
  // indeksere hvert sprog for sig — se docs/mvp-oplaeg, afsnit 3.
  localePrefix: "always",
});
