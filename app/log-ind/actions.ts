"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const emailSkema = z.email();

/** Koden fra login-mailen: seks cifre, hverken flere eller færre. */
const kodeSkema = z.string().regex(/^\d{6}$/);

export type LogIndSvar =
  | { status: "sendt"; besked: string }
  | { status: "fejl"; besked: string }
  | undefined;

export type KodeSvar = { status: "fejl"; besked: string } | undefined;

/** Adressen siden kører på — virker både lokalt og på Vercel. */
async function hentOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protokol = h.get("x-forwarded-proto") ?? "http";
  return `${protokol}://${host}`;
}

export async function sendLoginKode(
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

/**
 * Trin 2: koden fra mailen veksles til en session, og brugeren er logget ind
 * i den fane, hun startede i. Linket i mailen virker fortsat som reserve —
 * det lander i /auth/callback og gør præcis det samme.
 */
export async function bekraeftKode(
  _forrige: KodeSvar,
  formData: FormData,
): Promise<KodeSvar> {
  const t = await getTranslations("logInd");

  const email = emailSkema.safeParse(
    typeof formData.get("email") === "string"
      ? String(formData.get("email")).trim().toLowerCase()
      : "",
  );
  if (!email.success) {
    return { status: "fejl", besked: t("ugyldigEmail") };
  }

  const kode = kodeSkema.safeParse(
    String(formData.get("kode") ?? "").replace(/\s/g, ""),
  );
  if (!kode.success) {
    return { status: "fejl", besked: t("ugyldigKode") };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: email.data,
    token: kode.data,
    type: "email",
  });

  if (error) {
    if (error.status === 429) {
      return { status: "fejl", besked: t("forMangeForsoeg") };
    }
    // Forkert kode, udløbet kode eller ukendt adresse får samme svar.
    // Ellers kunne siden bruges til at afgøre, om en adresse har en konto.
    return { status: "fejl", besked: t("kodenVirkedeIkke") };
  }

  redirect("/app");
}
