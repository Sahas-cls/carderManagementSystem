"use strict";

const crypto = require("crypto");
const { Op } = require("sequelize");
const {
  sequelize,
  Week,
  Factory,
  Budget,
  PlannedCarder,
  AllocatedActualCarder,
  ShortageCarder,
  NewRecruitCarder,
  ResignedCarder,
  NetCarder,
  AllocatedCurrentCarder,
  AbsenteeismCarder,
  PresentCarder,
  TrainingCenter,
} = require("../../models");
const ApiError = require("../utils/ApiError");
const { formatWeekLabel, addDays } = require("../utils/weekLabel");

// Never let a raw input go negative - mirrors client/src/utils/cadreCalculations.js's n().
const n = (v) => Math.max(0, Number(v) || 0);

const CARDER_MODELS = {
  planned: PlannedCarder,
  allocActual: AllocatedActualCarder,
  shortage: ShortageCarder,
  newRec: NewRecruitCarder,
  resigned: ResignedCarder,
  net: NetCarder,
  current: AllocatedCurrentCarder,
  absent: AbsenteeismCarder,
  present: PresentCarder,
};

/** Finds the Week whose 7-day range (week .. week+6) contains the given date, or null. */
async function findWeekForDate(date, transaction) {
  const weeks = await Week.findAll({ attributes: ["id", "week"], transaction });
  return weeks.find((w) => date >= w.week && date <= addDays(w.week, 6)) || null;
}

/**
 * Planned MO/TMO mirrors Budget Master, not something the user types in - the
 * client only shows it (disabled fields, see CadreDetailsCard.jsx) so it must
 * never be trusted from the request body (validateDailyRecordBody already
 * strips plannedMO/plannedTMO out of req.body for the same reason). Resolved
 * here from whichever Budget is currently marked active for the factory, or
 * zero if none is.
 */
async function resolvePlannedCounts(factoryId, transaction) {
  const activeBudget = await Budget.findOne({ where: { factoryId, status: true }, transaction });
  return {
    plannedMO: activeBudget?.moCount ?? 0,
    plannedTMO: activeBudget?.tmoCount ?? 0,
  };
}

/**
 * Mirrors client/src/utils/cadreCalculations.js's computeTotals(), server-side
 * and authoritative - the client sends raw inputs, every derived MO/TMO/total
 * is (re)computed here so it can never be spoofed or drift from the raw values.
 */
function computeDerived(payload) {
  const pmo = n(payload.plannedMO);
  const ptmo = n(payload.plannedTMO);
  const amo = n(payload.allocActualMO);
  const atmo = n(payload.allocActualTMO);
  const nmo = n(payload.newRecMO);
  const ntmo = n(payload.newRecTMO);
  const rmo = n(payload.resignedMO);
  const rtmo = n(payload.resignedTMO);
  const abmo = n(payload.absentMO);
  const abtmo = n(payload.absentTMO);

  // Shortage only makes sense once an actual allocation has been entered.
  const hasAllocActual =
    (payload.allocActualMO !== undefined && payload.allocActualMO !== null && payload.allocActualMO !== "") ||
    (payload.allocActualTMO !== undefined && payload.allocActualTMO !== null && payload.allocActualTMO !== "");

  const plannedTotal = pmo + ptmo;
  const allocActualTotal = amo + atmo;

  const shortageMO = hasAllocActual ? pmo - amo : 0;
  const shortageTMO = hasAllocActual ? ptmo - atmo : 0;
  const shortageTotal = hasAllocActual ? pmo + ptmo - (amo + atmo) : 0;

  const newRecTotal = nmo + ntmo;
  const resignedTotal = rmo + rtmo;

  const netMO = nmo - rmo;
  const netTMO = ntmo - rtmo;
  const netTotal = nmo + ntmo - (rmo + rtmo);

  const currentMO = amo + nmo - rmo;
  const currentTMO = atmo + ntmo - rtmo;
  const currentTotal = amo + atmo + (nmo + ntmo) - (rmo + rtmo);

  const absentTotal = abmo + abtmo;
  const presentMO = Math.max(0, currentMO - abmo);
  const presentTMO = Math.max(0, currentTMO - abtmo);
  const presentTotal = Math.max(0, currentTotal - abmo - abtmo);

  const tcPlanned = n(payload.tcPlanned);
  const tcAllocated = n(payload.tcAllocated);
  const tcRecruit = n(payload.tcRecruit);
  const tcResigned = n(payload.tcResigned);
  const tcTransfer = n(payload.tcTransfer);
  const tcActual = n(payload.tcActual);
  const tcAbsent = n(payload.tcAbsent);
  const tcPresent = Math.max(0, tcActual - tcAbsent);
  // How tcTransfer currently splits between MO and TMO (see TransferModal in
  // CadreDetailsCard.jsx) - persisted alongside it so the client can recover
  // the split after a reload instead of losing it to in-memory-only state.
  const transferMO = n(payload.transferMO);
  const transferTMO = n(payload.transferTMO);

  return {
    pmo,
    ptmo,
    plannedTotal,
    amo,
    atmo,
    allocActualTotal,
    shortageMO,
    shortageTMO,
    shortageTotal,
    nmo,
    ntmo,
    newRecTotal,
    rmo,
    rtmo,
    resignedTotal,
    netMO,
    netTMO,
    netTotal,
    currentMO,
    currentTMO,
    currentTotal,
    abmo,
    abtmo,
    absentTotal,
    presentMO,
    presentTMO,
    presentTotal,
    tcPlanned,
    tcAllocated,
    tcRecruit,
    tcResigned,
    tcTransfer,
    tcActual,
    tcAbsent,
    tcPresent,
    transferMO,
    transferTMO,
  };
}

