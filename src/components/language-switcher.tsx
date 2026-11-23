"use client";

import { useI18n, type Language } from "@/lib/i18n";

type Props = { className: string; activeClassName: string };

export function LanguageSwitcher({ className, activeClassName }: Props) {
  const { language, setLanguage, t } = useI18n();

  return (
    <div className={className} role="group" aria-label={t("header.language")}>
      {(["ka", "en", "ru"] as const satisfies readonly Language[]).map((option) => (
        <button
          type="button"
          key={option}
          aria-pressed={language === option}
          className={language === option ? activeClassName : ""}
          onClick={() => setLanguage(option)}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
