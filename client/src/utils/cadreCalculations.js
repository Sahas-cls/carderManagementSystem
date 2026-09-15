// Never let a derived value go negative - mirrors the original app's num().
const n = (v) => Math.max(0, Number(v) || 0);

function addDaysToDateStr(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Today's date as yyyy-mm-dd, in the browser's local timezone (not UTC - avoids an off-by-one for the date picker's default value). */
export function todayDateStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const EMPTY_CADRE_FORM = {
  factoryId: "",
  date: "",
  plannedMO: 0,
  plannedTMO: 0,
  allocActualMO: "",
  allocActualTMO: "",
  newRecMO: 0,
  newRecTMO: 0,
  rejoinedMO: 0,
  rejoinedTMO: 0,
  // Released from Tr. Cen.'s MO/TMO isn't typed in directly - it's set by the
  // "Transfer to Pro Line" split popup in CadreDetailsCard.jsx (see
  // handleSaveModal there) and just carried on the form like any other field.
  releasedMO: 0,
  releasedTMO: 0,
  resignedMO: 0,
  resignedTMO: 0,
  transferMO: 0,
  transferTMO: 0,
  absentMO: 0,
  absentTMO: 0,
  tcPlanned: 0,
  // Carried over from the previous entry's Actual Allocated on page load
  // (see DailyEntryPage.jsx's prefill effect) - Actual Allocated itself is
  // no longer a raw field, it's derived below in computeTotals.
  tcAllocated: 0,
  tcRecruit: 0,
  tcResigned: 0,
  tcTransfer: 0,
  tcAbsent: 0,
  // Details for each Resigned/Terminated employee (see ResignedEmployeesModal
  // in CadreDetailsCard.jsx), one row per resignedMO+resignedTMO count.
  // Persisted with the record so re-opening it for editing recovers the
  // exact rows instead of losing them to component state.
  resignedEmployees: [],
  // Same, for the Transfer tile (e.g. a promotion that moves someone off
  // this MO/TMO carder) - one row per transferMO+transferTMO count.
  transferEmployees: [],
};

/**
 * Recompute every read-only/derived field on the Daily Data Entry form
 * from the raw editable inputs. Pure function so it can run on every
 * keystroke without side effects.
 */
export function computeTotals(form) {
  const pmo = n(form.plannedMO);
  const ptmo = n(form.plannedTMO);
  const amo = n(form.allocActualMO);
  const atmo = n(form.allocActualTMO);
  const nmo = n(form.newRecMO);
  const ntmo = n(form.newRecTMO);
  const rjmo = n(form.rejoinedMO);
  const rjtmo = n(form.rejoinedTMO);
  const relmo = n(form.releasedMO);
  const reltmo = n(form.releasedTMO);
  const rmo = n(form.resignedMO);
  const rtmo = n(form.resignedTMO);
  const tfmo = n(form.transferMO);
  const tftmo = n(form.transferTMO);
  const transferEmployees = form.transferEmployees || [];
  // Each Transfer row plays out one of two ways: an originally-TMO row
  // marked "promoted" stays in this carder reclassified as MO (MO +1,
  // TMO -1); anyone else on the list leaves this carder entirely (their own
  // type -1). Mirrors dailyCadreService.computeDerived server-side
  // (authoritative) - computed from the actual rows, not the raw tfmo/tftmo
  // counts above, so it stays right as rows are added/removed.
  const transferPromotedMO = transferEmployees.filter(
    (e) => e.isMo === false && e.promotedToMo,
  ).length;
  const transferLeavingMO = transferEmployees.filter((e) => e.isMo === true).length;
  const transferLeavingTMO = transferEmployees.filter(
    (e) => e.isMo === false && !e.promotedToMo,
  ).length;
  const abmo = n(form.absentMO);
  const abtmo = n(form.absentTMO);

  // Shortage only makes sense once an actual allocation has been entered.
  const hasAllocActual = form.allocActualMO !== "" || form.allocActualTMO !== "";

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
  // (transferLeavingMO/TMO, not tfmo/tftmo - see above). Mirrors
  // dailyCadreService.computeDerived server-side (authoritative).
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

  // Actual Allocated is derived, not typed in - opening balance (tcAllocated,
  // itself carried over from the previous entry - see DailyEntryPage.jsx's
  // prefill effect) plus new recruits, minus resigned/transferred out.
  // Mirrors dailyCadreService.computeDerived server-side (authoritative).
  const tcActual = Math.max(
    0,
    n(form.tcAllocated) + n(form.tcRecruit) - (n(form.tcResigned) + n(form.tcTransfer))
  );
  const tcPresent = Math.max(0, tcActual - n(form.tcAbsent));

  return {
    plannedTotal,
    allocActualTotal,
    shortageMO,
    shortageTMO,
    shortageTotal,
    newRecTotal,
    rejoinedTotal,
    releasedTotal,
    resignedTotal,
    transferTotal,
    netMO,
    netTMO,
    netTotal,
    currentMO,
    currentTMO,
    currentTotal,
    absentTotal,
    presentMO,
    presentTMO,
    presentTotal,
    tcActual,
    tcPresent,
  };
}

/**
 * Builds the API payload from the form's raw inputs (the backend recomputes
 * every derived MO/TMO/total itself - see dailyCadreService.computeDerived).
 * allocActualMO/TMO are left out entirely when untouched, so the backend can
 * tell "left blank" apart from "entered as 0" for the Shortage calculation.
 *
 * plannedMO/plannedTMO are deliberately NOT sent - they mirror Budget Master
 * (see useActiveBudget), not something typed into this form, so the backend
 * resolves them itself from whichever Budget is active for the factory
 * (dailyCadreService.resolvePlannedCounts) rather than trusting this copy.
 * tcPlanned is likewise NOT sent - it mirrors TC Budget Master (see
 * useActiveTcBudget) and is resolved server-side the same way
 * (dailyCadreService.resolveTcPlanned).
 */
export function buildPayload(form) {
  const payload = {
    factoryId: Number(form.factoryId),
    date: form.date,
    newRecMO: n(form.newRecMO),
    newRecTMO: n(form.newRecTMO),
    rejoinedMO: n(form.rejoinedMO),
    rejoinedTMO: n(form.rejoinedTMO),
    releasedMO: n(form.releasedMO),
    releasedTMO: n(form.releasedTMO),
    resignedMO: n(form.resignedMO),
    resignedTMO: n(form.resignedTMO),
    transferMO: n(form.transferMO),
    transferTMO: n(form.transferTMO),
    absentMO: n(form.absentMO),
    absentTMO: n(form.absentTMO),
    tcAllocated: n(form.tcAllocated),
    tcRecruit: n(form.tcRecruit),
    tcResigned: n(form.tcResigned),
    tcTransfer: n(form.tcTransfer),
    tcAbsent: n(form.tcAbsent),
    resignedEmployees: form.resignedEmployees || [],
    transferEmployees: form.transferEmployees || [],
  };
  if (form.allocActualMO !== "") payload.allocActualMO = n(form.allocActualMO);
  if (form.allocActualTMO !== "") payload.allocActualTMO = n(form.allocActualTMO);
  return payload;
}

/** Reverse of buildPayload - used to load a saved record back into the form for editing. */
export function recordToForm(record) {
  return {
    factoryId: record.factoryId ?? "",
    date: record.date || "",
    plannedMO: record.pmo || 0,
    plannedTMO: record.ptmo || 0,
    allocActualMO: record.amo ?? 0,
    allocActualTMO: record.atmo ?? 0,
    newRecMO: record.nmo || 0,
    newRecTMO: record.ntmo || 0,
    rejoinedMO: record.rjmo || 0,
    rejoinedTMO: record.rjtmo || 0,
    releasedMO: record.relmo || 0,
    releasedTMO: record.reltmo || 0,
    resignedMO: record.rmo || 0,
    resignedTMO: record.rtmo || 0,
    transferMO: record.tfmo || 0,
    transferTMO: record.tftmo || 0,
    absentMO: record.abmo || 0,
    absentTMO: record.abtmo || 0,
    tcPlanned: record.tcp || 0,
    tcAllocated: record.tca || 0,
    tcRecruit: record.tcr || 0,
    tcResigned: record.tcs || 0,
    tcTransfer: record.tct || 0,
    tcAbsent: record.tcab || 0,
    resignedEmployees: record.resignedEmployees || [],
    transferEmployees: record.transferEmployees || [],
  };
}

/**
 * Finds the Week (as configured in Week Master) whose 7-day range contains
 * the given yyyy-mm-dd date string. `weeks` is the list from GET /api/weeks
 * ({ id, week }). This is only a client-side preview - the backend resolves
 * the same way and is authoritative (see server/src/services/dailyCadreService.js).
 */
export function matchWeekForDate(dateStr, weeks) {
  return weeks.find((w) => dateStr >= w.week && dateStr <= addDaysToDateStr(w.week, 6)) || null;
}
