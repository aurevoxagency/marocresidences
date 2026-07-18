import type { AppLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageFlag({
  code,
  className,
}: {
  code: AppLanguage;
  className?: string;
}) {
  const base = cn(
    "block h-3.5 w-[21px] shrink-0 overflow-hidden rounded-sm bg-transparent sm:h-4 sm:w-6",
    className
  );

  if (code === "fr") {
    return (
      <svg
        viewBox="0 0 3 2"
        preserveAspectRatio="none"
        className={base}
        aria-hidden
        focusable="false"
      >
        <rect width="1" height="2" y="0" fill="#002395" />
        <rect x="1" width="1" height="2" y="0" fill="#FFFFFF" />
        <rect x="2" width="1" height="2" y="0" fill="#ED2939" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 60 30"
      preserveAspectRatio="none"
      className={base}
      aria-hidden
      focusable="false"
    >
      <rect width="60" height="30" fill="#012169" />
      <path d="M0 0 L60 30 M60 0 L0 30" stroke="#fff" strokeWidth="6" />
      <path d="M0 0 L60 30 M60 0 L0 30" stroke="#C8102E" strokeWidth="2" />
      <path d="M30 0 V30 M0 15 H60" stroke="#fff" strokeWidth="10" />
      <path d="M30 0 V30 M0 15 H60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}
