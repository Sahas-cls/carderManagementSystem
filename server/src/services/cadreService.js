"use strict";

const { Week, Factory, AllocatedActualCarder, AbsenteeismCarder, PresentCarder, TrainingCenter } = require("../../models");
const { formatWeekLabel } = require("../utils/weekLabel");

function keyFor(weekId, factoryId) {
  return `${weekId}:${factoryId}`;
}

/**
 * Builds the Weekly Data View rows for the Cadre module: one row per
 * (week, factory) pair, summing every Daily Data Entry submission in that
 * week for that factory across the Allocated Actual, Absenteeism, Present
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
    AllocatedActualCarder.findAll({ where }),
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

module.exports = { getWeeklyCadreView };
