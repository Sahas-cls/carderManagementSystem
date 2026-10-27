"use strict";

const crypto = require("crypto");
const { Op } = require("sequelize");
const {
  sequelize,
  Week,
  Factory,
  Budget,
  TCBudget,
  PlannedCarder,
  AllocatedActualCarder,
  ShortageCarder,
  NewRecruitCarder,
  RejoinedCarder,
  ReleasedFromTcCarder,
  ResignedCarder,
  TransferCarder,
  NetCarder,
  AllocatedCurrentCarder,
  AbsenteeismCarder,
  PresentCarder,
  TrainingCenter,
} = require("../../models");
const ApiError = require("../utils/ApiError");
const { formatWeekLabel, addDays } = require("../utils/weekLabel");
const employeeService = require("./employeeService");

// Never let a raw input go negative - mirrors client/src/utils/cadreCalculations.js's n().
const n = (v) => Math.max(0, Number(v) || 0);

// PlannedCarder is deliberately NOT in here - unlike these, it doesn't store
// MO/TMO/total directly (see the model). It's created/updated/destroyed
// alongside these, just via its own budgetId-based calls.
const CARDER_MODELS = {
  allocActual: AllocatedActualCarder,
  shortage: ShortageCarder,
  newRec: NewRecruitCarder,
  rejoined: RejoinedCarder,
  released: ReleasedFromTcCarder,
  resigned: ResignedCarder,
  transfer: TransferCarder,
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
    budgetId: activeBudget?.id ?? null,
    plannedMO: activeBudget?.moCount ?? 0,
    plannedTMO: activeBudget?.tmoCount ?? 0,
  };
}

/**
 * Training Center's Planned mirrors TC Budget Master, not something the user
 * types in - the client only shows it (disabled field, see
 * CadreDetailsCard.jsx) so it must never be trusted from the request body
 * (validateDailyRecordBody already strips tcPlanned out of req.body for the
 * same reason). Resolved here from whichever TCBudget is currently marked
 * active for the factory, or zero if none is.
 */
async function resolveTcPlanned(factoryId, transaction) {
  const activeTcBudget = await TCBudget.findOne({ where: { factoryId, status: true }, transaction });
  return {
    tcBudgetId: activeTcBudget?.id ?? null,
    tcPlanned: activeTcBudget?.planned ?? 0,
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
  const rjmo = n(payload.rejoinedMO);
  const rjtmo = n(payload.rejoinedTMO);
  const relmo = n(payload.releasedMO);
  const reltmo = n(payload.releasedTMO);
  const rmo = n(payload.resignedMO);
  const rtmo = n(payload.resignedTMO);
  const tfmo = n(payload.transferMO);
  const tftmo = n(payload.transferTMO);
  const transferEmployees = Array.isArray(payload.transferEmployees) ? payload.transferEmployees : [];
  // Each Transfer row plays out one of two ways (see Employee.promotedToMo):
  //  - originally TMO (isMo: false) + promotedToMo: true -> an internal
  //    promotion, stays in this carder reclassified as MO (MO +1, TMO -1).
  //  - anyone else on this list (an originally-MO row, or a TMO row without
  //    promotedToMo) -> leaves this carder entirely (their own type -1).
  // Computed from the actual employee rows rather than the raw tfmo/tftmo
  // counts below, so it self-corrects whenever a row is added or removed
  // (Delete/Rejoin) without the caller having to track deltas by hand.
  const transferPromotedMO = transferEmployees.filter((e) => e.isMo === false && e.promotedToMo).length;
  const transferLeavingMO = transferEmployees.filter((e) => e.isMo === true).length;
  const transferLeavingTMO = transferEmployees.filter((e) => e.isMo === false && !e.promotedToMo).length;
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
  const rejoinedTotal = rjmo + rjtmo;
  const releasedTotal = relmo + reltmo;
  const resignedTotal = rmo + rtmo;
  const transferTotal = tfmo + tftmo;

  // Net/Current increase draws from three addition sources - New
  // Recruitment, Rejoined and Released from Tr. Cen. - and two subtraction
  // sources - Resigned/Terminated and whoever actually LEAVES via Transfer
  // (transferLeavingMO/TMO, not the raw tfmo/tftmo counts, since a Transfer
  // row can also be an internal promotion that stays - see
  // transferPromotedMO above). A promotion is zero-sum on the total (MO +1,
  // TMO -1) but does shift the MO/TMO split.
  const netMO = nmo + rjmo + relmo - rmo - transferLeavingMO + transferPromotedMO;
  const netTMO = ntmo + rjtmo + reltmo - rtmo - transferLeavingTMO - transferPromotedMO;
  const netTotal =
    nmo + ntmo + rejoinedTotal + releasedTotal - (rmo + rtmo) - (transferLeavingMO + transferLeavingTMO);

  const currentMO = amo + nmo + rjmo + relmo - rmo - transferLeavingMO + transferPromotedMO;
  const currentTMO = atmo + ntmo + rjtmo + reltmo - rtmo - transferLeavingTMO - transferPromotedMO;
  const currentTotal =
    amo +
    atmo +
    (nmo + ntmo) +
    rejoinedTotal +
    releasedTotal -
    (rmo + rtmo) -
    (transferLeavingMO + transferLeavingTMO);

  const absentTotal = abmo + abtmo;
  const presentMO = Math.max(0, currentMO - abmo);
  const presentTMO = Math.max(0, currentTMO - abtmo);
  const presentTotal = Math.max(0, currentTotal - abmo - abtmo);

  const tcPlanned = n(payload.tcPlanned);
  const tcAllocated = n(payload.tcAllocated);
  const tcRecruit = n(payload.tcRecruit);
  const tcResigned = n(payload.tcResigned);
  const tcTransfer = n(payload.tcTransfer);
  const tcRejoined = n(payload.tcRejoined);
  // Actual Allocated is derived, never trusted from the client (same reason
  // as plannedMO/TMO) - opening balance (tcAllocated, itself carried over
  // from the previous entry's Actual Allocated - see getPreviousDailyRecord)
  // plus new recruits and rejoined trainees, minus resigned/transferred out.
  const tcNet = tcRecruit + tcRejoined - (tcResigned + tcTransfer);
  const tcActual = Math.max(0, tcAllocated + tcNet);
  const tcAbsent = n(payload.tcAbsent);
  const tcPresent = Math.max(0, tcActual - tcAbsent);

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
    rjmo,
    rjtmo,
    rejoinedTotal,
    relmo,
    reltmo,
    releasedTotal,
    rmo,
    rtmo,
    resignedTotal,
    tfmo,
    tftmo,
    transferTotal,
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
    tcRejoined,
    tcNet,
    tcActual,
    tcAbsent,
    tcPresent,
  };
}

