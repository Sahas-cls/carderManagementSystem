import { WEEK_RANGES } from "../constants/cadre";

// Never let a derived value go negative - mirrors the original app's num().
const n = (v) => Math.max(0, Number(v) || 0);

export const EMPTY_CADRE_FORM = {
  factory: "",
  date: "",
  week: "",
  plannedMO: 0,
  plannedTMO: 0,
  allocActualMO: "",
  allocActualTMO: "",
  newRecMO: 0,
  newRecTMO: 0,
  resignedMO: 0,
  resignedTMO: 0,
  absentMO: 0,
  absentTMO: 0,
  tcPlanned: 0,
  tcAllocated: 0,
  tcRecruit: 0,
  tcResigned: 0,
  tcTransfer: 0,
  tcActual: 0,
  tcAbsent: 0,
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
  const rmo = n(form.resignedMO);
  const rtmo = n(form.resignedTMO);
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

  const tcPresent = Math.max(0, n(form.tcActual) - n(form.tcAbsent));

  return {
    plannedTotal,
    allocActualTotal,
    shortageMO,
    shortageTMO,
    shortageTotal,
    newRecTotal,
    resignedTotal,
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
    tcPresent,
  };
}

/** Build the saved-record shape (short keys) from the form + its totals. */
export function buildRecord(form, totals) {
  return {
    factory: form.factory,
    date: form.date,
    week: form.week,
    pmo: n(form.plannedMO),
    ptmo: n(form.plannedTMO),
    pt: totals.plannedTotal,
    amo: n(form.allocActualMO),
    atmo: n(form.allocActualTMO),
    at: totals.allocActualTotal,
    smo: totals.shortageMO,
    stmo: totals.shortageTMO,
    st: totals.shortageTotal,
    nmo: n(form.newRecMO),
    ntmo: n(form.newRecTMO),
    nt: totals.newRecTotal,
    rmo: n(form.resignedMO),
    rtmo: n(form.resignedTMO),
    rt: totals.resignedTotal,
    netmo: totals.netMO,
    netto: totals.netTMO,
    nett: totals.netTotal,
    cmo: totals.currentMO,
    ctmo: totals.currentTMO,
    ct: totals.currentTotal,
    abmo: n(form.absentMO),
    abtmo: n(form.absentTMO),
    abt: totals.absentTotal,
    prmo: totals.presentMO,
    prtmo: totals.presentTMO,
    prt: totals.presentTotal,
    tcp: n(form.tcPlanned),
    tca: n(form.tcAllocated),
    tcr: n(form.tcRecruit),
    tcs: n(form.tcResigned),
    tct: n(form.tcTransfer),
    tactual: n(form.tcActual),
    tcab: n(form.tcAbsent),
    tcpresent: totals.tcPresent,
  };
}

/** Reverse of buildRecord - used to load a saved record back into the form for editing. */
export function recordToForm(record) {
  return {
    factory: record.factory || "",
    date: record.date || "",
    week: record.week || "",
    plannedMO: record.pmo || 0,
    plannedTMO: record.ptmo || 0,
    allocActualMO: record.amo ?? 0,
    allocActualTMO: record.atmo ?? 0,
    newRecMO: record.nmo || 0,
    newRecTMO: record.ntmo || 0,
    resignedMO: record.rmo || 0,
    resignedTMO: record.rtmo || 0,
    absentMO: record.abmo || 0,
    absentTMO: record.abtmo || 0,
    tcPlanned: record.tcp || 0,
    tcAllocated: record.tca || 0,
    tcRecruit: record.tcr || 0,
    tcResigned: record.tcs || 0,
    tcTransfer: record.tct || 0,
    tcActual: record.tactual || 0,
    tcAbsent: record.tcab || 0,
  };
}

/** Look up the week label whose date range contains the given yyyy-mm-dd date string. */
export function matchWeekForDate(dateStr) {
  const match = WEEK_RANGES.find(([start, end]) => dateStr >= start && dateStr <= end);
  return match ? match[2] : "";
}
