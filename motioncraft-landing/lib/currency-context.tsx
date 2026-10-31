"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Currency = "INR" | "USD";

interface CurrencyContextValue {
  currency: Currency;
  isIndia: boolean;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "INR",
  isIndia: true,
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<Currency>("INR");

  useEffect(() => {
    // 1. Immediate client-side timezone heuristic
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      const isIndianTimeZone =
        tz === "Asia/Kolkata" ||
        tz === "Asia/Calcutta" ||
        new Date().getTimezoneOffset() === -330;

      if (!isIndianTimeZone) {
        setCurrency("USD");
      }
    } catch {
      // ignore
    }

    // 2. Authoritative server geo verification via edge IP headers
    fetch("/api/geo")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.country) {
          const detected: Currency = data.country === "IN" ? "INR" : "USD";
          setCurrency(detected);
        }
      })
      .catch(() => {
        // Fallback to timezone heuristic
      });
  }, []);

  return (
    <CurrencyContext.Provider
      value={{
        currency,
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
