/**
 * Generates lib/supabase/database.types.ts from the migrations, in the same
 * shape as `supabase gen types typescript`. Applies the migrations to a
 * throwaway Postgres database (TEST_DATABASE_URL) and introspects it.
 *
 *   npm run db:types
 *
 * If you use the Supabase CLI against a linked project, the official command
 * produces an equivalent file:  supabase gen types typescript --linked
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { setupDatabase } from "../tests/db/harness";

type Column = { table_name: string; column_name: string; data_type: string; udt_name: string; is_nullable: string; column_default: string | null; is_generated: string; is_identity: string };

const SCALAR: Record<string, string> = {
  uuid: "string", text: "string", varchar: "string", bpchar: "string", citext: "string", date: "string",
  timestamptz: "string", timestamp: "string", time: "string", interval: "string",
  int2: "number", int4: "number", int8: "number", float4: "number", float8: "number", numeric: "number",
  bool: "boolean", json: "Json", jsonb: "Json", tsvector: "string", bytea: "string",
};

async function main() {
  const db = await setupDatabase();
  try {
    const enumRows = await db.admin<{ name: string; value: string }>(`
      select t.typname as name, e.enumlabel as value
      from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' order by t.typname, e.enumsortorder`);
    const enums = new Map<string, string[]>();
    for (const r of enumRows) enums.set(r.name, [...(enums.get(r.name) ?? []), r.value]);

    const tsType = (udt: string): string => {
      if (udt.startsWith("_")) return `${tsType(udt.slice(1))}[]`;
      if (enums.has(udt)) return `Database["public"]["Enums"]["${udt}"]`;
      return SCALAR[udt] ?? "unknown";
    };

    const relations = await db.admin<{ table_name: string; table_type: string }>(`
      select table_name, table_type from information_schema.tables where table_schema = 'public' order by table_name`);
    const columns = await db.admin<Column>(`
      select table_name, column_name, data_type, udt_name, is_nullable, column_default, is_generated, is_identity
      from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position`);
    const fks = await db.admin<{ name: string; table_name: string; columns: string[]; ref_table: string; ref_columns: string[]; one_to_one: boolean }>(`
      select c.conname as name, rel.relname as table_name,
        array(select a.attname from unnest(c.conkey) k join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k)::text[] as columns,
        frel.relname as ref_table,
        array(select a.attname from unnest(c.confkey) k join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k)::text[] as ref_columns,
        exists (select 1 from pg_constraint u where u.conrelid = c.conrelid and u.contype in ('p','u')
                and (select array_agg(x order by x) from unnest(u.conkey) x) = (select array_agg(x order by x) from unnest(c.conkey) x)) as one_to_one
      from pg_constraint c
      join pg_class rel on rel.oid = c.conrelid join pg_namespace n on n.oid = rel.relnamespace
      join pg_class frel on frel.oid = c.confrelid join pg_namespace fn on fn.oid = frel.relnamespace
      where c.contype = 'f' and n.nspname = 'public' and fn.nspname = 'public'
      order by rel.relname, c.conname`);
    const functions = await db.admin<{ name: string; arg_names: string[] | null; arg_types: string[]; arg_modes: string[] | null; n_defaults: number; ret: string; retset: boolean; out_names: string[] | null; out_types: string[] | null }>(`
      select p.proname as name, p.proargnames ::text[] as arg_names,
        array(select format_type(t, null) from unnest(p.proargtypes) t) as arg_types,
        p.proargmodes::text[] as arg_modes, p.pronargdefaults as n_defaults,
        format_type(p.prorettype, null) as ret, p.proretset as retset,
        case when p.proargmodes is not null then
          array(select p.proargnames[i] from generate_subscripts(p.proargmodes, 1) i where p.proargmodes[i] = 't')::text[] end as out_names,
        case when p.proargmodes is not null then
          array(select format_type(p.proallargtypes[i], null) from generate_subscripts(p.proargmodes, 1) i where p.proargmodes[i] = 't') end as out_types
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and format_type(p.prorettype, null) <> 'trigger' and p.prokind = 'f'
      order by p.proname`);

    const fmtType = (pgType: string): string => {
      const map: Record<string, string> = {
        uuid: "string", text: "string", integer: "number", bigint: "number", numeric: "number", boolean: "boolean",
        jsonb: "Json", json: "Json", "timestamp with time zone": "string", date: "string", "uuid[]": "string[]", "text[]": "string[]",
      };
      return map[pgType] ?? "unknown";
    };

    const lines: string[] = [];
    lines.push("// Generated by scripts/gen-db-types.ts — do not edit by hand.");
    lines.push("export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];", "");
    lines.push("export type Database = {", "  public: {");

    const block = (kind: "BASE TABLE" | "VIEW") => {
      for (const rel of relations.filter((r) => r.table_type === kind)) {
        const cols = columns.filter((c) => c.table_name === rel.table_name);
        const isView = kind === "VIEW";
        lines.push(`      ${rel.table_name}: {`);
        lines.push("        Row: {");
        for (const c of cols) lines.push(`          ${c.column_name}: ${tsType(c.udt_name)}${c.is_nullable === "YES" || isView ? " | null" : ""};`);
        lines.push("        };");
        if (!isView) {
          for (const mode of ["Insert", "Update"] as const) {
            lines.push(`        ${mode}: {`);
            for (const c of cols) {
              if (c.is_generated === "ALWAYS") {
                lines.push(`          ${c.column_name}?: never;`);
                continue;
              }
              const optional = mode === "Update" || c.is_nullable === "YES" || c.column_default !== null || c.is_identity === "YES";
              lines.push(`          ${c.column_name}${optional ? "?" : ""}: ${tsType(c.udt_name)}${c.is_nullable === "YES" ? " | null" : ""};`);
            }
            lines.push("        };");
          }
        }
        const rels = fks.filter((f) => f.table_name === rel.table_name);
        lines.push(rels.length ? "        Relationships: [" : "        Relationships: [];");
        if (rels.length) {
          for (const f of rels) {
            lines.push("          {");
            lines.push(`            foreignKeyName: "${f.name}";`);
            lines.push(`            columns: [${f.columns.map((c) => `"${c}"`).join(", ")}];`);
            lines.push(`            isOneToOne: ${f.one_to_one};`);
            lines.push(`            referencedRelation: "${f.ref_table}";`);
            lines.push(`            referencedColumns: [${f.ref_columns.map((c) => `"${c}"`).join(", ")}];`);
            lines.push("          },");
          }
          lines.push("        ];");
        }
        lines.push("      };");
      }
    };

    lines.push("    Tables: {");
    block("BASE TABLE");
    lines.push("    };", "    Views: {");
    block("VIEW");
    lines.push("    };", "    Functions: {");
    for (const f of functions) {
      const names = f.arg_names ?? [];
      const inTypes = f.arg_types;
      const firstOptional = inTypes.length - f.n_defaults;
      const args = inTypes.map((t, i) => `${names[i]}${i >= firstOptional ? "?" : ""}: ${fmtType(t)}`);
      let returns = fmtType(f.ret);
      if (f.retset && f.out_names?.length) {
        returns = `{ ${f.out_names.map((n, i) => `${n}: ${fmtType(f.out_types![i])}`).join("; ")} }[]`;
      }
      lines.push(`      ${f.name}: { Args: ${args.length ? `{ ${args.join("; ")} }` : "Record<PropertyKey, never>"}; Returns: ${returns} };`);
    }
    lines.push("    };", "    Enums: {");
    for (const [name, values] of enums) lines.push(`      ${name}: ${values.map((v) => `"${v}"`).join(" | ")};`);
    lines.push("    };", "    CompositeTypes: Record<string, never>;", "  };", "};", "");
    lines.push('export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];');
    lines.push('export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];');
    lines.push('export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];');
    lines.push('export type Views<T extends keyof Database["public"]["Views"]> = Database["public"]["Views"][T]["Row"];');
    lines.push('export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];', "");

    const out = path.resolve(__dirname, "../lib/supabase/database.types.ts");
    writeFileSync(out, lines.join("\n"));
    console.log(`Wrote ${out} (${relations.length} relations, ${functions.length} functions, ${enums.size} enums)`);
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
