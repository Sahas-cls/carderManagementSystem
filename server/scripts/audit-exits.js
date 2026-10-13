"use strict";
/**
 * READ-ONLY audit: compares each daily entry's stored Resigned/Transfer
 * MO/TMO counts (resignedcarders / transfercarders) with the number of
 * Employee rows currently linked to that batch, and lists orphaned exits.
 *
 *   node server/scripts/audit-exits.js [--out=audit.csv]
 *
 * Never writes to the database.
 */
const fs = require("fs");
const { Op } = require("sequelize");
const { Employee, ResignedCarder, TransferCarder, Factory } = require("../models");

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

async function main() {
  const outArg = process.argv.find((a) => a.startsWith("--out="));
  const rows = [["kind", "factory", "date", "batchId", "type", "stored_MO", "linked_MO", "stored_TMO", "linked_TMO", "status"]];

  const linked = await Employee.findAll({
    where: { batchId: { [Op.ne]: null } },
    attributes: ["batchId", "isMo", "isTransfer"],
    raw: true,
  });
  const counts = new Map(); // `${batchId}|${isTransfer}` -> { mo, tmo }
  for (const e of linked) {
    const key = `${e.batchId}|${e.isTransfer ? 1 : 0}`;
    const c = counts.get(key) || { mo: 0, tmo: 0 };
    if (e.isMo) c.mo += 1;
    else c.tmo += 1;
    counts.set(key, c);
  }

  const seen = new Set();
  let mismatches = 0;
  for (const [kind, Model, isTransfer] of [
    ["resigned", ResignedCarder, 0],
    ["transfer", TransferCarder, 1],
  ]) {
    const batches = await Model.findAll({
      include: [{ model: Factory, as: "factory", attributes: ["factoryName"] }],
      order: [["date", "ASC"]],
    });
    for (const b of batches) {
      const key = `${b.batchId}|${isTransfer}`;
      seen.add(key);
      const c = counts.get(key) || { mo: 0, tmo: 0 };
      const ok = c.mo === b.MO && c.tmo === b.TMO;
      if (!ok) mismatches += 1;
      rows.push([kind, b.factory?.factoryName, b.date, b.batchId, kind, b.MO, c.mo, b.TMO, c.tmo, ok ? "OK" : "MISMATCH"]);
    }
  }
  // Employees linked to a batch that has no resigned/transfer row at all.
  for (const [key, c] of counts) {
    if (seen.has(key)) continue;
    const [batchId, t] = key.split("|");
    mismatches += 1;
    rows.push(["orphan-link", "", "", batchId, t === "1" ? "transfer" : "resigned", 0, c.mo, 0, c.tmo, "LINKED_TO_UNKNOWN_BATCH"]);
  }

  const unlinked = await Employee.count({ where: { batchId: null, dateOfResign: { [Op.ne]: null } } });

  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  if (outArg) fs.writeFileSync(outArg.slice(6), csv);
  else console.log(csv);
  console.error(`\nBatches checked: ${rows.length - 1}, mismatches: ${mismatches}, unlinked exits (batchId NULL, dateOfResign set): ${unlinked}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => require("../models").sequelize.close());
