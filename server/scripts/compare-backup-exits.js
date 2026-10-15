"use strict";
/**
 * READ-ONLY: for each batch in mismatched-entries.csv, finds employees a
 * restored backup still has linked to that batch (employees.batchId and, if
 * present, employeeexits.batchId) that the live database no longer does.
 * Those are the candidates for filling the stored-vs-linked gap.
 *
 *   node scripts/compare-backup-exits.js --backup=carder_chk_1006 [--live=<db>] [--csv=mismatched-entries.csv] [--detail] [--out=recoverable.csv]
 *
 * --backup  scratch database the dump was restored into (never the live DB)
 * Live DB comes from config/config.js (NODE_ENV, default development); the
 * backup DB uses the same host/credentials. Only SELECTs are issued.
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const configs = require("../config/config");

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

async function tableExists(conn, db, table) {
  const [r] = await conn.query("SELECT 1 FROM information_schema.tables WHERE table_schema=? AND table_name=?", [db, table]);
  return r.length > 0;
}

// employeeId -> { epf, name?, isMo, kind, source } for people tied to the batches.
async function linkedByBatch(conn, db, batchIds) {
  const out = new Map(); // batchId -> Map(employeeId -> info)
  const add = (batchId, id, info) => {
    if (!out.has(batchId)) out.set(batchId, new Map());
    out.get(batchId).set(id, { ...out.get(batchId).get(id), ...info });
  };
  if (!batchIds.length) return out;
  const [emps] = await conn.query(
    `SELECT id, epf, batchId, isMo, isTransfer, dateOfResign FROM \`${db}\`.employees WHERE batchId IN (?)`,
    [batchIds],
  );
  for (const e of emps) add(e.batchId, e.id, { epf: e.epf, isMo: !!e.isMo, kind: e.isTransfer ? "transfer" : "resign", date: e.dateOfResign, source: "employees" });
  if (await tableExists(conn, db, "employeeexits")) {
    const [exits] = await conn.query(
      `SELECT x.employeeId AS id, x.batchId, x.isMo, x.type, x.dateOfExit, e.epf
         FROM \`${db}\`.employeeexits x LEFT JOIN \`${db}\`.employees e ON e.id = x.employeeId
        WHERE x.batchId IN (?)`,
      [batchIds],
    );
    for (const x of exits) add(x.batchId, x.id, { epf: x.epf, isMo: !!x.isMo, kind: x.type, date: x.dateOfExit, source: "employeeexits" });
  }
  return out;
}

async function main() {
  const backupDb = arg("backup");
  if (!backupDb) throw new Error("--backup=<scratch database> is required");
  const cfg = configs[process.env.NODE_ENV || "development"];
  const liveDb = arg("live") || cfg.database;
  if (backupDb === liveDb) throw new Error("--backup must be a scratch database, not the live one");

  const csvPath = path.resolve(arg("csv") || "mismatched-entries.csv");
  const mismatches = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const batchIds = mismatches.map((m) => m.batchId);

  const conn = await mysql.createConnection({ host: cfg.host, port: cfg.port, user: cfg.username, password: cfg.password ?? undefined });
  try {
    if (!(await tableExists(conn, backupDb, "employees"))) throw new Error(`${backupDb}.employees not found - was the dump restored there?`);
    const live = await linkedByBatch(conn, liveDb, batchIds);
    const bak = await linkedByBatch(conn, backupDb, batchIds);

    const detail = [["type", "factory", "date", "batchId", "employeeId", "epf", "isMo", "backupSource"]];
    const summary = [];
    let totalMissing = 0, totalFound = 0;
    for (const m of mismatches) {
      const missing = Number(m.missing);
      const liveSet = live.get(m.batchId) || new Map();
      const recoverable = [...(bak.get(m.batchId) || new Map())].filter(([id]) => !liveSet.has(id));
      const mo = recoverable.filter(([, v]) => v.isMo).length;
      totalMissing += missing;
      totalFound += Math.min(missing, recoverable.length);
      summary.push({
        date: m.date, type: m.type, factory: m.factory || m.factoryName, missing,
        recoverable: recoverable.length, MO: mo, TMO: recoverable.length - mo,
        result: recoverable.length === 0 ? "none" : recoverable.length === missing ? "exact" : recoverable.length > missing ? "more-than-missing" : "partial",
      });
      for (const [id, v] of recoverable) detail.push([m.type, m.factory || m.factoryName, m.date, m.batchId, id, v.epf, v.isMo ? 1 : 0, v.source]);
    }
    console.table(summary);
    console.log(`Backup ${backupDb}: can account for ~${totalFound} of ${totalMissing} missing exits across ${mismatches.length} batches.`);
    if (process.argv.includes("--detail")) console.log(detail.map((r) => r.join("\t")).join("\n"));
    const out = arg("out");
    if (out) fs.writeFileSync(out, detail.map((r) => r.map(csvCell).join(",")).join("\n"));
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
