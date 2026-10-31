"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Currency = "INR" | "USD";

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  isIndia: boolean;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "INR",
  setCurrency: () => {},
  isIndia: true,
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("INR");

  useEffect(() => {
    // 1. Check local storage preference if user manually set it previously
    try {
      const stored = localStorage.getItem("preferred_currency") as Currency | null;
      if (stored === "INR" || stored === "USD") {
        setCurrencyState(stored);
        return;
      }
    } catch {
      // LocalStorage access may fail in strict private browsing
    }

    // 2. Client-side fast check: India timezone inspection
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      const isIndianTimeZone =
        tz === "Asia/Kolkata" ||
        tz === "Asia/Calcutta" ||
        new Date().getTimezoneOffset() === -330;

      if (!isIndianTimeZone) {
        setCurrencyState("USD");
      }
    } catch {
      // ignore
    }

    // 3. Precise server geo verification via Vercel edge IP headers
    fetch("/api/geo")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.country) {
          const detected: Currency = data.country === "IN" ? "INR" : "USD";
          setCurrencyState(detected);
        }
      })
      .catch(() => {
        // Fallback to timezone detection
      });
  }, []);

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    try {
      localStorage.setItem("preferred_currency", c);
    } catch {
      // ignore
    }
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        isIndia: currency === "INR",
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}

