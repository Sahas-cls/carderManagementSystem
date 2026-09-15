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
  // Actual Allocated is derived, never trusted from the client (same reason
  // as plannedMO/TMO) - opening balance (tcAllocated, itself carried over
  // from the previous entry's Actual Allocated - see getPreviousDailyRecord)
  // plus new recruits, minus resigned/transferred out.
  const tcActual = Math.max(0, tcAllocated + tcRecruit - (tcResigned + tcTransfer));
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
    departmentId: e.departmentId,
    sectionId: e.sectionId,
    dateOfJoin: e.dateOfJoin,
    dateOfResign: e.dateOfResign,
    resignationReasonId: e.resignationReasonId,
    isMo: e.isMo,
    // Only meaningful on a Transfer row (see Employee.promotedToMo) -
    // carried along on resignedEmployees rows too, harmless (always null).
    promotedToMo: e.promotedToMo,
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
 * PlannedCarder is queried first (every batch has exactly one row there) so
 * both other tables are read from that one canonical batchId, rather than
 * each independently picking "latest date" and risking two different
 * batches on a day with more than one entry.
 */
async function getPreviousDailyRecord({ factoryId, beforeDate }) {
  const latestBatch = await PlannedCarder.findOne({
    where: { factoryId, date: { [Op.lt]: beforeDate } },
    order: [["date", "DESC"], ["createdAt", "DESC"]],
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
        actualAllocated: d.tcActual,
        absent: d.tcAbsent,
        present: d.tcPresent,
      },
      { transaction }
    );

    await employeeService.syncResignedEmployees(payload.resignedEmployees, batchId, transaction, false);
    await employeeService.syncResignedEmployees(payload.transferEmployees, batchId, transaction, true);

    return buildFlatRecord({
      batchId,
      date,
      week,
      factory,
      d,
      createdAt: tc.createdAt,
      resignedEmployees: payload.resignedEmployees,
      transferEmployees: payload.transferEmployees,
    });
  });
}

/**
 * The actual "update every row belonging to a batch" work, factored out of
 * updateDailyRecord so deleteResignedEmployee below can run it inside its
 * own transaction (alongside the employee hard-delete) instead of nesting a
 * second sequelize.transaction() call.
 */
async function performUpdate(batchId, payload, transaction) {
  const { factoryId, date } = payload;

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
      actualAllocated: d.tcActual,
      absent: d.tcAbsent,
      present: d.tcPresent,
    },
    { where: { batchId }, transaction }
  );

  await employeeService.syncResignedEmployees(payload.resignedEmployees, batchId, transaction, false);
  await employeeService.syncResignedEmployees(payload.transferEmployees, batchId, transaction, true);

  return buildFlatRecord({
    batchId,
    date,
    week,
    factory,
    d,
    createdAt: existing.createdAt,
    resignedEmployees: payload.resignedEmployees,
    transferEmployees: payload.transferEmployees,
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
    tcAbsent: tc?.absent ?? 0,
    resignedEmployees: employees.filter((e) => !e.isTransfer).map(flattenExitEmployee),
    transferEmployees: employees.filter((e) => e.isTransfer).map(flattenExitEmployee),
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
    const { isMo, isTransfer } = await employeeService.deleteResignedEmployee(epf, batchId, transaction);

    const payload = { ...raw };
    if (isTransfer) {
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
 * Reactivates one Resigned/Terminated or Transfer employee - backs the
 * per-employee Rejoin button in ResignedEmployeesListModal.jsx. Unlike
 * deleteResignedEmployee, the Employee row survives
 * (employeeService.rejoinEmployee just clears its exit fields and unlinks it
 * from this batch): this batch's Resigned or Transfer MO/TMO count (based on
 * the row's isTransfer flag) moves down by one and its Rejoined MO/TMO count
 * moves up by one (same type - MO stays MO, TMO stays TMO) regardless of
 * which tile it came from - anyone rejoining the cadre counts as Rejoined.
 * The whole batch is then re-persisted so everything derived from those
 * counts (Net, Allocated_Current, Present) is recomputed to match, in the
 * same transaction.
 */
async function rejoinResignedEmployee(batchId, epf) {
  return sequelize.transaction(async (transaction) => {
    const raw = await getRawPayloadForBatch(batchId, transaction);
    const { isMo, isTransfer } = await employeeService.rejoinEmployee(epf, batchId, transaction);

    const payload = {
      ...raw,
      rejoinedMO: isMo ? raw.rejoinedMO + 1 : raw.rejoinedMO,
      rejoinedTMO: !isMo ? raw.rejoinedTMO + 1 : raw.rejoinedTMO,
    };
    if (isTransfer) {
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
    await PlannedCarder.destroy({ where: { batchId }, transaction });
    await TrainingCenter.destroy({ where: { batchId }, transaction });
    await employeeService.unlinkBatch(batchId, transaction);
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
  employeeRows.forEach((row) => {
    const byBatch = row.isTransfer ? transferEmployeesByBatch : employeesByBatch;
    if (!byBatch.has(row.batchId)) byBatch.set(row.batchId, []);
    byBatch.get(row.batchId).push(row);
  });

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
 *  - budget/allocated mirror "Cadre Trend" (AVERAGE CADRE STATUS TREND_MO
 *    & TMO): Budget is resolved the same way Daily Data Entry does
 *    (whichever Budget was active for the factory on each day, via
 *    PlannedCarder's budget join); Allocated is the Allocated Actual total
 *    entered that day. Both are *averaged* across every daily entry within
 *    the month, matching the sheet's "AVERAGE".
 *  - recruitment/resigned mirror "FACTORY WISE RECRUITMENT & RESIGN TREND":
 *    each daily entry's New Recruit / Resigned total is a count of people
 *    that day, so these are *summed* (not averaged) across the month.
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

  const [factories, plannedRows, allocatedRows, newRecRows, resignedRows, absentRows] = await Promise.all([
    Factory.findAll({ attributes: ["id", "factoryName"] }),
    // Budgets are soft-deleted (paranoid) - see listDailyRecords for why
    // this include bypasses that default.
    PlannedCarder.findAll({ where, include: [{ model: Budget, as: "budget", paranoid: false }] }),
    AllocatedActualCarder.findAll({ where }),
    NewRecruitCarder.findAll({ where }),
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
        allocSum: 0,
        allocCount: 0,
        recruitment: 0,
        resigned: 0,
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
    b.allocSum += row.total;
    b.allocCount += 1;
  });
  newRecRows.forEach((row) => {
    bucket(row.factoryId, monthKey(row.date)).recruitment += row.total;
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
        allocated: b && b.allocCount ? Math.round(b.allocSum / b.allocCount) : 0,
        recruitment: b?.recruitment ?? 0,
        resigned: b?.resigned ?? 0,
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
  listDailyRecords,
  findWeekForDate,
  getCadreTrend,
  getPreviousDailyRecord,
};