/** Row values (per carder table) derived from computeDerived()'s output. */
function rowsFor(d) {
  return {
    planned: { MO: d.pmo, TMO: d.ptmo, total: d.plannedTotal },
    allocActual: { MO: d.amo, TMO: d.atmo, total: d.allocActualTotal },
    shortage: { MO: d.shortageMO, TMO: d.shortageTMO, total: d.shortageTotal },
    newRec: { MO: d.nmo, TMO: d.ntmo, total: d.newRecTotal },
    resigned: { MO: d.rmo, TMO: d.rtmo, total: d.resignedTotal },
    net: { MO: d.netMO, TMO: d.netTMO, total: d.netTotal },
    current: { MO: d.currentMO, TMO: d.currentTMO, total: d.currentTotal },
    absent: { MO: d.abmo, TMO: d.abtmo, total: d.absentTotal },
    present: { MO: d.presentMO, TMO: d.presentTMO, total: d.presentTotal },
  };
}

function buildFlatRecord({ batchId, date, week, factory, d, createdAt }) {
  return {
    batchId,
    date,
    createdAt,
    week: week ? formatWeekLabel(week.week) : "-",
    weekId: week ? week.id : null,
    factory: factory ? factory.factoryName : "Unknown Factory",
    factoryId: factory ? factory.id : null,
    pmo: d.pmo,
    ptmo: d.ptmo,
    pt: d.plannedTotal,
    amo: d.amo,
    atmo: d.atmo,
    at: d.allocActualTotal,
    smo: d.shortageMO,
    stmo: d.shortageTMO,
    st: d.shortageTotal,
    nmo: d.nmo,
    ntmo: d.ntmo,
    nt: d.newRecTotal,
    rmo: d.rmo,
    rtmo: d.rtmo,
    rt: d.resignedTotal,
    netmo: d.netMO,
    netto: d.netTMO,
    nett: d.netTotal,
    cmo: d.currentMO,
    ctmo: d.currentTMO,
    ct: d.currentTotal,
    abmo: d.abmo,
    abtmo: d.abtmo,
    abt: d.absentTotal,
    prmo: d.presentMO,
    prtmo: d.presentTMO,
    prt: d.presentTotal,
    tcp: d.tcPlanned,
    tca: d.tcAllocated,
    tcr: d.tcRecruit,
    tcs: d.tcResigned,
    tct: d.tcTransfer,
    tactual: d.tcActual,
    tcab: d.tcAbsent,
    tcpresent: d.tcPresent,
    transferMO: d.transferMO,
    transferTMO: d.transferTMO,
  };
}

async function assertFactoryExists(factoryId, transaction) {
  const factory = await Factory.findByPk(factoryId, { transaction });
  if (!factory) throw new ApiError(404, `Factory ${factoryId} not found.`);
  return factory;
}

