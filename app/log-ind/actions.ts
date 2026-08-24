"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const emailSkema = z.email();

export type LogIndSvar =
  | { status: "sendt"; besked: string }
  | { status: "fejl"; besked: string }
  | undefined;

/** Adressen siden kører på — virker både lokalt og på Vercel. */
async function hentOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protokol = h.get("x-forwarded-proto") ?? "http";
  return `${protokol}://${host}`;
}

export async function sendMagiskLink(
  _forrige: LogIndSvar,
  formData: FormData,
): Promise<LogIndSvar> {
  const t = await getTranslations("logInd");

  const indtastet = formData.get("email");
  const resultat = emailSkema.safeParse(
    typeof indtastet === "string" ? indtastet.trim().toLowerCase() : "",
  );
  if (!resultat.success) {
    return { status: "fejl", besked: t("ugyldigEmail") };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: resultat.data,
    options: {
      // Lukket test: kun brugere, der allerede er oprettet i Supabase,
      // kan logge ind. Ingen kan oprette sig selv.
      shouldCreateUser: false,
      emailRedirectTo: `${await hentOrigin()}/auth/callback`,
    },
  });

  if (error?.status === 429) {
    return { status: "fejl", besked: t("forMangeForsoeg") };
  }

  // Er adressen ukendt, svarer Supabase med en fejl. Vi svarer alligevel
  // "tjek din indbakke" — ellers kunne enhver bruge siden til at afgøre,
  // om en given mailadresse har en konto.
  if (error && error.status !== 422 && error.code !== "otp_disabled") {
    return { status: "fejl", besked: t("nogetGikGalt") };
  }

  return { status: "sendt", besked: t("tjekIndbakke") };
}
