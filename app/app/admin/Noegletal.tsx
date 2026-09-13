import { getTranslations } from "next-intl/server";

import { hentBudgetstatus } from "@/lib/budget";
import { hentFordeling, hentNoegletal } from "@/lib/noegletal";

/**
 * Nøgletallene på adminforsiden — den anden halvdel af trin 6.
 *
 * Serverkomponent. Alt hentes her, hvor `service_role` hører hjemme, og der
 * sendes kun færdige tal til browseren. Adgangen er allerede afgjort i
 * app/app/admin/layout.tsx, FØR denne komponent overhovedet tegnes.
 *
 * Hvorfor tallene står på FORSIDEN og ikke bag et klik: de er kun noget
 * værd, hvis de bliver set. Det var også begrundelsen for fejltallet, og den
 * gælder dobbelt her — prøvekvoten på 5 og det daglige budgetloft er begge
 * gæt, og de her tal er den eneste måde at opdage, at et af dem er sat galt.
 */

const kr = new Intl.NumberFormat("da-DK", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const heltal = new Intl.NumberFormat("da-DK");

function Tal({
  label,
  vaerdi,
  under,
  fremhaev = false,
}: {
  label: string;
  vaerdi: string;
  under?: string;
  fremhaev?: boolean;
}) {
  return (
    <div className="rounded-xl border border-kant bg-kort p-5">
      <p className="font-mono text-[0.65rem] uppercase tracking-widest text-gran-let">
        {label}
      </p>
      <p
        className={`mt-2 font-mono text-2xl ${fremhaev ? "text-rav" : "text-gran"}`}
      >
        {vaerdi}
      </p>
      {under && (
        <p className="mt-1 text-sm leading-relaxed text-gran-let">{under}</p>
      )}
    </div>
  );
}

export async function Noegletal() {
  const t = await getTranslations("admin");

  const [tal, fordeling] = await Promise.all([
    hentNoegletal(),
    hentFordeling(),
  ]);

  // Budgetstatus KASTER, når DAILY_BUDGET_DKK mangler — med vilje, fordi
  // genereringen skal fejle lukket. Her må den ikke vælte siden: adminen
  // skal kunne se resten af tallene og få at vide, at netop dét mangler.
  const budget = await hentBudgetstatus().catch(() => null);

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="font-mono text-xs uppercase tracking-widest text-gran">
          {t("noegletalOverskrift")}
        </h2>
        <p className="text-sm leading-relaxed text-gran-let">
          {t("noegletalForklaring")}
        </p>
      </div>

      {/* Dagens budget står øverst og alene. Det er det ene tal, der kan
          stoppe produktet for alle brugere på én gang. */}
      <div className="space-y-3 rounded-2xl border border-kant bg-kort p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-gran-let">
            {t("budgetOverskrift")}
          </p>
          <p className="font-mono text-sm text-gran">
            {budget
              ? t("budgetBrugt", {
                  brugt: kr.format(budget.brugt),
                  loft: kr.format(budget.loft),
                })
              : t("budgetUkendt")}
          </p>
        </div>

        {budget && (
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={Math.round(budget.loft)}
            aria-valuenow={Math.round(budget.brugt)}
            className="h-2 w-full overflow-hidden rounded-full bg-bund"
          >
            <div
              className="h-full rounded-full bg-rav"
              style={{
                width: `${Math.min(100, (budget.brugt / budget.loft) * 100)}%`,
              }}
            />
          </div>
        )}
      </div>

      {!tal ? (
        <p
          role="alert"
          className="rounded-lg border border-rav bg-kort px-4 py-3 text-sm leading-relaxed text-gran"
        >
          {t("noegletalUkendt")}
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Tal
              label={t("forbrugIDag")}
              vaerdi={`${kr.format(tal.forbrugIDagPlatform)} kr.`}
              under={t("forbrugPlatform")}
            />
            <Tal
              label={t("forbrugMaaned")}
              vaerdi={`${kr.format(tal.forbrugMaanedPlatform)} kr.`}
              under={t("forbrugBruger", {
                beloeb: kr.format(tal.forbrugMaanedBruger),
              })}
            />
            <Tal
              label={t("tekster")}
              vaerdi={heltal.format(tal.teksterIAlt)}
              under={t("teksterForklaring")}
            />
            <Tal
              label={t("prisPrTekst")}
              vaerdi={
                tal.teksterIAlt > 0
                  ? `${kr.format(tal.teksterKroner / tal.teksterIAlt)} kr.`
                  : t("intetTal")
              }
              under={t("tokens", {
                ind: heltal.format(tal.tokensInd),
                ud: heltal.format(tal.tokensUd),
              })}
            />
            <Tal
              label={t("brugere")}
              vaerdi={heltal.format(tal.brugereIAlt)}
              under={t("brugereNy", { antal: tal.brugereNyUge })}
            />
            {/* Rav, fordi det er det tal, der koster os penge direkte —
                og dét, der afgør, om de fem prøvetekster er sat rigtigt. */}
            <Tal
              label={t("proevetekster")}
              vaerdi={heltal.format(tal.proevetekstGivet)}
              under={t("proevetekstForklaring")}
              fremhaev
            />
            <Tal
              label={t("kladder")}
              vaerdi={heltal.format(tal.kladder)}
              under={t("kladderForklaring")}
            />
            <Tal
              label={t("feedback")}
              vaerdi={
                tal.feedbackOp + tal.feedbackNed > 0
                  ? `${Math.round(
                      (tal.feedbackOp / (tal.feedbackOp + tal.feedbackNed)) *
                        100,
                    )} %`
                  : t("intetTal")
              }
              under={
                tal.feedbackOp + tal.feedbackNed > 0
                  ? t("feedbackAntal", {
                      antal: tal.feedbackOp + tal.feedbackNed,
                    })
                  : t("feedbackIngen")
              }
            />
          </div>

          <div className="space-y-3 rounded-2xl border border-kant bg-kort p-6">
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-gran-let">
              {t("fordelingOverskrift")}
            </p>

            {fordeling.length === 0 ? (
              <p className="text-sm leading-relaxed text-gran-let">
                {t("fordelingTom")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {fordeling.map((r) => (
                      <tr
                        key={`${r.skabelon}-${r.model}`}
                        className="border-t border-kant first:border-t-0"
                      >
                        <td className="py-2 pr-4 text-gran">{r.skabelon}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-gran-let">
                          {r.model}
                        </td>
                        <td className="py-2 pr-4 text-right font-mono text-gran">
                          {heltal.format(r.antal)}
                        </td>
                        <td className="py-2 text-right font-mono text-gran-let">
                          {kr.format(r.kroner)} kr.
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
