/**
 * Stemplet — NettoTexts mærke: det skæve stempel med dobbelt kant og et N,
 * samme motiv som GODKENDT-stemplet. Tegnet som SVG, så det er skarpt i
 * alle størrelser, og i `currentColor`, så det arver farven fra teksten
 * ved siden af og virker på både lys og mørk bund.
 *
 * Favicon'et er en FORENKLET udgave af samme motiv (`app/icon.svg`) —
 * den dobbelte kant klumper sammen ved 16 px. Ændres mærket her, skal
 * icon.svg ændres med.
 */
export function Maerke({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g transform="rotate(-6 32 32)">
        <rect
          x="8"
          y="14"
          width="48"
          height="36"
          rx="5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        <rect
          x="13"
          y="19"
          width="38"
          height="26"
          rx="3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M25 23h4l10 13V23h4v18h-4L29 28v13h-4z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}