/** Row values (per carder table) derived from computeDerived()'s output. */
function rowsFor(d) {
  return {
    allocActual: { MO: d.amo, TMO: d.atmo, total: d.allocActualTotal },
    shortage: { MO: d.shortageMO, TMO: d.shortageTMO, total: d.shortageTotal },
    newRec: { MO: d.nmo, TMO: d.ntmo, total: d.newRecTotal },
    rejoined: { MO: d.rjmo, TMO: d.rjtmo, total: d.rejoinedTotal },
    released: { MO: d.relmo, TMO: d.reltmo, total: d.releasedTotal },
    resigned: { MO: d.rmo, TMO: d.rtmo, total: d.resignedTotal },
    transfer: { MO: d.tfmo, TMO: d.tftmo, total: d.transferTotal },
    net: { MO: d.netMO, TMO: d.netTMO, total: d.netTotal },
    current: { MO: d.currentMO, TMO: d.currentTMO, total: d.currentTotal },
    absent: { MO: d.abmo, TMO: d.abtmo, total: d.absentTotal },
    present: { MO: d.presentMO, TMO: d.presentTMO, total: d.presentTotal },
  };
}

/** Shared shape for one row of either resignedEmployees or transferEmployees below. */
function flattenExitEmployee(e) {
  return {
    epf: e.epf,
    employeeName: e.employeeName,
    designationId: e.designationId,
    // Only meaningful on a Transfer row (see Employee.newDesignationId) -
    // carried along on resignedEmployees rows too, harmless (always null).
    newDesignationId: e.newDesignationId,
    departmentId: e.departmentId,
    sectionId: e.sectionId,
    dateOfJoin: e.dateOfJoin,
    dateOfResign: e.dateOfResign,
    dateOfBirth: e.dateOfBirth,
    civilStatus: e.civilStatus,
    resignationReasonId: e.resignationReasonId,
    isMo: e.isMo,
    // Only meaningful on a Transfer row (see Employee.promotedToMo) -
    // carried along on resignedEmployees rows too, harmless (always null).
    promotedToMo: e.promotedToMo,
    // Only meaningful on a Training Center transfer row.
    tcTransferType: e.tcTransferType ?? null,
  };
}

/** Shape for one row of rejoinedEmployees below - who's currently credited as Rejoined on this batch. */
function flattenRejoinedEmployee(e) {
  return {
    epf: e.epf,
    employeeName: e.employeeName,
    designationId: e.designationId,
    departmentId: e.departmentId,
    sectionId: e.sectionId,
    dateOfJoin: e.dateOfJoin,
    dateOfResign: e.dateOfResign,
    dateOfRejoin: e.dateOfRejoin,
    isMo: e.rejoinedIsMo,
  };
}

function buildFlatRecord({
  batchId,
  date,
  week,
  factory,
  d,
  createdAt,
  resignedEmployees = [],
  transferEmployees = [],
  tcResignedEmployees = [],
  tcTransferEmployees = [],
  rejoinedEmployees = [],
  tcRejoinedEmployees = [],
}) {
  return {
    batchId,
    date,
    createdAt,
    // Resigned/Terminated employee details captured via the popup (see
    // CadreDetailsCard.jsx's ResignedEmployeesModal) - reloaded on edit so
    // the popup can be repopulated instead of asking the user to re-enter
    // them from scratch.
    resignedEmployees: resignedEmployees.map(flattenExitEmployee),
    // Same, for the Transfer tile's employees (isTransfer: true on Employee).
    transferEmployees: transferEmployees.map(flattenExitEmployee),
    // Same, for the Training Center's Resigned field and Transfer to Pro Line popup.
    tcResignedEmployees: tcResignedEmployees.map(flattenExitEmployee),
    tcTransferEmployees: tcTransferEmployees.map(flattenExitEmployee),
    // Who's currently credited as Rejoined on this batch (view-only, see
    // ResignedEmployeesListModal/rejoinResignedEmployee) - unlike the two
    // lists above, never sent back by the client, always read from the DB.
    rejoinedEmployees: rejoinedEmployees.map(flattenRejoinedEmployee),
    // Trainees credited as Rejoined to the Training Center on this batch.
    tcRejoinedEmployees: tcRejoinedEmployees.map(flattenRejoinedEmployee),
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
    rjmo: d.rjmo,
    rjtmo: d.rjtmo,
    rjt: d.rejoinedTotal,
    relmo: d.relmo,
    reltmo: d.reltmo,
    relt: d.releasedTotal,
    rmo: d.rmo,
    rtmo: d.rtmo,
    rt: d.resignedTotal,
    tfmo: d.tfmo,
    tftmo: d.tftmo,
    tft: d.transferTotal,
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
    tcrj: d.tcRejoined,
    tcnet: d.tcNet,
    tactual: d.tcActual,
    tcab: d.tcAbsent,
    tcpresent: d.tcPresent,
  };
}

async function assertFactoryExists(factoryId, transaction) {
  const factory = await Factory.findByPk(factoryId, { transaction });
  if (!factory) throw new ApiError(404, `Factory ${factoryId} not found.`);
  return factory;
}

/**
 * The most recent Daily Data Entry batch for a factory strictly before
 * `beforeDate` (whatever date that was - factories don't necessarily log an
 * entry every day), used to carry values into a fresh Daily Data Entry form
 * (see DailyEntryPage.jsx's prefill effect):
 *  - Allocated_Actual MO/TMO default to that batch's Allocated_Current MO/TMO.
 *  - Training Center's Allocated defaults to that batch's Actual Allocated.
 * Also backs the Dashboard's "right now" KPI tiles for a factory that
 * hasn't logged anything yet this month (see DashboardPage.jsx).
 * PlannedCarder is queried first (every batch has exactly one row there) so
 * both other tables are read from that one canonical batchId, rather than
 * each independently picking "latest date" and risking two different
 * batches on a day with more than one entry.
 */
