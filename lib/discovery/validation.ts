import { createHash } from "node:crypto";

import type {
  DiscoveryAgentOutput,
  DiscoveryCandidate,
  DiscoveryProfileCriteria,
  DiscoveryRejectionReason,
  ValidatedDiscoveryResult,
} from "@/lib/discovery/contracts";

const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "source",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term",
]);

export const DEFAULT_DUTCH_AGENCY_PROFILE: DiscoveryProfileCriteria = {
  lookbackDays: 90,
  minimumConfidence: 0.65,
  restrictedHosts: ["facebook.com", "instagram.com", "linkedin.com", "tiktok.com", "x.com"],
  region: "Netherlands",
  languages: ["nl", "en"],
  signalAreas: ["pitching", "newsletters", "strategy", "hiring", "announcements"],
  projectIntents: [
    "websites",
    "digital products",
    "platforms",
    "apps",
    "redesigns",
    "rebrands",
    "campaigns",
    "agency reviews",
  ],
};

export function canonicalizeHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeIdentity(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function buildSignalFingerprint(candidate: DiscoveryCandidate, canonicalUrl: string): string {
  return sha256([
    canonicalUrl,
    normalizeIdentity(candidate.title),
    normalizeIdentity(candidate.evidenceExcerpt),
    candidate.publicationDate ?? "undated",
  ].join("|"));
}

export function buildOpportunityKey(organization: string, title: string): string {
  return sha256(`${normalizeIdentity(organization)}|${normalizeIdentity(title)}`);
}

function hostIsRestricted(canonicalUrl: string, restrictedHosts: string[]): boolean {
  const host = new URL(canonicalUrl).hostname;
  return restrictedHosts.some((restricted) => host === restricted || host.endsWith(`.${restricted}`));
}

export function validateDiscoveryOutput({
  output,
  consultedUrls,
  profile,
  now = new Date(),
}: {
  output: DiscoveryAgentOutput;
  consultedUrls: string[];
  profile: DiscoveryProfileCriteria;
  now?: Date;
}): ValidatedDiscoveryResult[] {
  const allowList = new Set(consultedUrls.map(canonicalizeHttpsUrl).filter((url): url is string => Boolean(url)));
  const seenFingerprints = new Set<string>();
  const oldestAllowed = new Date(now);
  oldestAllowed.setUTCDate(oldestAllowed.getUTCDate() - profile.lookbackDays);

  return output.candidates.map((candidate) => {
    const reasons: DiscoveryRejectionReason[] = [];
    const canonicalUrl = canonicalizeHttpsUrl(candidate.canonicalSourceUrl);

    if (!canonicalUrl) reasons.push("invalid_https_url");
    else {
      if (!allowList.has(canonicalUrl)) reasons.push("uncited_url");
      if (hostIsRestricted(canonicalUrl, profile.restrictedHosts)) reasons.push("restricted_source");
    }
    if (!candidate.organization.trim()) reasons.push("missing_organization");
    if (!candidate.projectClues.some((clue) => clue.trim().length > 1)) reasons.push("missing_project_clue");
    if (!candidate.evidenceExcerpt.trim()) reasons.push("missing_evidence_excerpt");
    if (candidate.confidence < profile.minimumConfidence) reasons.push("low_confidence");
    if (candidate.publicationDate && new Date(`${candidate.publicationDate}T00:00:00Z`) < oldestAllowed) {
      reasons.push("outside_lookback");
    }

    const fingerprint = canonicalUrl ? buildSignalFingerprint(candidate, canonicalUrl) : null;
    if (fingerprint && seenFingerprints.has(fingerprint)) reasons.push("duplicate_candidate");
    if (fingerprint) seenFingerprints.add(fingerprint);

    return {
      candidate,
      canonicalUrl,
      fingerprint,
      opportunityKey: canonicalUrl ? buildOpportunityKey(candidate.organization, candidate.title) : null,
      accepted: reasons.length === 0,
      rejectionReasons: reasons,
    };
  });
}

export function collectHttpsUrls(value: unknown): string[] {
  const found = new Set<string>();
  const visit = (node: unknown, key = "") => {
    if (typeof node === "string") {
      if (/url|source|citation/i.test(key)) {
        const canonical = canonicalizeHttpsUrl(node);
        if (canonical) found.add(canonical);
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, key));
      return;
    }
    if (node && typeof node === "object") {
      Object.entries(node as Record<string, unknown>).forEach(([childKey, child]) => visit(child, childKey));
    }
  };
  visit(value);
  return [...found];
}

export function collectWebSearchEvidenceUrls(value: unknown): string[] {
  const found = new Set<string>();
  const visit = (node: unknown, insideWebSearch = false, insideSources = false) => {
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, insideWebSearch, insideSources));
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    const type = typeof record.type === "string" ? record.type : "";
    const name = typeof record.name === "string" ? record.name : "";
    const isWebSearch = insideWebSearch || type === "web_search_call" || (type === "hosted_tool_call" && name.startsWith("web_search"));
    if ((type === "url_citation" || insideSources) && typeof record.url === "string") {
      const canonical = canonicalizeHttpsUrl(record.url);
      if (canonical) found.add(canonical);
    }
    for (const [key, child] of Object.entries(record)) {
      visit(child, isWebSearch, isWebSearch && key === "sources");
    }
  };
  visit(value);
  return [...found];
}

export function countWebSearchCalls(value: unknown): number {
  let count = 0;
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    const type = typeof record.type === "string" ? record.type : "";
    const name = typeof record.name === "string" ? record.name : "";
    if (type === "web_search_call" || (type === "hosted_tool_call" && name.startsWith("web_search"))) count += 1;
    Object.values(record).forEach(visit);
  };
  visit(value);
  return count;
}
