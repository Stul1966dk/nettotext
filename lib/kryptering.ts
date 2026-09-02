import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Kryptering af brugernes egne AI-nøgler.
 *
 * CLAUDE.md regel 2: nøglerne krypteres i databasen og dekrypteres KUN
 * server-side i genererings-øjeblikket. "server-only" øverst er ikke pynt —
 * importerer nogen ved et uheld denne fil fra en klient-komponent, fejler
 * bygningen i stedet for at sende krypteringsnøglen ud i browseren.
 *
 * VALGET: AES-256-GCM med en nøgle fra ENCRYPTION_KEY, frem for Supabase
 * Vault/pgsodium. Begrundelsen står i docs/beslutninger.md. Kort: de to er
 * sikkerhedsmæssigt ligeværdige her, og den her er 40 linjer kode, man kan
 * læse og forstå — Vault ville flytte krypteringen ind i SQL-funktioner og
 * binde os tættere til Supabase.
 *
 * GCM og ikke CBC: GCM giver et autentificerings-tag, så en ændret
 * krypteret tekst bliver AFVIST i stedet for at blive dekrypteret til
 * volapyk. Vi opdager altså, hvis nogen har pillet ved databasen.
 */

const ALGORITME = "aes-256-gcm";

/** 12 bytes er GCM's egen anbefaling — hverken mere eller mindre. */
const IV_LAENGDE = 12;

/**
 * Formatets versionsnummer står forrest i hver eneste gemt værdi.
 *
 * Skal algoritmen en dag skiftes, kan gamle rækker stadig læses, fordi de
 * selv siger, hvordan de blev lavet. Uden det ville et skifte betyde, at
 * alle brugere skulle indtaste deres nøgle igen.
 */
const VERSION = "v1";

/**
 * Krypteringsnøglen, læst én gang.
 *
 * Kastes der her, er det en opsætningsfejl hos OS — ikke hos brugeren.
 * Beskeden havner i serverloggen og skal aldrig vises i browseren.
 */
function krypteringsnoegle(): Buffer {
  const raa = process.env.ENCRYPTION_KEY;

  if (!raa) {
    throw new Error(
      "ENCRYPTION_KEY mangler. Lokalt sættes den i .env.local, i produktion " +
        "under Vercel → Settings → Environment Variables. Genereres med: " +
        'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
  }

  const noegle = Buffer.from(raa, "base64");

  if (noegle.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY skal være 32 bytes i base64, men er ${noegle.length}. ` +
        "En for kort nøgle er ikke en lille fejl — den er ingen kryptering.",
    );
  }

  return noegle;
}

/**
 * Krypterer en AI-nøgle til det, der gemmes i ai_keys.encrypted_key.
 *
 * Resultatet ser sådan ud: v1.<iv>.<tag>.<krypteret tekst>, alle dele i
 * base64. IV'et er nyt for hver eneste kryptering — genbruges det med samme
 * nøgle, holder GCM op med at være sikker.
 */
export function krypter(klartekst: string): string {
  const iv = randomBytes(IV_LAENGDE);
  const cipher = createCipheriv(ALGORITME, krypteringsnoegle(), iv);

  const krypteret = Buffer.concat([
    cipher.update(klartekst, "utf8"),
    cipher.final(),
  ]);

  return [
    VERSION,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    krypteret.toString("base64"),
  ].join(".");
}

/**
 * Dekrypterer igen. Kaldes KUN i genererings-øjeblikket og ved "Test
 * forbindelsen" — aldrig for at vise nøglen. Brugeren ser kun key_hint.
 *
 * Fejlbeskederne herfra må aldrig vises i browseren: de fortæller, hvordan
 * lageret er skruet sammen.
 */
export function dekrypter(gemt: string): string {
  const dele = gemt.split(".");

  if (dele.length !== 4 || dele[0] !== VERSION) {
    throw new Error("Krypteret nøgle har et format, vi ikke kender.");
  }

  const [, ivB64, tagB64, krypteretB64] = dele;

  const decipher = createDecipheriv(
    ALGORITME,
    krypteringsnoegle(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  // Fejler final(), er værdien ændret siden krypteringen — eller
  // ENCRYPTION_KEY er en anden end dengang. Begge dele skal fejle højlydt.
  return Buffer.concat([
    decipher.update(Buffer.from(krypteretB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * De sidste fire tegn af nøglen. Det ENESTE, brugeren får at se igen.
 *
 * Nok til at genkende, hvilken nøgle der er gemt — for lidt til at bruge den
 * eller til at gætte resten.
 */
export function noegleHint(apiNoegle: string): string {
  return apiNoegle.trim().slice(-4);
}

/**
 * Sammenligner to nøgler uden at røbe noget gennem tiden, det tager.
 *
 * Bruges, hvor vi skal afgøre, om en indsendt nøgle er den, vi allerede har
 * gemt. Almindelig === svarer hurtigere, jo tidligere det første forskellige
 * tegn står — og det kan i teorien gættes ud fra.
 */
export function noeglerErEns(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");

  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