async function getPreviousDailyRecord({ factoryId, beforeDate }) {
  const latestBatch = await PlannedCarder.findOne({
    where: { factoryId, date: { [Op.lt]: beforeDate } },
    order: [["date", "DESC"], ["createdAt", "DESC"]],
    // Budgets are soft-deleted (paranoid) - see listDailyRecords for why
    // this include bypasses that default.
    include: [{ model: Budget, as: "budget", paranoid: false }],
  });
  if (!latestBatch) return null;

  const [currentRow, tcRow] = await Promise.all([
    AllocatedCurrentCarder.findOne({ where: { batchId: latestBatch.batchId } }),
    TrainingCenter.findOne({ where: { batchId: latestBatch.batchId } }),
  ]);

  return {
    date: latestBatch.date,
    currentMO: currentRow?.MO ?? 0,
    currentTMO: currentRow?.TMO ?? 0,
    tcActual: tcRow?.actualAllocated ?? 0,
    // That batch's Budget (Planned MO+TMO) - lets the Dashboard's Budget
    // Fulfilment tile fall back to this batch alongside its headcount.
    plannedTotal: (latestBatch.budget?.moCount ?? 0) + (latestBatch.budget?.tmoCount ?? 0),
  };
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
    const tcCounts = await resolveTcPlanned(factoryId, transaction);
    const d = computeDerived({ ...payload, ...plannedCounts, ...tcCounts });
    const rows = rowsFor(d);
    const batchId = crypto.randomUUID();
    const base = { weekId: week.id, factoryId, date, batchId };

    for (const [key, Model] of Object.entries(CARDER_MODELS)) {
      await Model.create({ ...base, ...rows[key] }, { transaction });
    }
    await PlannedCarder.create({ ...base, budgetId: plannedCounts.budgetId }, { transaction });
    const tc = await TrainingCenter.create(
      {
        ...base,
        tcBudgetId: tcCounts.tcBudgetId,
        allocated: d.tcAllocated,
        recruit: d.tcRecruit,
        resigned: d.tcResigned,
        transferToProLine: d.tcTransfer,
        rejoined: d.tcRejoined,
        actualAllocated: d.tcActual,
        absent: d.tcAbsent,
        present: d.tcPresent,
      },
      { transaction }
    );

    await employeeService.syncResignedEmployees(payload.resignedEmployees, batchId, transaction, false);
    await employeeService.syncResignedEmployees(payload.transferEmployees, batchId, transaction, true);
    await employeeService.syncResignedEmployees(payload.tcResignedEmployees, batchId, transaction, "tc_resign");
    await employeeService.syncResignedEmployees(payload.tcTransferEmployees, batchId, transaction, "tc_transfer");

    return buildFlatRecord({
      batchId,
      date,
      week,
      factory,
      d,
      createdAt: tc.createdAt,
      resignedEmployees: payload.resignedEmployees,
      transferEmployees: payload.transferEmployees,
      tcResignedEmployees: payload.tcResignedEmployees,
      tcTransferEmployees: payload.tcTransferEmployees,
      // A brand-new batch can't have anyone rejoined-credited to it yet -
      // nothing else could reference this batchId before this transaction.
      rejoinedEmployees: [],
    });
  });
}

/**
 * Carries a change in one entry's closing balance forward through the factory's
 * later Daily Data Entries, and re-derives what depends on it (Shortage, Net,
 * Allocated_Current, Present, TC Actual Allocated / Present). Without this,
 * editing or deleting an earlier entry leaves every later entry on the old numbers.
 *
 * mode "shift" (default): each later entry keeps its own typed Allocated_Actual
 * and moves it by how far the previous day's Allocated_Current moved, so a
 * deliberate correction (the real headcount typed in) survives. `before` is the
 * edited/deleted entry's closingOf() taken ahead of the change; later entries'
 * own old balances are tracked as the walk goes.
 * mode "reset": Allocated_Actual is forced to the previous day's
 * Allocated_Current (scripts/rechain-allocated.js, a deliberate repair).
 *
 * Entries are walked in (date, createdAt) order. Where to start: just after
 * `afterBatchId`, or at the first entry dated `fromDate` or later. Entries
 * before that point are left alone and only supply the opening balance. As in
 * getPreviousDailyRecord, an entry's predecessor is the last entry of the
 * nearest earlier DATE (entries sharing a date don't chain to each other).
 * Returns what changed: [{ batchId, date, before, after }].
 */
async function rechainFactory(
  factoryId,
  { afterBatchId = null, fromDate = null, before = null, mode = "shift" } = {},
  transaction,
) {
  const entries = await PlannedCarder.findAll({
    where: { factoryId },
    order: [
      ["date", "ASC"],
      ["createdAt", "ASC"],
    ],
    transaction,
  });
  const start = afterBatchId
    ? entries.findIndex((e) => e.batchId === afterBatchId) + 1
    : entries.findIndex((e) => e.date >= fromDate);
  if (start < 0) return [];

  const changes = [];
  // batchId -> { before, after } of { cmo, ctmo, tca } for entries walked so far.
  const moved = new Map();
  let lastOfEarlierDates = null; // last entry on a date before the one being walked
  let lastOfThisDate = null;
  let walkingDate = null;
  let openingPredId = null;
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry.date !== walkingDate) {
      if (lastOfThisDate) lastOfEarlierDates = lastOfThisDate;
      walkingDate = entry.date;
    }
    lastOfThisDate = entry;
    if (i < start || !lastOfEarlierDates) continue;

    const { batchId } = entry;
    const prevBatchId = lastOfEarlierDates.batchId;
    if (openingPredId === null) {
      // `before` is the edited/deleted entry's figures from before the change; it only
      // describes the predecessor when that really is the edited entry (or the entry
      // is gone, so afterBatchId is null).
      openingPredId = prevBatchId;
      if (afterBatchId && prevBatchId !== afterBatchId) before = null;
    }
    const [prevCurrent, prevTc, current, tc, budget, raw] = await Promise.all([
      AllocatedCurrentCarder.findOne({ where: { batchId: prevBatchId }, transaction }),
      TrainingCenter.findOne({ where: { batchId: prevBatchId }, transaction }),
      AllocatedCurrentCarder.findOne({ where: { batchId }, transaction }),
      TrainingCenter.findOne({ where: { batchId }, transaction }),
      entry.budgetId ? Budget.findByPk(entry.budgetId, { paranoid: false, transaction }) : null,
      getRawPayloadForBatch(batchId, transaction),
    ]);
    const prevNow = { cmo: prevCurrent?.MO ?? 0, ctmo: prevCurrent?.TMO ?? 0, tca: prevTc?.actualAllocated ?? 0 };

    let amo;
    let atmo;
    let tcAllocated;
    if (mode === "reset") {
      // Opening balance = the previous day's closing balance, whatever was typed.
      amo = prevNow.cmo;
      atmo = prevNow.ctmo;
      tcAllocated = prevNow.tca;
    } else {
      // Keep this entry's own typed adjustment; only carry forward how far the
      // previous day's closing balance moved.
      const prevWas = moved.get(prevBatchId)?.before ?? (prevBatchId === openingPredId ? before : null) ?? prevNow;
      amo = raw.allocActualMO + (prevNow.cmo - prevWas.cmo);
      atmo = raw.allocActualTMO + (prevNow.ctmo - prevWas.ctmo);
      tcAllocated = raw.tcAllocated + (prevNow.tca - prevWas.tca);
    }

    const was = { cmo: current?.MO ?? 0, ctmo: current?.TMO ?? 0, tca: tc?.actualAllocated ?? 0 };
    const d = computeDerived({
      ...raw,
      allocActualMO: amo,
      allocActualTMO: atmo,
      tcAllocated,
      plannedMO: budget?.moCount ?? 0,
      plannedTMO: budget?.tmoCount ?? 0,
    });
    moved.set(batchId, { before: was, after: { cmo: d.currentMO, ctmo: d.currentTMO, tca: d.tcActual } });

    const beforeShown = { amo: raw.allocActualMO, atmo: raw.allocActualTMO, cmo: was.cmo, ctmo: was.ctmo };
    const after = { amo: d.amo, atmo: d.atmo, cmo: d.currentMO, ctmo: d.currentTMO };
    if (JSON.stringify(beforeShown) === JSON.stringify(after) && tcAllocated === raw.tcAllocated) continue;

    const rows = rowsFor(d);
    for (const key of ["allocActual", "shortage", "net", "current", "present"]) {
      await CARDER_MODELS[key].update(rows[key], { where: { batchId }, transaction });
    }
    await TrainingCenter.update(
      { allocated: d.tcAllocated, actualAllocated: d.tcActual, present: d.tcPresent },
      { where: { batchId }, transaction },
    );
    changes.push({ batchId, date: entry.date, before: beforeShown, after });
  }
  return changes;
}

