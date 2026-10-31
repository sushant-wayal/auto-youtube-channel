"use client";

import { useState, useRef, useEffect } from "react";

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full px-4 py-2.5 rounded-lg bg-[#110e08] border transition-all text-sm text-left flex items-center justify-between gap-3 select-none ${
          isOpen
            ? "border-[#c8b29b] ring-1 ring-[#c8b29b]/25 shadow-sm"
            : "border-[#2e281f] hover:border-[#3f3931]"
        }`}
      >
        <span className="text-[#f7f3ee] truncate">
          {value || placeholder || "Select option"}
        </span>
        <span className="flex items-center justify-center shrink-0 text-[#c8b29b] transition-transform duration-200">
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1.5 py-1 z-40 rounded-lg bg-[#16130d] border border-[#2e281f] shadow-2xl overflow-hidden backdrop-blur-md"
        >
          {options.map((opt) => {
            const isSelected = opt === value;
            return (
              <button
                type="button"
                key={opt}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-xs sm:text-sm flex items-center justify-between transition-colors ${
                  isSelected
                    ? "bg-[#221e17] text-[#c8b29b] font-medium"
                    : "text-[#eae1d7] hover:bg-[#1a1610] hover:text-[#f7f3ee]"
                }`}
              >
                <span>{opt}</span>
                {isSelected && (
                  <svg
                    className="w-4 h-4 text-[#4ade80] shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

