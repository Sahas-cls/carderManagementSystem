"use strict";
/**
 * Repairs one factory's Daily Data Entries whose Allocated_Actual drifted away
 * from the previous day's Allocated_Current (an earlier entry was edited and
 * the later ones kept the old numbers). From --from onward, every entry's
 * Allocated_Actual (and TC Allocated) is reset to the previous entry's
 * Allocated_Current (TC Actual Allocated), and Shortage / Net /
 * Allocated_Current / Present / TC Actual Allocated / TC Present are
 * re-derived with the same computeDerived the app uses. The entry just before
 * --from is the trusted opening balance and is not touched. Safe to re-run.
 * Dry run by default; pass --apply to write.
 *
 *   node server/scripts/rechain-allocated.js --factory CAL --from 2026-09-10
 *   node server/scripts/rechain-allocated.js --factory CAL --from 2026-09-10 --apply
 */
const { Factory, sequelize } = require("../models");
const { rechainFactory } = require("../src/services/dailyCadreService");

const argOf = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const FACTORY_BY_CODE = { CAL: 3, GLL: 6, MGL: 4, CML: 5 };

async function main() {
  const apply = process.argv.includes("--apply");
  const code = argOf("factory", "").toUpperCase();
  const from = argOf("from", "");
  const factoryId = FACTORY_BY_CODE[code];
  if (!factoryId || !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    throw new Error("Usage: node rechain-allocated.js --factory CAL --from YYYY-MM-DD [--apply]");
  }
  const factory = await Factory.findByPk(factoryId);
  console.log(`Factory ${code} = #${factoryId} "${factory?.factoryName}", from ${from}${apply ? "" : " (DRY RUN)"}`);

  const t = await sequelize.transaction();
  try {
    const changes = await rechainFactory(factoryId, { fromDate: from, mode: "reset" }, t);
    const negative = changes.filter((c) => c.after.cmo < 0 || c.after.ctmo < 0);
    if (negative.length) {
      throw new Error(
        `Refusing to apply: Allocated_Current would go negative on ${negative.map((c) => c.date).join(", ")}. The balance just before ${from} is probably not the right opening one - check it first.`,
      );
    }
    for (const c of changes) {
      const { before: b, after: a } = c;
      console.log(
        `${c.date}  Actual MO/TMO ${b.amo}/${b.atmo} -> ${a.amo}/${a.atmo}   Current MO/TMO ${b.cmo}/${b.ctmo} -> ${a.cmo}/${a.ctmo}`,
      );
    }
    console.log(`\n${changes.length} entr${changes.length === 1 ? "y" : "ies"} ${apply ? "updated" : "would change"}.`);
    if (apply) await t.commit();
    else await t.rollback();
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
