import { minWeightMatching } from "../src/matching/matching";

/** All perfect matchings of the given items (test-only brute force). */
function bruteForceBest(
  n: number,
  cost: (a: number, b: number) => number
): number {
  let best = Infinity;
  const items = Array.from({ length: n }, (_, i) => i);
  const recurse = (remaining: number[], total: number) => {
    if (!remaining.length) {
      best = Math.min(best, total);
      return;
    }
    const [first, ...rest] = remaining;
    for (let i = 0; i < rest.length; i++) {
      recurse(
        rest.filter((_, j) => j !== i),
        total + cost(first, rest[i])
      );
    }
  };
  recurse(items, 0);
  return best;
}

const matchingTotal = (pairs: [number, number][], cost: (a: number, b: number) => number) =>
  pairs.reduce((sum, [a, b]) => sum + cost(a, b), 0);

describe("minWeightMatching()", () => {
  test("rejects odd item counts", () => {
    expect(() => minWeightMatching([1, 2, 3], () => 0)).toThrow();
  });

  test("empty input", () => {
    expect(minWeightMatching([], () => 0)).toEqual([]);
  });

  test("finds a planted zero-cost matching", () => {
    // Secret pairing: (0,1)(2,3)...; every other edge costs 1000.
    const items = Array.from({ length: 12 }, (_, i) => i);
    const cost = (a: number, b: number) =>
      Math.floor(a / 2) === Math.floor(b / 2) ? 0 : 1000;
    for (let attempt = 0; attempt < 20; attempt++) {
      const pairs = minWeightMatching(items, cost);
      expect(matchingTotal(pairs, cost)).toBe(0);
    }
  });

  test("matches brute force on random instances (exact path)", () => {
    for (let instance = 0; instance < 25; instance++) {
      const n = 8;
      const matrix = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => Math.floor(Math.random() * 100))
      );
      const cost = (a: number, b: number) =>
        Math.min(matrix[a][b], matrix[b][a]);
      const items = Array.from({ length: n }, (_, i) => i);
      const pairs = minWeightMatching(items, cost);
      expect(matchingTotal(pairs, cost)).toBe(bruteForceBest(n, cost));
    }
  });

  test("returns a valid perfect matching on large inputs (stochastic path)", () => {
    const items = Array.from({ length: 24 }, (_, i) => i);
    const cost = (a: number, b: number) => ((a * 7 + b * 13) % 29) + 1;
    const pairs = minWeightMatching(items, cost);
    expect(pairs).toHaveLength(12);
    const seen = new Set(pairs.flat());
    expect(seen.size).toBe(24);
  });

  test("stochastic path still lands planted zero-cost matchings", () => {
    const items = Array.from({ length: 24 }, (_, i) => i);
    const cost = (a: number, b: number) =>
      Math.floor(a / 2) === Math.floor(b / 2) ? 0 : 1000;
    // 2-opt repairs greedy mistakes on this cost surface; give it a few tries.
    const totals = Array.from({ length: 5 }, () =>
      matchingTotal(minWeightMatching(items, cost), cost)
    );
    expect(Math.min(...totals)).toBe(0);
  });
});