/** An entry's closing figures, for rechainFactory's `before` (taken ahead of the change that triggers it). */
async function closingOf(batchId, transaction) {
  const [current, tc] = await Promise.all([
    AllocatedCurrentCarder.findOne({ where: { batchId }, transaction }),
    TrainingCenter.findOne({ where: { batchId }, transaction }),
  ]);
  return { cmo: current?.MO ?? 0, ctmo: current?.TMO ?? 0, tca: tc?.actualAllocated ?? 0 };
}

/**
 * The actual "update every row belonging to a batch" work, factored out of
 * updateDailyRecord so deleteResignedEmployee below can run it inside its
 * own transaction (alongside the employee hard-delete) instead of nesting a
 * second sequelize.transaction() call.
 */
async function performUpdate(batchId, payload, transaction) {
  const { factoryId, date } = payload;
  const closingBefore = await closingOf(batchId, transaction);

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
  const tcCounts = await resolveTcPlanned(factoryId, transaction);
  const d = computeDerived({ ...payload, ...plannedCounts, ...tcCounts });
  const rows = rowsFor(d);
  const base = { weekId: week.id, factoryId, date };

  for (const [key, Model] of Object.entries(CARDER_MODELS)) {
    await Model.update({ ...base, ...rows[key] }, { where: { batchId }, transaction });
  }
  await PlannedCarder.update(
    { ...base, budgetId: plannedCounts.budgetId },
    { where: { batchId }, transaction }
  );
  await TrainingCenter.update(
    {
      ...base,
      tcBudgetId: tcCounts.tcBudgetId,
      allocated: d.tcAllocated,
      recruit: d.tcRecruit,
      resigned: d.tcResigned,
      transferToProLine: d.tcTransfer,
      rejoined: d.tcRejoined,
      actualAllocated: d.tcActual,
      absent: d.tcAbsent,
      present: d.tcPresent,
    },
    { where: { batchId }, transaction }
  );

  await employeeService.syncResignedEmployees(payload.resignedEmployees, batchId, transaction, false);
  await employeeService.syncResignedEmployees(payload.transferEmployees, batchId, transaction, true);
  await employeeService.syncResignedEmployees(payload.tcResignedEmployees, batchId, transaction, "tc_resign");
  await employeeService.syncResignedEmployees(payload.tcTransferEmployees, batchId, transaction, "tc_transfer");

  // Unlike resigned/transferEmployees above, rejoinedEmployees never comes
  // from the client's payload - it's purely server-side link state (see
  // rejoinResignedEmployee), so it's read fresh here on every re-persist.
  const rejoinedEmployees = await employeeService.listRejoinedByBatchIds([batchId], transaction);
  const tcRejoinedEmployees = await employeeService.listRejoinedByBatchIds([batchId], transaction, { tc: true });

  // Later entries open from this one's Allocated_Current - carry the change forward.
  await rechainFactory(factoryId, { afterBatchId: batchId, before: closingBefore }, transaction);

  return buildFlatRecord({
    batchId,
    date,
    week,
    factory,
    d,
    createdAt: existing.createdAt,
    resignedEmployees: payload.resignedEmployees,
    transferEmployees: payload.transferEmployees,
    tcResignedEmployees: payload.tcResignedEmployees,
    tcTransferEmployees: payload.tcTransferEmployees,
    rejoinedEmployees,
    tcRejoinedEmployees,
  });
}

/** Updates every row belonging to a batch (a previously submitted Daily Data Entry record). */
async function updateDailyRecord(batchId, payload) {
  return sequelize.transaction((transaction) => performUpdate(batchId, payload, transaction));
}

/**
 * Raw (pre-derived) input values for one batch, shaped exactly like what the
 * client's buildPayload() sends (see client/src/utils/cadreCalculations.js) -
 * lets deleteResignedEmployee below reconstruct a full, valid payload for
 * performUpdate from whatever's currently stored, without the client having
 * to resubmit the whole Daily Data Entry form just to remove one employee.
 */
async function getRawPayloadForBatch(batchId, transaction) {
  const planned = await PlannedCarder.findOne({ where: { batchId }, transaction });
  if (!planned) {
    throw new ApiError(404, `Record ${batchId} not found.`);
  }

  const [allocActual, newRec, rejoined, released, resigned, transfer, absent, tc, employees] =
    await Promise.all([
      AllocatedActualCarder.findOne({ where: { batchId }, transaction }),
      NewRecruitCarder.findOne({ where: { batchId }, transaction }),
      RejoinedCarder.findOne({ where: { batchId }, transaction }),
      ReleasedFromTcCarder.findOne({ where: { batchId }, transaction }),
      ResignedCarder.findOne({ where: { batchId }, transaction }),
      TransferCarder.findOne({ where: { batchId }, transaction }),
      AbsenteeismCarder.findOne({ where: { batchId }, transaction }),
      TrainingCenter.findOne({ where: { batchId }, transaction }),
      employeeService.listByBatchIds([batchId], transaction),
    ]);

  return {
    factoryId: planned.factoryId,
    date: planned.date,
    allocActualMO: allocActual?.MO ?? 0,
    allocActualTMO: allocActual?.TMO ?? 0,
    newRecMO: newRec?.MO ?? 0,
    newRecTMO: newRec?.TMO ?? 0,
    rejoinedMO: rejoined?.MO ?? 0,
    rejoinedTMO: rejoined?.TMO ?? 0,
    releasedMO: released?.MO ?? 0,
    releasedTMO: released?.TMO ?? 0,
    resignedMO: resigned?.MO ?? 0,
    resignedTMO: resigned?.TMO ?? 0,
    transferMO: transfer?.MO ?? 0,
    transferTMO: transfer?.TMO ?? 0,
    absentMO: absent?.MO ?? 0,
    absentTMO: absent?.TMO ?? 0,
    tcAllocated: tc?.allocated ?? 0,
    tcRecruit: tc?.recruit ?? 0,
    tcResigned: tc?.resigned ?? 0,
    tcTransfer: tc?.transferToProLine ?? 0,
    tcRejoined: tc?.rejoined ?? 0,
    tcAbsent: tc?.absent ?? 0,
    resignedEmployees: employees
      .filter((e) => !e.isTransfer && !e.isTcTransfer && !e.isTcResign)
      .map(flattenExitEmployee),
    transferEmployees: employees.filter((e) => e.isTransfer).map(flattenExitEmployee),
    tcResignedEmployees: employees.filter((e) => e.isTcResign).map(flattenExitEmployee),
    tcTransferEmployees: employees.filter((e) => e.isTcTransfer).map(flattenExitEmployee),
  };
}