/** Creates a new Daily Data Entry record (always inserts - a factory may log several entries for the same date). */
async function createDailyRecord(payload) {
  const { factoryId, date } = payload;

  return sequelize.transaction(async (transaction) => {
    const factory = await assertFactoryExists(factoryId, transaction);
    const week = await findWeekForDate(date, transaction);
    if (!week) {
      throw new ApiError(
        400,
        `No week is configured to cover ${date}. Add it in Week Master first.`
      );
    }

    const plannedCounts = await resolvePlannedCounts(factoryId, transaction);
    const d = computeDerived({ ...payload, ...plannedCounts });
    const rows = rowsFor(d);
    const batchId = crypto.randomUUID();
    const base = { weekId: week.id, factoryId, date, batchId };

    for (const [key, Model] of Object.entries(CARDER_MODELS)) {
      await Model.create({ ...base, ...rows[key] }, { transaction });
    }
    const tc = await TrainingCenter.create(
      {
        ...base,
        planned: d.tcPlanned,
        allocated: d.tcAllocated,
        recruit: d.tcRecruit,
        resigned: d.tcResigned,
        transferToProLine: d.tcTransfer,
        transferMO: d.transferMO,
        transferTMO: d.transferTMO,
        actualAllocated: d.tcActual,
        absent: d.tcAbsent,
        present: d.tcPresent,
      },
      { transaction }
    );

    return buildFlatRecord({ batchId, date, week, factory, d, createdAt: tc.createdAt });
  });
}

/** Updates every row belonging to a batch (a previously submitted Daily Data Entry record). */
async function updateDailyRecord(batchId, payload) {
  const { factoryId, date } = payload;

  return sequelize.transaction(async (transaction) => {
    const existing = await PlannedCarder.findOne({ where: { batchId }, transaction });
    if (!existing) {
      throw new ApiError(404, `Record ${batchId} not found.`);
    }

    const factory = await assertFactoryExists(factoryId, transaction);
    const week = await findWeekForDate(date, transaction);
    if (!week) {
      throw new ApiError(
        400,
        `No week is configured to cover ${date}. Add it in Week Master first.`
      );
    }

    const plannedCounts = await resolvePlannedCounts(factoryId, transaction);
    const d = computeDerived({ ...payload, ...plannedCounts });
    const rows = rowsFor(d);
    const base = { weekId: week.id, factoryId, date };

    for (const [key, Model] of Object.entries(CARDER_MODELS)) {
      await Model.update({ ...base, ...rows[key] }, { where: { batchId }, transaction });
    }
    await TrainingCenter.update(
      {
        ...base,
        planned: d.tcPlanned,
        allocated: d.tcAllocated,
        recruit: d.tcRecruit,
        resigned: d.tcResigned,
        transferToProLine: d.tcTransfer,
        transferMO: d.transferMO,
        transferTMO: d.transferTMO,
        actualAllocated: d.tcActual,
        absent: d.tcAbsent,
        present: d.tcPresent,
      },
      { where: { batchId }, transaction }
    );

    return buildFlatRecord({ batchId, date, week, factory, d, createdAt: existing.createdAt });
  });
}

/** Deletes every row belonging to a batch. */
async function deleteDailyRecord(batchId) {
  return sequelize.transaction(async (transaction) => {
    const existing = await PlannedCarder.findOne({ where: { batchId }, transaction });
    if (!existing) {
      throw new ApiError(404, `Record ${batchId} not found.`);
    }
    for (const Model of Object.values(CARDER_MODELS)) {
      await Model.destroy({ where: { batchId }, transaction });
    }
    await TrainingCenter.destroy({ where: { batchId }, transaction });
  });
}

/**
 * Lists every Daily Data Entry record (regrouped by batchId) for the given
 * calendar month, newest-entered first. `month` is 1-12.
 */
