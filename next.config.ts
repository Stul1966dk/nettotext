import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  /* config options here */
};

// Kobler sprogfilerne (i18n/request.ts) ind i Next.js.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
