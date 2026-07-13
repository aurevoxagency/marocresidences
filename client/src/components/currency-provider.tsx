import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  type AppCurrency,
  getStoredCurrency,
  storeCurrency,
} from "@/lib/currency";

type CurrencyContextValue = {
  currency: AppCurrency;
  setCurrency: (currency: AppCurrency) => void;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<AppCurrency>("MAD");

  useEffect(() => {
    setCurrencyState(getStoredCurrency());
  }, []);

  const setCurrency = (next: AppCurrency) => {
    setCurrencyState(next);
    storeCurrency(next);
  };

  const value = useMemo(
    () => ({
      currency,
      setCurrency,
    }),
    [currency]
  );

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);

  if (!context) {
    throw new Error("useCurrency must be used within CurrencyProvider");
  }

  return context;
}