async function listDailyRecords({ year, month, factoryId } = {}) {
  const now = new Date();
  const y = year || now.getFullYear();
  const m = month || now.getMonth() + 1;
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const monthEnd = addDays(addDays(monthStart, 32).slice(0, 8) + "01", -1); // last day of that month

  const where = { date: { [Op.between]: [monthStart, monthEnd] } };
  if (factoryId) where.factoryId = factoryId;

  const [weeks, factories, ...tableRows] = await Promise.all([
    Week.findAll({ attributes: ["id", "week"] }),
    Factory.findAll({ attributes: ["id", "factoryName"] }),
    ...Object.values(CARDER_MODELS).map((Model) => Model.findAll({ where })),
    TrainingCenter.findAll({ where }),
  ]);

  const weekMap = new Map(weeks.map((w) => [w.id, w]));
  const factoryMap = new Map(factories.map((f) => [f.id, f]));
  const keys = Object.keys(CARDER_MODELS);
  const carderRowsByKey = Object.fromEntries(keys.map((key, i) => [key, tableRows[i]]));
  const tcRows = tableRows[keys.length];

  const batches = new Map(); // batchId -> { date, weekId, factoryId, createdAt, rows: { planned: row, ... }, tc: row }

  const getBatch = (row) => {
    if (!batches.has(row.batchId)) {
      batches.set(row.batchId, {
        date: row.date,
        weekId: row.weekId,
        factoryId: row.factoryId,
        createdAt: row.createdAt,
        rows: {},
        tc: null,
      });
    }
    return batches.get(row.batchId);
  };

  keys.forEach((key) => {
    carderRowsByKey[key].forEach((row) => {
      getBatch(row).rows[key] = row;
    });
  });
  tcRows.forEach((row) => {
    getBatch(row).tc = row;
  });

  const records = [...batches.entries()].map(([batchId, batch]) => {
    const d = {
      pmo: batch.rows.planned?.MO ?? 0,
      ptmo: batch.rows.planned?.TMO ?? 0,
      plannedTotal: batch.rows.planned?.total ?? 0,
      amo: batch.rows.allocActual?.MO ?? 0,
      atmo: batch.rows.allocActual?.TMO ?? 0,
      allocActualTotal: batch.rows.allocActual?.total ?? 0,
      shortageMO: batch.rows.shortage?.MO ?? 0,
      shortageTMO: batch.rows.shortage?.TMO ?? 0,
      shortageTotal: batch.rows.shortage?.total ?? 0,
      nmo: batch.rows.newRec?.MO ?? 0,
      ntmo: batch.rows.newRec?.TMO ?? 0,
      newRecTotal: batch.rows.newRec?.total ?? 0,
      rmo: batch.rows.resigned?.MO ?? 0,
      rtmo: batch.rows.resigned?.TMO ?? 0,
      resignedTotal: batch.rows.resigned?.total ?? 0,
      netMO: batch.rows.net?.MO ?? 0,
      netTMO: batch.rows.net?.TMO ?? 0,
      netTotal: batch.rows.net?.total ?? 0,
      currentMO: batch.rows.current?.MO ?? 0,
      currentTMO: batch.rows.current?.TMO ?? 0,
      currentTotal: batch.rows.current?.total ?? 0,
      abmo: batch.rows.absent?.MO ?? 0,
      abtmo: batch.rows.absent?.TMO ?? 0,
      absentTotal: batch.rows.absent?.total ?? 0,
      presentMO: batch.rows.present?.MO ?? 0,
      presentTMO: batch.rows.present?.TMO ?? 0,
      presentTotal: batch.rows.present?.total ?? 0,
      tcPlanned: batch.tc?.planned ?? 0,
      tcAllocated: batch.tc?.allocated ?? 0,
      tcRecruit: batch.tc?.recruit ?? 0,
      tcResigned: batch.tc?.resigned ?? 0,
      tcTransfer: batch.tc?.transferToProLine ?? 0,
      tcActual: batch.tc?.actualAllocated ?? 0,
      tcAbsent: batch.tc?.absent ?? 0,
      tcPresent: batch.tc?.present ?? 0,
      transferMO: batch.tc?.transferMO ?? 0,
      transferTMO: batch.tc?.transferTMO ?? 0,
    };

    return buildFlatRecord({
      batchId,
      date: batch.date,
      week: weekMap.get(batch.weekId),
      factory: factoryMap.get(batch.factoryId),
      d,
      createdAt: batch.createdAt,
    });
  });

  records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return records;
}

module.exports = { createDailyRecord, updateDailyRecord, deleteDailyRecord, listDailyRecords, findWeekForDate };
