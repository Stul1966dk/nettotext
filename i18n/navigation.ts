import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Brug disse i stedet for next/link og next/navigation på marketing-siderne,
// så sprogkoden automatisk sættes ind i URL'en.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