/**
 * Raw-payload overrides that drop one Training Center transfer employee: the
 * list loses the row, tcTransfer goes down by one and, for a row that moved
 * to production, so does the matching released MO/TMO count.
 */
function withoutTcTransferEmployee(raw, epf, tcTransferType) {
  return {
    tcTransfer: Math.max(0, raw.tcTransfer - 1),
    releasedMO: tcTransferType === "prod_mo" ? Math.max(0, raw.releasedMO - 1) : raw.releasedMO,
    releasedTMO: tcTransferType === "prod_tmo" ? Math.max(0, raw.releasedTMO - 1) : raw.releasedTMO,
    tcTransferEmployees: raw.tcTransferEmployees.filter((e) => e.epf !== epf),
  };
}

/**
 * Permanently deletes one Resigned/Terminated or Transfer employee -
 * hard-deletes the Employee row itself (employeeService.deleteResignedEmployee),
 * not just unlinking it, then immediately re-persists the rest of the batch
 * with the right tile's MO/TMO count (Resigned or Transfer, based on the
 * deleted row's isTransfer flag - and everything that derives from it - Net,
 * Allocated_Current, Present) reduced to match, in the same transaction.
 * Backs the per-employee Delete button in ResignedEmployeesModal.jsx.
 */
async function deleteResignedEmployee(batchId, epf) {
  return sequelize.transaction(async (transaction) => {
    const raw = await getRawPayloadForBatch(batchId, transaction);
    const { isMo, isTransfer, isTcTransfer, isTcResign, tcTransferType } = await employeeService.deleteResignedEmployee(
      epf,
      batchId,
      transaction,
    );

    const payload = { ...raw };
    if (isTcTransfer) {
      Object.assign(payload, withoutTcTransferEmployee(raw, epf, tcTransferType));
    } else if (isTcResign) {
      payload.tcResigned = Math.max(0, raw.tcResigned - 1);
      payload.tcResignedEmployees = raw.tcResignedEmployees.filter((e) => e.epf !== epf);
    } else if (isTransfer) {
      payload.transferMO = isMo ? Math.max(0, raw.transferMO - 1) : raw.transferMO;
      payload.transferTMO = !isMo ? Math.max(0, raw.transferTMO - 1) : raw.transferTMO;
      payload.transferEmployees = raw.transferEmployees.filter((e) => e.epf !== epf);
    } else {
      payload.resignedMO = isMo ? Math.max(0, raw.resignedMO - 1) : raw.resignedMO;
      payload.resignedTMO = !isMo ? Math.max(0, raw.resignedTMO - 1) : raw.resignedTMO;
      payload.resignedEmployees = raw.resignedEmployees.filter((e) => e.epf !== epf);
    }

    return performUpdate(batchId, payload, transaction);
  });
}

/**
 * Moves a Daily Data Entry's stored Resigned MO/TMO counts by the given deltas
 * (floored at 0) and re-derives Net / Allocated_Current / Present from them -
 * for when a resignation is re-dated onto, or off, this entry from Manage
 * Employees. Same re-derivation as scripts/reconcile-resigned.js.
 */
async function shiftResignedCounts(batchId, { mo = 0, tmo = 0, tc = 0 }, transaction) {
  const closingBefore = await closingOf(batchId, transaction);
  const raw = await getRawPayloadForBatch(batchId, transaction);
  const d = computeDerived({
    ...raw,
    resignedMO: Math.max(0, raw.resignedMO + mo),
    resignedTMO: Math.max(0, raw.resignedTMO + tmo),
    tcResigned: Math.max(0, raw.tcResigned + tc),
  });
  const rows = rowsFor(d);
  for (const key of ["resigned", "net", "current", "present"]) {
    await CARDER_MODELS[key].update(rows[key], { where: { batchId }, transaction });
  }
  await TrainingCenter.update(
    { resigned: d.tcResigned, actualAllocated: d.tcActual, present: d.tcPresent },
    { where: { batchId }, transaction },
  );
  await rechainFactory(raw.factoryId, { afterBatchId: batchId, before: closingBefore }, transaction);
}

/**
 * Reactivates one Resigned/Terminated or Transfer employee - backs the
 * per-employee Rejoin button in ResignedEmployeesListModal.jsx. Unlike
 * deleteResignedEmployee, the Employee row survives
 * (employeeService.rejoinEmployee just clears its exit fields and unlinks it
 * from this batch).
 *
 * Transfer keeps the original, simple behavior: this same batch's Transfer
 * MO/TMO count moves down by one and its Rejoined MO/TMO count moves up by
 * one, in a single re-persist.
 *
 * Resigned/Terminated instead takes a `rejoinDate` (required, asked via the
 * modal's SweetAlert date prompt): this batch's Resigned MO/TMO count still
 * moves down by one here (this is where the resignation itself was
 * recorded), but the Rejoined MO/TMO credit goes to whichever Daily Data
 * Entry batch actually covers that factory on `rejoinDate` - a different
 * batch in the common case (rejoining days/weeks after the resignation),
 * the very same one when it happens to be dated the same day (folded into
 * one update, same as Transfer). Throws 400 if that date has no entry yet
 * for the factory - the admin has to submit that day's entry first.
 */
