"use strict";

/**
 * Bulk upload of a factory's resigned-employee workbook (Manage Employees ->
 * Upload Resigned). The browser reads the .xlsx and posts its rows; this
 * turns them into employees / employeeexits - the in-app version of
 * scripts/import-resigned.js. Runs as a preview (nothing saved) unless
 * `apply` is set; both return the same report.
 *
 * Rules:
 *   - Only rows whose resign date is within [from, to] are imported; rows
 *     outside it are counted, rows that can't be read are reported as skipped.
 *   - A "Line" sheet's rows are recorded as "resign", a Training Center
 *     sheet's (name starting "TR") as "tc_resign". Each exit is linked
 *     (batchId) to the Daily Data Entry of the factory and resign date, with
 *     isMo = false (TMO) for the "Training Sewing Machine Operator"
 *     designation; with no (or more than one) entry it stays unlinked. The
 *     entries' own counts are NOT changed.
 *   - Same EPF resigned several times: every exit but the newest is recorded
 *     as rejoined (dateOfRejoin = the next row's Date of Join). An EPF
 *     already in the system keeps its master record; its imported exits only
 *     become history (rejoined) - one newer than an exit still standing in
 *     the system is skipped so it can be entered through the Daily Entry.
 *   - An exit already on file for the same EPF and date (e.g. the file was
 *     uploaded before) is skipped, so re-uploading is safe.
 *   - A missing / impossible Date of Join is stored as 1177-07-07, a
 *     placeholder to be fixed later. Civil status "Single" -> "Unmarried".
 */
const crypto = require("crypto");
const {
  Employee,
  EmployeeExit,
  ExitLog,
  Designation,
  Department,
  Section,
  ResignationReason,
  PlannedCarder,
  ResignedCarder,
  TrainingCenter,
  Factory,
  sequelize,
} = require("../../models");
const ApiError = require("../utils/ApiError");
const { refreshLegacyExit, destroyExitsLogged } = require("./employeeService");

const TMO_DESIGNATION = "training sewing machine operator";
const PLACEHOLDER_JOIN = "1177-07-07";
const SECTION_ALIAS = { jumpers: "jumper pool" };
const MAX_ROWS = 5000;

const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const key = (s) => norm(s).replace(/[^a-z0-9]/g, "");

