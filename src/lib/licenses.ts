import type { TranslationId } from "./bible";

/**
 * Draft rights summaries for the bundled corpora.
 *
 * ⚠️ DRAFT — reviewed wording pending. Categories:
 *   pd    — public domain (safe to redistribute)
 *   free  — free to redistribute with attribution / notice kept intact
 *   copy  — copyrighted; bundled for free personal/devotional use,
 *           permission required before any commercial redistribution
 *
 * Verify each line against the publisher's current policy before Play
 * Store publication or any paid distribution.
 */

export type LicenseCategory = "pd" | "free" | "copy";

export type LicenseEntry = {
  category: LicenseCategory;
  line: string;
};

export const LICENSES: Record<TranslationId, LicenseEntry> = {
  kjv: { category: "pd", line: "Public domain (Crown patent expired, 1611)." },
  web: { category: "pd", line: "Public domain. World English Bible." },
  asv: { category: "pd", line: "Public domain (1901)." },
  ylt: { category: "pd", line: "Public domain (1862/1898)." },
  gnv: { category: "pd", line: "Public domain (1599 Geneva Bible)." },
  lsv: { category: "pd", line: "Public domain / released by the publisher." },
  adb: { category: "pd", line: "Public domain (1905, Philippine copyright lapsed)." },
  rv1960: { category: "pd", line: "Public-domain republications exist; original © Sociedades Bíblicas Unidas — verify per edition." },
  synod: { category: "pd", line: "Public domain (Synodal, 1876/1951 editions widely held PD)." },
  wlc: { category: "pd", line: "Public domain (Westminster Leningrad Codex transcription)." },
  tr: { category: "pd", line: "Public domain (Textus Receptus, 1550/1894)." },
  chiun: { category: "pd", line: "Chinese Union Version, 1919 text — public domain in most jurisdictions; regional rights may persist. Verify before commercial use." },
  vi1934: { category: "pd", line: "Kinh Thánh 1934 — public domain (long-lapsed copyright). Verify locally." },
  ubio: { category: "pd", line: "Ukrainian Ohienko translation — 1962 status debated; treat as public domain with verification." },
  ceb: { category: "pd", line: "Cebuano Pinadayag 1917 — public domain (lapsed)." },
  bsb: { category: "free", line: "Berean Standard Bible — free to use and redistribute; attribution appreciated." },
  net: { category: "free", line: "NET Bible © Biblical Studies Press — free for non-commercial use with attribution ('NET Bible copyright notice' required)." },
  cjb: { category: "copy", line: "Complete Jewish Bible © David H. Stern / Messianic Jewish Resources — all rights reserved; personal devotional use only." },
  tlv: { category: "copy", line: "Tree of Life Version © Messianic Jewish Family Bible Society — all rights reserved; personal use only." },
  tb: { category: "copy", line: "Terjemahan Baru © Lembaga Alkitab Indonesia (LAI) — all rights reserved; permission required beyond personal use." },
  hiov: { category: "copy", line: "Hindi Old Version (BSI) — © Bible Society of India / origin societies; permission required for redistribution." },
  tamovr: { category: "copy", line: "Tamil Old Version (BSI) — © Bible Society of India / origin societies; permission required for redistribution." },
  cunps: { category: "free", line: "Chinese Union New Punctuation (Simplified) — distribution permitted with copyright notice retained; verify current publisher policy." },
  krv: { category: "free", line: "Korean Revised Version — KRVP permits non-commercial distribution with notice; verify." },
  tsg: { category: "free", line: "Tausug Bible — distribution terms via source publisher; verify before commercial use." },
};

export const LICENSE_CATEGORY_LABEL: Record<LicenseCategory, string> = {
  pd: "Public domain",
  free: "Free with notice",
  copy: "Copyrighted — limited use",
};
