"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getWhatsAppSupportUrl, useI18n, type TranslationKey } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import styles from "./legal-document.module.css";

type DocumentName = "terms" | "privacy";
type DocumentSection = { title: TranslationKey; body: TranslationKey };

const sections: Record<DocumentName, DocumentSection[]> = {
  terms: [
    { title: "legal.terms.generalTitle", body: "legal.terms.generalBody" },
    { title: "legal.terms.accountTitle", body: "legal.terms.accountBody" },
    { title: "legal.terms.prohibitedTitle", body: "legal.terms.prohibitedBody" },
    { title: "legal.terms.moderationTitle", body: "legal.terms.moderationBody" },
    { title: "legal.terms.liabilityTitle", body: "legal.terms.liabilityBody" },
    { title: "legal.terms.changesTitle", body: "legal.terms.changesBody" }
  ],
  privacy: [
    { title: "legal.privacy.dataTitle", body: "legal.privacy.dataBody" },
    { title: "legal.privacy.useTitle", body: "legal.privacy.useBody" },
    { title: "legal.privacy.sharingTitle", body: "legal.privacy.sharingBody" },
    { title: "legal.privacy.retentionTitle", body: "legal.privacy.retentionBody" },
    { title: "legal.privacy.rightsTitle", body: "legal.privacy.rightsBody" },
    { title: "legal.privacy.contactTitle", body: "legal.privacy.contactBody" }
  ]
};

export function LegalDocument({ document }: { document: DocumentName }) {
  const { language, t } = useI18n();
  const titleKey: TranslationKey = document === "terms" ? "legal.terms.title" : "legal.privacy.title";
  const introKey: TranslationKey = document === "terms" ? "legal.terms.intro" : "legal.privacy.intro";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.backLink}><ArrowLeft size={17} /> {t("legal.back")}</Link>
        <LanguageSwitcher className={styles.languageSwitcher} activeClassName={styles.languageActive} />
        <Link href="/" className={styles.brand}><span className={styles.brandMark}>W</span>World Market</Link>
      </header>
      <article className={styles.document}>
        <p className={styles.eyebrow}>World Market</p>
        <h1>{t(titleKey)}</h1>
        <p className={styles.intro}>{t(introKey)}</p>
        {sections[document].map((section) => (
          <section key={section.title}>
            <h2>{t(section.title)}</h2>
            <p>{t(section.body)}</p>
          </section>
        ))}
        <a className={styles.supportLink} href={getWhatsAppSupportUrl(language)} target="_blank" rel="noopener noreferrer">
          {t("support.label")}
        </a>
      </article>
    </main>
  );
}