async function rejoinResignedEmployee(batchId, epf, rejoinDate) {
  return sequelize.transaction(async (transaction) => {
    const linked = await employeeService.findLinkedEmployee(epf, batchId, transaction);
    if (!linked) {
      throw new ApiError(404, `Employee ${epf} is not on record ${batchId}.`);
    }
    if (linked.isTcTransfer) {
      throw new ApiError(
        400,
        "A Training Center transfer cannot be rejoined here. Delete the row instead, or record the person on the Rejoined tile.",
      );
    }
    const { isTransfer, isTcResign } = linked;

    let targetBatchId = batchId;
    if (!isTransfer) {
      if (!rejoinDate) {
        throw new ApiError(400, "Rejoined Date is required.");
      }
      if (linked.dateOfResign && rejoinDate < linked.dateOfResign) {
        throw new ApiError(400, "Rejoined Date cannot be before the Date of Resign.");
      }
      const today = new Date().toISOString().slice(0, 10);
      if (rejoinDate > today) {
        throw new ApiError(400, "Rejoined Date cannot be in the future.");
      }

      const originalPlanned = await PlannedCarder.findOne({ where: { batchId }, transaction });
      if (rejoinDate !== originalPlanned.date) {
        const target = await PlannedCarder.findOne({
          where: { factoryId: originalPlanned.factoryId, date: rejoinDate },
          order: [["createdAt", "DESC"]],
          transaction,
        });
        if (!target) {
          throw new ApiError(
            400,
            `No Daily Data Entry exists for this factory on ${rejoinDate}. Submit that day's entry first, then rejoin from there.`,
          );
        }
        targetBatchId = target.batchId;
      }
    }

    const raw = await getRawPayloadForBatch(batchId, transaction);
    const { isMo, isTransfer: rowIsTransfer } = await employeeService.rejoinEmployee(epf, batchId, transaction, {
      rejoinDate: isTransfer ? null : rejoinDate,
      rejoinedBatchId: targetBatchId,
    });

    const payload = { ...raw };
    if (isTcResign) {
      payload.tcResigned = Math.max(0, raw.tcResigned - 1);
      payload.tcResignedEmployees = raw.tcResignedEmployees.filter((e) => e.epf !== epf);
    } else if (rowIsTransfer) {
      payload.transferMO = isMo ? Math.max(0, raw.transferMO - 1) : raw.transferMO;
      payload.transferTMO = !isMo ? Math.max(0, raw.transferTMO - 1) : raw.transferTMO;
      payload.transferEmployees = raw.transferEmployees.filter((e) => e.epf !== epf);
    } else {
      payload.resignedMO = isMo ? Math.max(0, raw.resignedMO - 1) : raw.resignedMO;
      payload.resignedTMO = !isMo ? Math.max(0, raw.resignedTMO - 1) : raw.resignedTMO;
      payload.resignedEmployees = raw.resignedEmployees.filter((e) => e.epf !== epf);
    }

    // A rejoining trainee is credited to the Training Center's own Rejoined
    // count, not production's Rejoined MO/TMO.
    const creditRejoin = (target) =>
      isTcResign
        ? { ...target, tcRejoined: target.tcRejoined + 1 }
        : {
            ...target,
            rejoinedMO: isMo ? target.rejoinedMO + 1 : target.rejoinedMO,
            rejoinedTMO: !isMo ? target.rejoinedTMO + 1 : target.rejoinedTMO,
          };

    if (targetBatchId === batchId) {
      return performUpdate(batchId, creditRejoin(payload), transaction);
    }

    // Different record for the chosen Rejoined Date - decrement Resigned
    // here, credit Rejoined over there.
    const updatedOriginal = await performUpdate(batchId, payload, transaction);
    const targetRaw = await getRawPayloadForBatch(targetBatchId, transaction);
    await performUpdate(targetBatchId, creditRejoin(targetRaw), transaction);
    return updatedOriginal;
  });
}

/**
 * Cancels a rejoin - backs the per-employee Cancel Rejoin button in
 * RejoinedEmployeesListModal.jsx, the inverse of rejoinResignedEmployee above.
 * `batchId` is the entry the Rejoined credit sits on. The exit event is put
 * back to standing (employeeService.cancelRejoin), so the employee returns to
 * their original entry's Resigned/Transfer list: that entry's Resigned (or
 * Transfer / Training Center Resigned) count goes up by one and this entry's
 * Rejoined count goes down by one. They can be the same entry, in which case
 * both changes land in one re-persist. Returns the updated `batchId` record.
 */
async function cancelRejoinedEmployee(batchId, epf) {
  return sequelize.transaction(async (transaction) => {
    const { originalBatchId, isMo, rejoinedIsMo, isTransfer, isTcResign } = await employeeService.cancelRejoin(
      epf,
      batchId,
      transaction,
    );

    const restoreExit = (target) => {
      if (isTcResign) return { ...target, tcResigned: target.tcResigned + 1 };
      const tile = isTransfer ? "transfer" : "resigned";
      const key = (carder) => `${tile}${carder}`;
      return {
        ...target,
        [key("MO")]: isMo ? target[key("MO")] + 1 : target[key("MO")],
        [key("TMO")]: !isMo ? target[key("TMO")] + 1 : target[key("TMO")],
      };
    };
    const removeCredit = (target) =>
      isTcResign
        ? { ...target, tcRejoined: Math.max(0, target.tcRejoined - 1) }
        : {
            ...target,
            rejoinedMO: rejoinedIsMo ? Math.max(0, target.rejoinedMO - 1) : target.rejoinedMO,
            rejoinedTMO: !rejoinedIsMo ? Math.max(0, target.rejoinedTMO - 1) : target.rejoinedTMO,
          };

    // The employee is back on their original entry's list by now, so the raw
    // payload read here already includes them - only the counts need moving.
    if (originalBatchId === batchId) {
      const raw = await getRawPayloadForBatch(batchId, transaction);
      return performUpdate(batchId, removeCredit(restoreExit(raw)), transaction);
    }
    const originalRaw = await getRawPayloadForBatch(originalBatchId, transaction);
    await performUpdate(originalBatchId, restoreExit(originalRaw), transaction);
    const raw = await getRawPayloadForBatch(batchId, transaction);
    return performUpdate(batchId, removeCredit(raw), transaction);
  });
}

