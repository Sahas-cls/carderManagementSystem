"use strict";

const { Op } = require("sequelize");
const {
  Week,
  Factory,
  AllocatedCurrentCarder,
  AbsenteeismCarder,
  PresentCarder,
  TrainingCenter,
  PlannedCarder,
  Budget,
} = require("../../models");
const { formatWeekLabel } = require("../utils/weekLabel");

function keyFor(weekId, factoryId) {
  return `${weekId}:${factoryId}`;
}

/**
 * Builds the Weekly Data View rows for the Cadre module: one row per
 * (week, factory) pair, summing every Daily Data Entry submission in that
 * week for that factory across the Allocated Current, Absenteeism, Present
 * and Training Center carder tables. Weekly View has no data of its own -
 * it's a read-only aggregate of Daily Entry (see the Dashboard's own
 * description), so a week/factory with no daily entries yet just reports
 * zeros.
 */
async function getWeeklyCadreView({ factoryId, weekId } = {}) {
  const where = {};
  if (factoryId) where.factoryId = factoryId;
  if (weekId) where.weekId = weekId;

  const [weeks, factories, allocated, absenteeism, present, trainingCenters] = await Promise.all([
    Week.findAll({ attributes: ["id", "week"] }),
    Factory.findAll({ attributes: ["id", "factoryName"] }),
    AllocatedCurrentCarder.findAll({ where }),
    AbsenteeismCarder.findAll({ where }),
    PresentCarder.findAll({ where }),
    TrainingCenter.findAll({ where }),
  ]);

  const weekMap = new Map(weeks.map((w) => [w.id, w]));
  const factoryMap = new Map(factories.map((f) => [f.id, f]));
  const rows = new Map();

  const getRow = (weekIdVal, factoryIdVal) => {
    const key = keyFor(weekIdVal, factoryIdVal);
    if (!rows.has(key)) {
      rows.set(key, {
        weekId: weekIdVal,
        factoryId: factoryIdVal,
        week: formatWeekLabel(weekMap.get(weekIdVal)?.week),
        date: weekMap.get(weekIdVal)?.week || null,
        factory: factoryMap.get(factoryIdVal)?.factoryName || "Unknown Factory",
        amo: 0,
        atmo: 0,
        at: 0,
        abmo: 0,
        abtmo: 0,
        abt: 0,
        prmo: 0,
        prtmo: 0,
        prt: 0,
        tca: 0,
        tcab: 0,
        tcpresent: 0,
      });
    }
    return rows.get(key);
  };

  // Sum every daily submission for the week+factory, not just the latest -
  // this is the thing that makes Weekly View a true weekly aggregate.
  allocated.forEach((r) => {
    const row = getRow(r.weekId, r.factoryId);
    row.amo += r.MO;
    row.atmo += r.TMO;
    row.at += r.total;
  });

  absenteeism.forEach((r) => {
    const row = getRow(r.weekId, r.factoryId);
    row.abmo += r.MO;
    row.abtmo += r.TMO;
    row.abt += r.total;
  });

  present.forEach((r) => {
    const row = getRow(r.weekId, r.factoryId);
    row.prmo += r.MO;
    row.prtmo += r.TMO;
    row.prt += r.total;
  });

  trainingCenters.forEach((r) => {
    const row = getRow(r.weekId, r.factoryId);
    row.tca += r.allocated;
    row.tcab += r.absent;
    row.tcpresent += r.present;
  });

  return [...rows.values()].sort((a, b) => {
    if (a.date !== b.date) return (a.date || "").localeCompare(b.date || "");
    return a.factory.localeCompare(b.factory);
  });
}

/**
 * Backs Weekly Data View's "Download Excel 2" (the "Weekly Cadre Status
 * Report" workbook): for every factory and week with Daily Data Entry
 * records dated within [from, to], that week's FIRST daily entry - a
 * point-in-time headcount, unlike getWeeklyCadreView above, which sums
 * every entry in the week. Budget is the Budget Master MO/TMO that entry
 * was planned against (its PlannedCarder row), same as Daily Data Entry's
 * Planned columns. Several entries on that same first date are
 * tie-broken by the most recently entered one (createdAt), same as the
 * Dashboard. Present figures aren't returned - the workbook derives them
 * (Allocated - Absent) as Excel formulas, matching the source report.
 * Sorted by factory id, then date.
 */
async function getWeeklyStatusReport({ from, to, factoryId } = {}) {
  const where = { date: { [Op.between]: [from, to] } };
  if (factoryId) where.factoryId = factoryId;

  const allocated = await AllocatedCurrentCarder.findAll({ where });
  // Pick each (factory, week)'s first entry - earliest date, then latest createdAt.
  const firstByWeek = new Map();
  allocated.forEach((r) => {
    const key = keyFor(r.weekId, r.factoryId);
    const current = firstByWeek.get(key);
    if (
      !current ||
      r.date < current.date ||
      (r.date === current.date && new Date(r.createdAt) > new Date(current.createdAt))
    ) {
      firstByWeek.set(key, r);
    }
  });

  const picked = [...firstByWeek.values()];
  const batchIds = picked.map((r) => r.batchId);
  const [factories, planned, absenteeism, trainingCenters] = await Promise.all([
    Factory.findAll({ attributes: ["id", "factoryName"] }),
    // Budgets are soft-deleted (paranoid) - an entry planned against a
    // since-deleted budget still reports the MO/TMO it pointed to.
    batchIds.length
      ? PlannedCarder.findAll({
          where: { batchId: { [Op.in]: batchIds } },
          include: [{ model: Budget, as: "budget", paranoid: false }],
        })
      : [],
    batchIds.length ? AbsenteeismCarder.findAll({ where: { batchId: { [Op.in]: batchIds } } }) : [],
    batchIds.length ? TrainingCenter.findAll({ where: { batchId: { [Op.in]: batchIds } } }) : [],
  ]);
  const factoryMap = new Map(factories.map((f) => [f.id, f.factoryName]));
  const budgetByBatch = new Map(planned.map((r) => [r.batchId, r.budget]));
  const absentByBatch = new Map(absenteeism.map((r) => [r.batchId, r]));
  const tcByBatch = new Map(trainingCenters.map((r) => [r.batchId, r]));

  return picked
    // Entries left behind by a since-deleted factory (Factory is paranoid,
    // so it's missing from factoryMap) don't get a block of their own.
    .filter((r) => factoryMap.has(r.factoryId))
    .map((r) => {
      const budget = budgetByBatch.get(r.batchId);
      const absent = absentByBatch.get(r.batchId);
      const tc = tcByBatch.get(r.batchId);
      return {
        factoryId: r.factoryId,
        factory: factoryMap.get(r.factoryId),
        weekId: r.weekId,
        date: r.date,
        budgetMO: budget?.moCount ?? 0,
        budgetTMO: budget?.tmoCount ?? 0,
        allocatedMO: r.MO ?? 0,
        allocatedTMO: r.TMO ?? 0,
        absentMO: absent?.MO ?? 0,
        absentTMO: absent?.TMO ?? 0,
        tcAllocated: tc?.allocated ?? 0,
        tcAbsent: tc?.absent ?? 0,
      };
    })
    .sort((a, b) => a.factoryId - b.factoryId || a.date.localeCompare(b.date));
}

module.exports = { getWeeklyCadreView, getWeeklyStatusReport };
