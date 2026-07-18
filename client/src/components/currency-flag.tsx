import type { AppCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

export function CurrencyFlag({
  code,
  className,
}: {
  code: AppCurrency;
  className?: string;
}) {
  const base = cn(
    "block h-3.5 w-[21px] shrink-0 overflow-hidden rounded-sm bg-transparent sm:h-4 sm:w-6",
    className
  );

  if (code === "MAD") {
    return (
      <svg
        viewBox="0 0 900 600"
        preserveAspectRatio="none"
        className={base}
        aria-hidden
        focusable="false"
      >
        <rect width="900" height="600" fill="#C1272D" />
        <path
          fill="none"
          stroke="#006233"
          strokeWidth="28"
          d="M450 168 L504 334 L330 232 H570 L396 334 Z"
        />
      </svg>
    );
  }

  if (code === "EUR") {
    return (
      <svg
        viewBox="0 0 810 540"
        preserveAspectRatio="none"
        className={base}
        aria-hidden
        focusable="false"
      >
        <rect width="810" height="540" fill="#003399" />
        <g fill="#FFCC00">
          {[
            [405, 90],
            [480, 112],
            [535, 168],
            [557, 243],
            [535, 318],
            [480, 374],
            [405, 396],
            [330, 374],
            [275, 318],
            [253, 243],
            [275, 168],
            [330, 112],
          ].map(([cx, cy], index) => (
            <circle key={index} cx={cx} cy={cy} r="18" />
          ))}
        </g>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 7410 3900"
      preserveAspectRatio="none"
      className={base}
      aria-hidden
      focusable="false"
    >
      <rect width="7410" height="3900" fill="#B22234" />
      <path
        d="M0 450H7410M0 1050H7410M0 1650H7410M0 2250H7410M0 2850H7410M0 3450H7410"
        stroke="#fff"
        strokeWidth="300"
      />
      <rect width="2964" height="2100" fill="#3C3B6E" />
    </svg>
  );
}