/** Deletes every row belonging to a batch. */
async function deleteDailyRecord(batchId) {
  return sequelize.transaction(async (transaction) => {
    const existing = await PlannedCarder.findOne({ where: { batchId }, transaction });
    if (!existing) {
      throw new ApiError(404, `Record ${batchId} not found.`);
    }
    const closingBefore = await closingOf(batchId, transaction);
    for (const Model of Object.values(CARDER_MODELS)) {
      await Model.destroy({ where: { batchId }, transaction });
    }
    await PlannedCarder.destroy({ where: { batchId }, transaction });
    await TrainingCenter.destroy({ where: { batchId }, transaction });
    await employeeService.unlinkBatch(batchId, transaction);
    // The entry after this one now follows the one before it.
    await rechainFactory(existing.factoryId, { fromDate: existing.date, before: closingBefore }, transaction);
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

  const [weeks, factories, plannedRows, ...tableRows] = await Promise.all([
    Week.findAll({ attributes: ["id", "week"] }),
    Factory.findAll({ attributes: ["id", "factoryName"] }),
    // Budgets are soft-deleted (paranoid), not hard-deleted - a daily record
    // from before its budget was later deleted should still show the
    // MO/TMO it pointed to, so this include bypasses the paranoid default.
    PlannedCarder.findAll({ where, include: [{ model: Budget, as: "budget", paranoid: false }] }),
    ...Object.values(CARDER_MODELS).map((Model) => Model.findAll({ where })),
    // TCBudgets are soft-deleted (paranoid) too - see the Budget include
    // above for why this bypasses that default.
    TrainingCenter.findAll({ where, include: [{ model: TCBudget, as: "tcBudget", paranoid: false }] }),
  ]);

  const weekMap = new Map(weeks.map((w) => [w.id, w]));
  const factoryMap = new Map(factories.map((f) => [f.id, f]));
  const keys = Object.keys(CARDER_MODELS);
  const carderRowsByKey = Object.fromEntries(keys.map((key, i) => [key, tableRows[i]]));
  const tcRows = tableRows[keys.length];

  const batches = new Map(); // batchId -> { date, weekId, factoryId, createdAt, planned: row, rows: { allocActual: row, ... }, tc: row }

  const getBatch = (row) => {
    if (!batches.has(row.batchId)) {
      batches.set(row.batchId, {
        date: row.date,
        weekId: row.weekId,
        factoryId: row.factoryId,
        createdAt: row.createdAt,
        planned: null,
        rows: {},
        tc: null,
      });
    }
    return batches.get(row.batchId);
  };

  plannedRows.forEach((row) => {
    getBatch(row).planned = row;
  });
  keys.forEach((key) => {
    carderRowsByKey[key].forEach((row) => {
      getBatch(row).rows[key] = row;
    });
  });
  tcRows.forEach((row) => {
    getBatch(row).tc = row;
  });

  const employeeRows = await employeeService.listByBatchIds([...batches.keys()]);
  const employeesByBatch = new Map();
  const transferEmployeesByBatch = new Map();
  const tcResignedEmployeesByBatch = new Map();
  const tcTransferEmployeesByBatch = new Map();
  employeeRows.forEach((row) => {
    const byBatch = row.isTcTransfer
      ? tcTransferEmployeesByBatch
      : row.isTcResign
        ? tcResignedEmployeesByBatch
        : row.isTransfer
          ? transferEmployeesByBatch
          : employeesByBatch;
    if (!byBatch.has(row.batchId)) byBatch.set(row.batchId, []);
    byBatch.get(row.batchId).push(row);
  });

  const groupRejoined = (rows) => {
    const byBatch = new Map();
    rows.forEach((row) => {
      if (!byBatch.has(row.rejoinedBatchId)) byBatch.set(row.rejoinedBatchId, []);
      byBatch.get(row.rejoinedBatchId).push(row);
    });
    return byBatch;
  };
  const rejoinedEmployeesByBatch = groupRejoined(
    await employeeService.listRejoinedByBatchIds([...batches.keys()]),
  );
  const tcRejoinedEmployeesByBatch = groupRejoined(
    await employeeService.listRejoinedByBatchIds([...batches.keys()], undefined, { tc: true }),
  );

  const records = [...batches.entries()].map(([batchId, batch]) => {
    const pmo = batch.planned?.budget?.moCount ?? 0;
    const ptmo = batch.planned?.budget?.tmoCount ?? 0;
    const d = {
      pmo,
      ptmo,
      plannedTotal: pmo + ptmo,
      amo: batch.rows.allocActual?.MO ?? 0,
      atmo: batch.rows.allocActual?.TMO ?? 0,
      allocActualTotal: batch.rows.allocActual?.total ?? 0,
      shortageMO: batch.rows.shortage?.MO ?? 0,
      shortageTMO: batch.rows.shortage?.TMO ?? 0,
      shortageTotal: batch.rows.shortage?.total ?? 0,
      nmo: batch.rows.newRec?.MO ?? 0,
      ntmo: batch.rows.newRec?.TMO ?? 0,
      newRecTotal: batch.rows.newRec?.total ?? 0,
      rjmo: batch.rows.rejoined?.MO ?? 0,
      rjtmo: batch.rows.rejoined?.TMO ?? 0,
      rejoinedTotal: batch.rows.rejoined?.total ?? 0,
      relmo: batch.rows.released?.MO ?? 0,
      reltmo: batch.rows.released?.TMO ?? 0,
      releasedTotal: batch.rows.released?.total ?? 0,
      rmo: batch.rows.resigned?.MO ?? 0,
      rtmo: batch.rows.resigned?.TMO ?? 0,
      resignedTotal: batch.rows.resigned?.total ?? 0,
      tfmo: batch.rows.transfer?.MO ?? 0,
      tftmo: batch.rows.transfer?.TMO ?? 0,
      transferTotal: batch.rows.transfer?.total ?? 0,
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
      tcPlanned: batch.tc?.tcBudget?.planned ?? 0,
      tcAllocated: batch.tc?.allocated ?? 0,
      tcRecruit: batch.tc?.recruit ?? 0,
      tcResigned: batch.tc?.resigned ?? 0,
      tcTransfer: batch.tc?.transferToProLine ?? 0,
      tcRejoined: batch.tc?.rejoined ?? 0,
      tcActual: batch.tc?.actualAllocated ?? 0,
      tcAbsent: batch.tc?.absent ?? 0,
      tcPresent: batch.tc?.present ?? 0,
    };

    return buildFlatRecord({
      batchId,
      date: batch.date,
      week: weekMap.get(batch.weekId),
      factory: factoryMap.get(batch.factoryId),
      d,
      createdAt: batch.createdAt,
      resignedEmployees: employeesByBatch.get(batchId) || [],
      transferEmployees: transferEmployeesByBatch.get(batchId) || [],
      tcResignedEmployees: tcResignedEmployeesByBatch.get(batchId) || [],
      tcTransferEmployees: tcTransferEmployeesByBatch.get(batchId) || [],
      tcRejoinedEmployees: tcRejoinedEmployeesByBatch.get(batchId) || [],
      rejoinedEmployees: rejoinedEmployeesByBatch.get(batchId) || [],
    });
  });

  records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return records;
}

/**
 * Group-wide + per-factory yearly trend, one point per month - backs the
 * "Cadre Trend", "Recruitment & Resign", "LTO Ratio" and "Absenteeism"
 * dashboard charts, which the HR Performance Analysis report keeps as
 * separate sheets but which all read the same daily records over the same
 * year, so one query does all four:
 *  - budget mirrors "Cadre Trend" (AVERAGE CADRE STATUS TREND_MO & TMO):
 *    resolved the same way Daily Data Entry does (whichever Budget was
 *    active for the factory on each day, via PlannedCarder's budget join),
 *    *averaged* across every daily entry within the month, matching the
 *    sheet's "AVERAGE". Allocated is instead a snapshot, not an average: the
 *    Allocated_Current MO+TMO (AllocatedCurrentCarder.total) from whichever
 *    entry has the latest Date that month for that factory (same figure the
 *    dashboard's Current Headcount / Cadre Fulfilment use), so the trend
 *    line reads as "headcount on the floor at month's end", not a monthly
 *    average.
 *  - recruitment/resigned mirror "FACTORY WISE RECRUITMENT & RESIGN TREND":
 *    each daily entry's New Recruit total (Cadre side) plus that day's
 *    Training Center Recruit. count, and Resigned/Terminated total (Cadre
 *    side only - Transfer is a different tile/table and deliberately left
 *    out, since it isn't attrition), are counts of people that day, so
 *    these are *summed* (not averaged) across the month.
 *  - absent mirrors the "Absenteeism" sheet's per-month Absenteeism count -
 *    a daily attendance snapshot like Allocated, so it's *averaged* (not
 *    summed) across the month the same way; the sheet's Absenteeism Rate
 *    (Absenteeism / Allocated Cadre) is left for the caller to derive from
 *    absent/allocated, same as LTO Ratio already derives from resigned/
 *    allocated.
 * Every figure is then summed across factories for the Group line, the
 * same way the workbook's Group row is the sum of its factory rows. A
 * month with no daily entries yet reports zero for all five.
 */
async function getCadreTrend({ year, factoryId } = {}) {
  const y = year || new Date().getFullYear();
  const yearStart = `${y}-01-01`;
  const yearEnd = `${y}-12-31`;
  const where = { date: { [Op.between]: [yearStart, yearEnd] } };
  if (factoryId) where.factoryId = factoryId;

  const [factories, plannedRows, allocatedRows, newRecRows, tcRows, resignedRows, absentRows] = await Promise.all([
    Factory.findAll({ attributes: ["id", "factoryName"] }),
    // Budgets are soft-deleted (paranoid) - see listDailyRecords for why
    // this include bypasses that default.
    PlannedCarder.findAll({ where, include: [{ model: Budget, as: "budget", paranoid: false }] }),
    AllocatedCurrentCarder.findAll({ where }),
    NewRecruitCarder.findAll({ where }),
    TrainingCenter.findAll({ where, attributes: ["factoryId", "date", "recruit", "resigned", "actualAllocated", "createdAt"] }),
    ResignedCarder.findAll({ where }),
    AbsenteeismCarder.findAll({ where }),
  ]);

  const monthKey = (date) => date.slice(0, 7); // "YYYY-MM"
  const months = Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);

  // factoryId -> month -> running sums, averaged/totalled once every row is in.
  const perFactory = new Map();
  const bucket = (fid, month) => {
    if (!perFactory.has(fid)) perFactory.set(fid, new Map());
    const byMonth = perFactory.get(fid);
    if (!byMonth.has(month)) {
      byMonth.set(month, {
        budgetSum: 0,
        budgetCount: 0,
        allocLatest: null,
        recruitment: 0,
        resigned: 0,
        tcRecruitment: 0,
        tcResigned: 0,
        tcAllocLatest: null,
        absentSum: 0,
        absentCount: 0,
      });
    }
    return byMonth.get(month);
  };

  plannedRows.forEach((row) => {
    const budget = (row.budget?.moCount ?? 0) + (row.budget?.tmoCount ?? 0);
    const b = bucket(row.factoryId, monthKey(row.date));
    b.budgetSum += budget;
    b.budgetCount += 1;
  });
  allocatedRows.forEach((row) => {
    const b = bucket(row.factoryId, monthKey(row.date));
    // Snapshot, not a sum/average - keep only the row for this factory's
    // latest Date within the month (createdAt breaks a same-day tie).
    if (
      !b.allocLatest ||
      row.date > b.allocLatest.date ||
      (row.date === b.allocLatest.date &&
        new Date(row.createdAt) > new Date(b.allocLatest.createdAt))
    ) {
      b.allocLatest = { date: row.date, createdAt: row.createdAt, total: row.total };
    }
  });
  newRecRows.forEach((row) => {
    bucket(row.factoryId, monthKey(row.date)).recruitment += row.total;
  });
  tcRows.forEach((row) => {
    const b = bucket(row.factoryId, monthKey(row.date));
    b.recruitment += row.recruit ?? 0;
    // Also tracked on their own for the Dashboard's Training Center KPI card
    // (recruitment above still folds TC in, so the trend chart is unchanged;
    // TC resigns are not part of the cadre-side `resigned` figure).
    b.tcRecruitment += row.recruit ?? 0;
    b.tcResigned += row.resigned ?? 0;
    // Training Center headcount snapshot (latest entry of the month), the
    // denominator companion for the LTO ratio.
    if (
      !b.tcAllocLatest ||
      row.date > b.tcAllocLatest.date ||
      (row.date === b.tcAllocLatest.date && new Date(row.createdAt) > new Date(b.tcAllocLatest.createdAt))
    ) {
      b.tcAllocLatest = { date: row.date, createdAt: row.createdAt, total: row.actualAllocated ?? 0 };
    }
  });
  resignedRows.forEach((row) => {
    bucket(row.factoryId, monthKey(row.date)).resigned += row.total;
  });
  absentRows.forEach((row) => {
    const b = bucket(row.factoryId, monthKey(row.date));
    b.absentSum += row.total;
    b.absentCount += 1;
  });

  const factoryMap = new Map(factories.map((f) => [f.id, f]));
  const byFactory = [...perFactory.entries()].map(([fid, byMonth]) => ({
    factoryId: fid,
    factory: factoryMap.get(fid)?.factoryName || "Unknown Factory",
    months: months.map((m) => {
      const b = byMonth.get(m);
      return {
        month: m,
        budget: b && b.budgetCount ? Math.round(b.budgetSum / b.budgetCount) : 0,
        allocated: b?.allocLatest?.total ?? 0,
        recruitment: b?.recruitment ?? 0,
        resigned: b?.resigned ?? 0,
        tcRecruitment: b?.tcRecruitment ?? 0,
        tcResigned: b?.tcResigned ?? 0,
        tcAllocated: b?.tcAllocLatest?.total ?? 0,
        absent: b && b.absentCount ? Math.round(b.absentSum / b.absentCount) : 0,
      };
    }),
  }));

  const group = months.map((m, i) => ({
    month: m,
    budget: byFactory.reduce((sum, f) => sum + f.months[i].budget, 0),
    allocated: byFactory.reduce((sum, f) => sum + f.months[i].allocated, 0),
    recruitment: byFactory.reduce((sum, f) => sum + f.months[i].recruitment, 0),
    resigned: byFactory.reduce((sum, f) => sum + f.months[i].resigned, 0),
    tcRecruitment: byFactory.reduce((sum, f) => sum + f.months[i].tcRecruitment, 0),
    tcResigned: byFactory.reduce((sum, f) => sum + f.months[i].tcResigned, 0),
    tcAllocated: byFactory.reduce((sum, f) => sum + f.months[i].tcAllocated, 0),
    absent: byFactory.reduce((sum, f) => sum + f.months[i].absent, 0),
  }));

  return { year: y, group, byFactory };
}

module.exports = {
  createDailyRecord,
  updateDailyRecord,
  deleteDailyRecord,
  deleteResignedEmployee,
  rejoinResignedEmployee,
  cancelRejoinedEmployee,
  listDailyRecords,
  findWeekForDate,
  getCadreTrend,
  getPreviousDailyRecord,
  // Used by scripts/reconcile-resigned.js to re-derive an entry after its resigned counts change.
  computeDerived,
  rowsFor,
  getRawPayloadForBatch,
  shiftResignedCounts,
  rechainFactory,
  CARDER_MODELS,
};
