import { categories, getAllUnits } from "./units/registry";
import type { UnitDefinition } from "./units/types";

export interface AliasEntry {
  alias: string;
  unit: UnitDefinition;
}

let aliasIndexCache: AliasEntry[] | null = null;
let aliasMapCache: Map<string, UnitDefinition> | null = null;

/** Every (alias -> unit) pair across every category, sorted longest-alias-first for greedy matching. */
export function getAliasIndex(): AliasEntry[] {
  if (aliasIndexCache) return aliasIndexCache;
  const entries: AliasEntry[] = [];
  for (const unit of getAllUnits()) {
    for (const alias of unit.aliases) {
      entries.push({ alias, unit });
    }
  }
  entries.sort((a, b) => b.alias.length - a.alias.length);
  aliasIndexCache = entries;
  return entries;
}

/** Exact alias -> unit lookup map (fast path before falling back to fuzzy/greedy matching). */
export function getAliasMap(): Map<string, UnitDefinition> {
  if (aliasMapCache) return aliasMapCache;
  const map = new Map<string, UnitDefinition>();
  for (const { alias, unit } of getAliasIndex()) {
    // Longest-first insertion order means a shorter, later duplicate alias never overwrites
    // a meaningful longer one, but we still want the FIRST unit to claim a bare alias to win,
    // so only set if absent.
    if (!map.has(alias)) map.set(alias, unit);
  }
  aliasMapCache = map;
  return map;
}

export function resolveUnitByAlias(text: string): UnitDefinition | undefined {
  const normalized = normalize(text);
  return getAliasMap().get(normalized);
}

export function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface SearchResultItem {
  type: "unit-pair" | "category" | "unit";
  label: string;
  href: string;
  description?: string;
}

/**
 * Lightweight fuzzy-ish search over categories and units for the global search box.
 * Not a full fuzzy algorithm — it does prefix/substring/alias matching plus a small
 * edit-distance tolerance for single-word queries, which covers common typos like
 * "kilgram" or "libras" without pulling in a search dependency.
 */
export function search(query: string, limit = 8): SearchResultItem[] {
  const q = normalize(query);
  if (!q) return [];

  const results: SearchResultItem[] = [];

  for (const category of categories) {
    if (category.name.toLowerCase().includes(q) || category.id.includes(q)) {
      results.push({
        type: "category",
        label: category.name,
        href: `/converters/${category.id}`,
        description: category.shortDescription,
      });
    }
  }

  const seenUnits = new Set<string>();
  for (const unit of getAllUnits()) {
    const matches =
      unit.aliases.some((a) => a.includes(q)) || editDistance(q, unit.name.toLowerCase()) <= 1;
    if (matches && !seenUnits.has(unit.id)) {
      seenUnits.add(unit.id);
      const category = categories.find((c) => c.id === unit.categoryId);
      const popularTarget = category?.popularPairs?.find((p) => p[0] === unit.id)?.[1];
      if (popularTarget) {
        const targetUnit = getAllUnits().find((u) => u.id === popularTarget);
        results.push({
          type: "unit-pair",
          label: `${unit.name} → ${targetUnit?.name ?? popularTarget}`,
          href: `/converters/${slugForPair(unit.id, popularTarget)}`,
          description: `Convert ${unit.pluralName.toLowerCase()} to ${targetUnit?.pluralName.toLowerCase() ?? popularTarget}`,
        });
      } else {
        results.push({
          type: "unit",
          label: unit.name,
          href: `/converters/${unit.categoryId}`,
          description: `${unit.symbol} · ${category?.name ?? unit.categoryId}`,
        });
      }
    }
    if (results.length >= limit * 3) break;
  }

  return results.slice(0, limit);
}

export function slugForPair(fromUnitId: string, toUnitId: string): string {
  return `${fromUnitId}-to-${toUnitId}`;
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}
