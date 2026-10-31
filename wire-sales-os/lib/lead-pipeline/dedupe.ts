/**
 * Deduplicator: detects records that already exist (in the CRM or earlier in
 * the same batch) by domain, phone, email or normalized name + city.
 */

export type DedupeReason = "domain" | "phone" | "email" | "name_city";

export type DedupeKeys = {
  domain: string | null;
  phone_normalized: string | null;
  email: string | null;
  name_key: string | null;
};

export type ExistingRecord = DedupeKeys & { id: string };

export type DuplicateMatch = {
  reason: DedupeReason;
  /** Existing CRM record id, or `row:<index>` when the match is earlier in the same batch. */
  matchId: string;
};

/** Shared hosting / free email domains are not identity signals. */
const NON_IDENTIFYING_DOMAINS = new Set([
  "gmail.com",
  "hotmail.com",
  "hotmail.es",
  "outlook.com",
  "outlook.es",
  "yahoo.com",
  "yahoo.es",
  "icloud.com",
  "live.com",
  "msn.com",
  "telefonica.net",
  "sites.google.com",
  "business.site",
  "linktr.ee",
]);

export function isIdentifyingDomain(domain: string | null): domain is string {
  return Boolean(domain) && !NON_IDENTIFYING_DOMAINS.has(domain as string);
}

export class DedupeIndex {
  private byDomain = new Map<string, string>();
  private byPhone = new Map<string, string>();
  private byEmail = new Map<string, string>();
  private byNameKey = new Map<string, string>();

  constructor(existing: ExistingRecord[] = []) {
    for (const record of existing) this.add(record, record.id);
  }

  add(keys: DedupeKeys, id: string) {
    if (isIdentifyingDomain(keys.domain) && !this.byDomain.has(keys.domain)) this.byDomain.set(keys.domain, id);
    if (keys.phone_normalized && !this.byPhone.has(keys.phone_normalized)) this.byPhone.set(keys.phone_normalized, id);
    if (keys.email && !this.byEmail.has(keys.email.toLowerCase())) this.byEmail.set(keys.email.toLowerCase(), id);
    if (keys.name_key && !keys.name_key.endsWith("|") && !this.byNameKey.has(keys.name_key)) this.byNameKey.set(keys.name_key, id);
  }

  /** Strongest signal first: domain > phone > email > name+city. */
  find(keys: DedupeKeys): DuplicateMatch | null {
    if (isIdentifyingDomain(keys.domain)) {
      const id = this.byDomain.get(keys.domain);
      if (id) return { reason: "domain", matchId: id };
    }
    if (keys.phone_normalized) {
      const id = this.byPhone.get(keys.phone_normalized);
      if (id) return { reason: "phone", matchId: id };
    }
    if (keys.email) {
      const id = this.byEmail.get(keys.email.toLowerCase());
      if (id) return { reason: "email", matchId: id };
    }
    if (keys.name_key && !keys.name_key.endsWith("|")) {
      const id = this.byNameKey.get(keys.name_key);
      if (id) return { reason: "name_city", matchId: id };
    }
    return null;
  }
}

export type BatchItem<T extends DedupeKeys> =
  | { index: number; status: "new"; record: T }
  | { index: number; status: "duplicate"; record: T; match: DuplicateMatch };

/** Classify a batch against existing records and against itself. */
export function dedupeBatch<T extends DedupeKeys>(records: T[], existing: ExistingRecord[]): BatchItem<T>[] {
  const index = new DedupeIndex(existing);
  return records.map((record, i) => {
    const match = index.find(record);
    if (match) return { index: i, status: "duplicate", record, match };
    index.add(record, `row:${i}`);
    return { index: i, status: "new", record };
  });
}

export const DEDUPE_REASON_LABELS: Record<DedupeReason, string> = {
  domain: "Same website domain",
  phone: "Same phone number",
  email: "Same email",
  name_city: "Same name and city",
};
