// Bulk-import FOIA citation data into `citations_raw`. Idempotent: conflicts
// on citation_number are skipped, so re-running (or re-running on a future
// refreshed export) only adds new rows.
//
// Prereq: the table exists (npx drizzle-kit push).
// Run from the repo root:
//   TZ=America/New_York node --env-file=.env.local --import tsx \
//     analysis/import_citations.ts "$HOME/Desktop/Parking Citations/citations_normalized.csv"
//
// TZ matters: issued_at in the CSV is Greenwich local time with no offset;
// the script interprets it in the process timezone.

import { readFileSync } from "node:fs";
import { db } from "../src/lib/db/client";
import { citationsRaw, type NewCitationRaw } from "../src/lib/db/schema";

function parseCsv(text: string): Record<string, string>[] {
  // The normalized CSV is machine-written with no quoted commas except in
  // zone names; handle RFC-4180 quoting minimally.
  const lines = text.trim().split("\n");
  const header = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const fields: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur);
    return Object.fromEntries(header.map((h, i) => [h, fields[i] ?? ""]));
  });
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) throw new Error("usage: import_citations.ts <csv>");

  const rows = parseCsv(readFileSync(csvPath, "utf8"));
  console.log(`parsed ${rows.length} rows from ${csvPath}`);

  const records: NewCitationRaw[] = rows.map((r) => ({
    citationNumber: r.citation_number,
    issuedAt: new Date(r.issued_at),
    street: r.street,
    officer: r.officer || null,
    zone: r.zone || null,
    zoneName: r.zone_name || null,
    violationType: r.violation_type || null,
    baseAmount: r.base_amount ? Number(r.base_amount) : null,
    sourceFile: r.source_file || null,
  }));

  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    const res = await db
      .insert(citationsRaw)
      .values(chunk)
      .onConflictDoNothing({ target: citationsRaw.citationNumber })
      .returning({ id: citationsRaw.id });
    inserted += res.length;
    process.stdout.write(`\r${Math.min(i + CHUNK, records.length)}/${records.length} processed, ${inserted} inserted`);
  }
  console.log(`\ndone: ${inserted} new rows (${records.length - inserted} already present)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