/** "YYYY-MM-DD" (already converted by the browser) or a text "a/b/yyyy" date. */
function parseDate(v, dayFirst) {
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (!m) return null;
  const a = +m[1];
  const b = +m[2];
  let d = dayFirst ? a : b;
  let mo = dayFirst ? b : a;
  if (mo > 12) [d, mo] = [mo, d];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${m[3]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

async function loadLookups(factoryId) {
  const [desigs, sections, reasons, depts] = await Promise.all([
    Designation.findAll(),
    Section.findAll(),
    ResignationReason.findAll(),
    Department.findAll({ where: { factoryId } }),
  ]);
  const reasonList = reasons.map((r) => ({ id: r.id, key: key(r.resignedReason) }));
  return {
    designation: new Map(desigs.map((r) => [norm(r.designation), r.id])),
    section: new Map(sections.map((r) => [norm(r.sectionName), r.id])),
    department: new Map(depts.map((r) => [norm(r.departmentName), r.id])),
    reason: (text) => {
      const k = key(text);
      if (!k) return undefined;
      const hit =
        reasonList.find((r) => r.key === k) ||
        reasonList.find((r) => k.startsWith("operationalimbalance") && r.key.startsWith("operationalimbalance"));
      return hit?.id;
    },
  };
}

/** Validates/maps the posted rows. Returns { rows, skipped, outOfRange, duplicates }. */
function mapRows(input, lookups, { from, to, dayFirst, factoryId }) {
  const rows = [];
  const skipped = [];
  let outOfRange = 0;
  for (const raw of input) {
    const epf = String(raw.epf ?? "").trim();
    if (!epf) continue;
    const r = {
      sheet: String(raw.sheet ?? ""),
      line: raw.line,
      epf,
      name: String(raw.employeeName ?? "").replace(/\s+/g, " ").trim(),
      factoryId,
      type: /^tr/i.test(String(raw.sheet ?? "").trim()) ? "tc_resign" : "resign",
    };
    r.designationId = lookups.designation.get(norm(raw.designation));
    r.isMo = norm(raw.designation) !== TMO_DESIGNATION;
    r.departmentId = lookups.department.get(norm(raw.department));
    const sec = norm(raw.section);
    r.sectionId = lookups.section.get(SECTION_ALIAS[sec] || sec);
    r.resign = parseDate(raw.dateOfResign, dayFirst);
    const join = parseDate(raw.dateOfJoin, dayFirst);
    r.dob = parseDate(raw.dateOfBirth, dayFirst);
    const cs = String(raw.civilStatus ?? "").trim();
    r.civilStatus = /^single$/i.test(cs) ? "Unmarried" : /^married$/i.test(cs) ? "Married" : /^unmarried$/i.test(cs) ? "Unmarried" : null;
    r.reasonId = lookups.reason(raw.reason);

    if (r.resign && (r.resign < from || r.resign > to)) {
      outOfRange += 1;
      continue;
    }
    const why = [];
    if (!r.name) why.push("employee name missing");
    if (!r.designationId) why.push(`designation "${raw.designation ?? ""}" not found`);
    if (!r.departmentId) why.push(`department "${raw.department ?? ""}" not found in this factory`);
    if (!r.sectionId) why.push(`section "${raw.section ?? ""}" not found`);
    if (!r.reasonId) why.push(`reason "${raw.reason ?? ""}" not found`);
    if (!r.resign) why.push(`resign date "${raw.dateOfResign ?? ""}" unreadable`);
    r.badJoin = !join || (r.resign && join > r.resign);
    r.join = r.badJoin ? PLACEHOLDER_JOIN : join;
    if (why.length) skipped.push({ ...r, why });
    else rows.push(r);
  }

  // Group by EPF, oldest exit first; the same (EPF, date) twice is a duplicate row.
  const byEpf = new Map();
  const duplicates = [];
  for (const r of rows.sort((a, b) => a.resign.localeCompare(b.resign))) {
    const list = byEpf.get(r.epf) || [];
    if (list.some((x) => x.resign === r.resign)) {
      duplicates.push({ ...r, why: ["same EPF and resign date as another row in the file"] });
      continue;
    }
    list.push(r);
    byEpf.set(r.epf, list);
  }
  return { byEpf, skipped, outOfRange, duplicates };
}

const brief = (r) => ({
  sheet: r.sheet,
  line: r.line,
  epf: r.epf,
  employeeName: r.name,
  dateOfResign: r.resign || null,
  why: r.why ? r.why.join("; ") : undefined,
});

async function importResignedEmployees({ factoryId, from, to, dayFirst = false, apply = false, fileName, rows: input }, user) {
  const factory = await Factory.findByPk(factoryId);
  if (!factory) throw new ApiError(404, "Factory not found.");
  if (!Array.isArray(input) || !input.length) throw new ApiError(400, "The file has no employee rows.");
  if (input.length > MAX_ROWS) throw new ApiError(400, `At most ${MAX_ROWS} rows can be uploaded at once.`);

  const lookups = await loadLookups(factoryId);
  const { byEpf, skipped, outOfRange, duplicates } = mapRows(input, lookups, { from, to, dayFirst, factoryId });

  // The Daily Data Entry an exit belongs to: same factory and date, in the
  // table its type counts against. None (or more than one) -> unlinked.
  const cache = new Map();
  const entryBatch = async (type, date, transaction) => {
    const k = `${type}|${date}`;
    if (!cache.has(k)) {
      const model = type === "tc_resign" ? TrainingCenter : type === "planned" ? PlannedCarder : ResignedCarder;
      const found = await model.findAll({ where: { factoryId, date }, attributes: ["batchId"], raw: true, transaction });
      cache.set(k, found.length === 1 || (type === "planned" && found.length) ? found[0].batchId : null);
    }
    return cache.get(k);
  };

  const alreadyOnFile = [];
  const imported = [];
  const stats = {
    newEmployees: 0,
    existingEmployees: 0,
    exits: 0,
    linked: 0,
    unlinked: 0,
    mo: 0,
    tmo: 0,
    rejoined: 0,
    placeholderJoins: 0,
  };
  const source = fileName ? String(fileName).slice(0, 200) : "upload";

  const transaction = await sequelize.transaction();
  try {
    for (const [epf, candidates] of byEpf) {
      let employee = await Employee.findOne({ where: { epf }, paranoid: false, transaction });
      // A cleaned-up (soft-deleted) record is revived as if new, its old exits
      // purged - same as the Daily Entry does (epf is unique across both).
      const deleted = employee?.deletedAt ? employee : null;
      if (deleted) employee = null;
      const wasExisting = !!employee;
      const existingExits = employee
        ? await EmployeeExit.findAll({ where: { employeeId: employee.id }, transaction })
        : [];

      // Exits already on file (same date) - typically the same file uploaded twice.
      const list = [];
      for (const r of candidates) {
        if (existingExits.some((ev) => ev.dateOfExit === r.resign)) {
          alreadyOnFile.push({ ...r, why: ["an exit on this date is already on file"] });
        } else list.push(r);
      }
      if (!list.length) continue;

      // An exit still standing in the system that is OLDER than an imported
      // one can't be resolved automatically (it'd need rejoining on its entry).
      if (employee) {
        const standing = existingExits.filter((ev) => !ev.rejoinedBatchId);
        const newestStanding = standing.reduce((m, ev) => (ev.dateOfExit > m ? ev.dateOfExit : m), "");
        const blocked = newestStanding ? list.filter((r) => r.resign > newestStanding) : [];
        for (const r of blocked) {
          skipped.push({
            ...r,
            why: [`EPF ${epf} has an earlier resignation (${newestStanding}) still standing in the system - rejoin it first or enter this one through the Daily Entry`],
          });
        }
        if (blocked.length) list.splice(0, list.length, ...list.filter((r) => !blocked.includes(r)));
        if (!list.length) continue;
      }

      const latest = list[list.length - 1];
      if (wasExisting) {
        stats.existingEmployees += 1;
      } else {
        stats.newEmployees += 1;
        if (apply) {
          // Exit columns are filled in from the exit events by refreshLegacyExit.
          const fields = {
            employeeName: latest.name,
            designationId: latest.designationId,
            departmentId: latest.departmentId,
            sectionId: latest.sectionId,
            dateOfJoin: latest.join,
            dateOfBirth: latest.dob,
            civilStatus: latest.civilStatus,
          };
          if (deleted) {
            await deleted.restore({ transaction });
            await destroyExitsLogged(deleted.id, "purged_on_restore", transaction);
            employee = await deleted.update(fields, { transaction });
          } else {
            employee = await Employee.create({ epf, ...fields }, { transaction });
          }
        }
      }

      for (let i = 0; i < list.length; i++) {
        const r = list[i];
        const next = list[i + 1];
        // An existing employee is back at work (or resigned again later), so
        // every imported exit of theirs is history; for a new one, every exit
        // but the newest was followed by a rejoin.
        const rejoined = !!next || wasExisting;
        const rejoinDate = next && !next.badJoin && next.join >= r.resign ? next.join : null;
        const batchId = await entryBatch(r.type, r.resign, transaction);
        // Like the app's own Rejoin: credited to the entry of the rejoin date,
        // falling back to the resignation's own entry.
        const rejoinedBatchId = rejoined
          ? (rejoinDate && (await entryBatch("planned", rejoinDate, transaction))) || batchId || crypto.randomUUID()
          : null;

        stats.exits += 1;
        stats[batchId ? "linked" : "unlinked"] += 1;
        if (batchId) stats[r.isMo ? "mo" : "tmo"] += 1;
        if (rejoined) stats.rejoined += 1;
        if (r.badJoin) stats.placeholderJoins += 1;
        imported.push({ ...brief(r), type: r.type, linked: !!batchId, isMo: batchId ? r.isMo : null, rejoined, placeholderJoin: r.badJoin });
        if (!apply) continue;

        const exit = await EmployeeExit.create(
          {
            employeeId: employee.id,
            batchId,
            type: r.type,
            isMo: batchId ? r.isMo : null,
            dateOfExit: r.resign,
            resignationReasonId: r.reasonId,
            dateOfRejoin: rejoined ? rejoinDate : null,
            rejoinedBatchId,
            rejoinedIsMo: rejoined ? (next ? next.isMo : r.isMo) : null,
            needsReview: false,
          },
          { transaction },
        );
        await ExitLog.create(
          {
            action: "bulk_imported",
            exitId: exit.id,
            employeeId: employee.id,
            epf,
            employeeName: employee.employeeName,
            batchId,
            snapshot: {
              exit: exit.get({ plain: true }),
              source: `${source} / ${r.sheet} / row ${r.line}`,
              uploadedBy: user?.id ?? null,
            },
          },
          { transaction },
        );
      }
      // An existing employee's master record is left as it is.
      if (apply && !wasExisting) await refreshLegacyExit(employee.id, transaction);
    }
    if (apply) await transaction.commit();
    else await transaction.rollback();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  return {
    applied: !!apply,
    factoryName: factory.factoryName,
    from,
    to,
    totalRows: input.length,
    outOfRange,
    stats,
    imported,
    skipped: skipped.map(brief),
    duplicates: duplicates.map(brief),
    alreadyOnFile: alreadyOnFile.map(brief),
  };
}

module.exports = { importResignedEmployees };
