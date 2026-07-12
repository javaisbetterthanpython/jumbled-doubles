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

  // Can `slots` be filled exactly from `pairs` pair-units and `singles`
  // single-units? (Pairs only fill even amounts.)
  const canFill = (slots: number, pairs: number, singles: number): boolean =>
    slots === 0 ||
    (slots <= 2 * pairs + singles && (slots % 2 === 0 || singles >= 1));

  const sitting: Unit[] = [];
  const activeUnits: Unit[] = [];
  let index = 0;
  while (index < ordered.length) {
    // Walk one fairness tier (equal sit-out count) at a time. When the tier
    // can fill the remaining slots exactly, a unit is only taken if the rest
    // of the tier can still complete the fill — otherwise a random tied
    // single could crowd out an equally-owed pair and force a player from a
    // higher tier to sit (a fairness violation). Tiers that cannot complete
    // the fill are drained greedily and the walk dips into the next tier.
    const tierCount = sitOutPolicy.unitSitOutCount(ordered[index], stats);
    const tier: Unit[] = [];
    while (
      index < ordered.length &&
      sitOutPolicy.unitSitOutCount(ordered[index], stats) === tierCount
    ) {
      tier.push(ordered[index]);
      index += 1;
    }
    let pairsLeft = tier.filter((unit) => unit.members.length === 2).length;
    let singlesLeft = tier.length - pairsLeft;
    const tierCanFill = canFill(remaining, pairsLeft, singlesLeft);
    for (const unit of tier) {
      const size = unit.members.length;
      const pairsAfter = pairsLeft - (size === 2 ? 1 : 0);
      const singlesAfter = singlesLeft - (size === 1 ? 1 : 0);
      const take =
        size <= remaining &&
        (!tierCanFill || canFill(remaining - size, pairsAfter, singlesAfter));
      if (take) {
        sitting.push(unit);
        remaining -= size;
      } else {
        activeUnits.push(unit);
      }
      pairsLeft = pairsAfter;
      singlesLeft = singlesAfter;
    }
  }

  return {
    sitOuts: [...volunteerUnits, ...sitting]
      .flatMap((unit) => unit.members)
      .sort(),
    activeUnits,
  };
}
