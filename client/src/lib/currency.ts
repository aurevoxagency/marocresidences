export type AppCurrency = "MAD" | "EUR" | "USD";

export const CURRENCY_OPTIONS: Array<{
  code: AppCurrency;
  label: string;
  symbol: string;
}> = [
  { code: "MAD", label: "MAD", symbol: "MAD" },
  { code: "EUR", label: "EUR", symbol: "€" },
  { code: "USD", label: "USD", symbol: "$" },
];

/** Approximate rates: 1 unit of currency = X MAD */
const TO_MAD: Record<AppCurrency, number> = {
  MAD: 1,
  EUR: 10.85,
  USD: 10.0,
};

const STORAGE_KEY = "marocresidences.currency";

export function isAppCurrency(value: unknown): value is AppCurrency {
  return value === "MAD" || value === "EUR" || value === "USD";
}

export function getStoredCurrency(): AppCurrency {
  if (typeof window === "undefined") {
    return "MAD";
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  return isAppCurrency(raw) ? raw : "MAD";
}

export function storeCurrency(currency: AppCurrency) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, currency);
}

/** Convert an amount from a source currency into the selected display currency. */
export function convertAmount(
  amount: number,
  from: AppCurrency | string | null | undefined,
  to: AppCurrency
) {
  const value = Number(amount);

  if (!Number.isFinite(value)) {
    return 0;
  }

  const fromCode = isAppCurrency(from) ? from : "MAD";
  const amountInMad = value * TO_MAD[fromCode];
  return Math.round((amountInMad / TO_MAD[to]) * 100) / 100;
}

export function formatMoney(
  amount: number,
  currency: AppCurrency,
  from: AppCurrency | string | null | undefined = "MAD"
) {
  const converted = convertAmount(amount, from, currency);
  const option = CURRENCY_OPTIONS.find((item) => item.code === currency);
  const formatted = converted.toLocaleString("fr-FR", {
    minimumFractionDigits: currency === "MAD" ? 0 : 2,
    maximumFractionDigits: currency === "MAD" ? 0 : 2,
  });

  if (currency === "EUR") {
    return `${formatted} €`;
  }

  if (currency === "USD") {
    return `$${formatted}`;
  }

  return `${formatted} ${option?.symbol || "MAD"}`;
}

export function currencyLabel(currency: AppCurrency) {
  return CURRENCY_OPTIONS.find((item) => item.code === currency)?.code || currency;
}
