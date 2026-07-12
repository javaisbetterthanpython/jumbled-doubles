import { sitOutPolicy, Unit } from "./fixedPairs";
import { shuffle } from "./matching";
import { Stats } from "./stats";
import { PlayerId } from "./types";

/**
 * Choose who sits out this round. Fairness is a hard constraint: units are
 * taken strictly in ascending order of sit-out count (uniformly random within
 * ties), so nobody sits a second time before everyone has sat once, and so
 * on. Fixed pairs sit as a unit; a pair is skipped when only one slot
 * remains (parity guarantees a single exists further down the order).
 *
 * Volunteers sit in addition to the required count, which is computed on the
 * non-volunteer pool (matching upstream semantics); a volunteer's fixed
 * partner sits with them.
 */
export function pickSitOuts(
  units: Unit[],
  stats: Stats,
  courts: number,
  volunteers: PlayerId[] = []
): { sitOuts: PlayerId[]; activeUnits: Unit[] } {
  const volunteerSet = new Set(volunteers);
  const volunteerUnits: Unit[] = [];
  const pool: Unit[] = [];
  for (const unit of units) {
    const volunteered =
      sitOutPolicy.volunteerPullsPartner &&
      unit.members.some((member) => volunteerSet.has(member));
    (volunteered ? volunteerUnits : pool).push(unit);
  }

  const poolSize = pool.reduce((sum, unit) => sum + unit.members.length, 0);
  const capacity = courts * 4;
  let remaining =
    poolSize > capacity ? poolSize - capacity : poolSize % 4;

  const ordered = shuffle(pool).sort(
    (a, b) =>
      sitOutPolicy.unitSitOutCount(a, stats) -
      sitOutPolicy.unitSitOutCount(b, stats)
  );

  const sitting: Unit[] = [];
  const activeUnits: Unit[] = [];
  for (const unit of ordered) {
    if (unit.members.length <= remaining) {
      sitting.push(unit);
      remaining -= unit.members.length;
    } else {
      activeUnits.push(unit);
    }
  }

  return {
    sitOuts: [...volunteerUnits, ...sitting]
      .flatMap((unit) => unit.members)
      .sort(),
    activeUnits,
  };
}
