/**
 * Minimum-weight perfect matching on an even-sized set of items.
 *
 * Exact branch-and-bound for small inputs (players on a night of open play,
 * teams across courts), falling back to greedy-with-restarts + 2-opt beyond
 * that. Ties are broken randomly throughout so that regenerating a round can
 * produce different, equally good answers.
 */

/** Fisher-Yates shuffle (returns a copy). */
export function shuffle<T>(input: T[]): T[] {
  const array = [...input];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Exact search is used up to this many items: (15)!! = 2,027,025 matchings.
 * Measured note: raising this to 20 makes 20-player sessions WORSE at the
 * 19-round frontier (deterministic optima reduce candidate diversity, so the
 * loop explores fewer distinct zero-repeat matchings) and ~6× slower — the
 * stochastic path's random restarts are a feature there, not a fallback.
 */
const EXACT_LIMIT = 16;
/** Safety cap on branch-and-bound nodes (adversarial cost surfaces only). */
const NODE_CAP = 200_000;
/** Restarts for the stochastic fallback. */
const RESTARTS = 8;
/** Cost improvements smaller than this are considered ties. */
const EPSILON = 1e-9;

export function minWeightMatching<T>(
  items: T[],
  cost: (a: T, b: T) => number
): [T, T][] {
  const n = items.length;
  if (n === 0) return [];
  if (n % 2 !== 0) {
    throw new Error(`minWeightMatching requires an even count, got ${n}`);
  }

  // Symmetric cost matrix, each unordered pair evaluated once.
  const c: number[][] = items.map(() => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      c[i][j] = c[j][i] = cost(items[i], items[j]);
    }
  }

  const partner =
    n <= EXACT_LIMIT ? exactMatching(c, n) : stochasticMatching(c, n);

  const pairs: [T, T][] = [];
  for (let i = 0; i < n; i++) {
    if (partner[i] > i) pairs.push([items[i], items[partner[i]]]);
  }
  return pairs;
}

/**
 * Branch and bound over all perfect matchings. Children are visited
 * cheapest-first (random among ties), so the first full descent is the greedy
 * matching and every branch that cannot beat the best-so-far is pruned. When
 * a zero-cost matching exists, this finds one almost immediately.
 */
function exactMatching(c: number[][], n: number): number[] {
  const partner = new Array<number>(n).fill(-1);
  // Random tie-break weights, fixed for the duration of one search.
  const tieBreak = c.map((row) => row.map(() => Math.random()));

  let best = Infinity;
  let bestPartner: number[] | null = null;
  let nodes = 0;

  const descend = (total: number) => {
    if (total >= best || nodes > NODE_CAP) return;
    nodes += 1;
    const i = partner.indexOf(-1);
    if (i === -1) {
      best = total;
      bestPartner = [...partner];
      return;
    }
    const candidates: number[] = [];
    for (let j = i + 1; j < n; j++) {
      if (partner[j] === -1) candidates.push(j);
    }
    candidates.sort((a, b) => c[i][a] - c[i][b] || tieBreak[i][a] - tieBreak[i][b]);
    for (const j of candidates) {
      partner[i] = j;
      partner[j] = i;
      descend(total + c[i][j]);
      partner[i] = -1;
      partner[j] = -1;
    }
  };
  descend(0);

  const result = bestPartner!;
  if (nodes > NODE_CAP) twoOpt(result, c);
  return result;
}

/** Greedy matchings from random orders, each polished with 2-opt swaps. */
function stochasticMatching(c: number[][], n: number): number[] {
  let bestTotal = Infinity;
  let bestPartner: number[] = [];

  for (let restart = 0; restart < RESTARTS; restart++) {
    const order = shuffle(Array.from({ length: n }, (_, i) => i));
    const partner = new Array<number>(n).fill(-1);
    for (const i of order) {
      if (partner[i] !== -1) continue;
      let choice = -1;
      for (const j of order) {
        if (j === i || partner[j] !== -1) continue;
        if (choice === -1 || c[i][j] < c[i][choice] - EPSILON) choice = j;
      }
      partner[i] = choice;
      partner[choice] = i;
    }
    twoOpt(partner, c);

    let total = 0;
    for (let i = 0; i < n; i++) {
      if (partner[i] > i) total += c[i][partner[i]];
    }
    if (total < bestTotal) {
      bestTotal = total;
      bestPartner = partner;
    }
  }
  return bestPartner;
}

/**
 * Repeatedly try re-pairing every two pairs (a,b),(x,y) as (a,x)(b,y) or
 * (a,y)(b,x); apply strict improvements until a full sweep finds none.
 */
function twoOpt(partner: number[], c: number[][]): void {
  const n = partner.length;
  const MAX_SWEEPS = 50;
  for (let sweep = 0; sweep < MAX_SWEEPS; sweep++) {
    let improved = false;
    for (let a = 0; a < n; a++) {
      let b = partner[a];
      if (b < a) continue;
      for (let x = a + 1; x < n; x++) {
        const y = partner[x];
        if (y < x || x === b) continue;
        const current = c[a][b] + c[x][y];
        const swapAX = c[a][x] + c[b][y];
        const swapAY = c[a][y] + c[b][x];
        if (swapAX < current - EPSILON && swapAX <= swapAY) {
          partner[a] = x;
          partner[x] = a;
          partner[b] = y;
          partner[y] = b;
          improved = true;
          b = x;
        } else if (swapAY < current - EPSILON) {
          partner[a] = y;
          partner[y] = a;
          partner[b] = x;
          partner[x] = b;
          improved = true;
          b = y;
        }
      }
    }
    if (!improved) return;
  }
}
