import {
  partnerOf,
  removeIndexFromPairs,
  sanitizePairs,
  syncPairSelection,
  togglePairLink,
} from "../src/pairs";
import { Team } from "../src/matching/types";

describe("sanitizePairs()", () => {
  test("drops missing members, self pairs, and double membership", () => {
    const pairs: Team[] = [
      ["a", "b"],
      ["c", "gone"],
      ["d", "d"],
      ["b", "e"], // b already paired with a
      ["e", "f"],
    ];
    expect(sanitizePairs(pairs, ["a", "b", "c", "d", "e", "f"])).toEqual([
      ["a", "b"],
      ["e", "f"],
    ]);
  });
});

describe("partnerOf()", () => {
  const pairs: Team[] = [["a", "b"]];
  test("finds partner in either position", () => {
    expect(partnerOf("a", pairs)).toBe("b");
    expect(partnerOf("b", pairs)).toBe("a");
    expect(partnerOf("c", pairs)).toBeUndefined();
  });
});

describe("togglePairLink()", () => {
  test("full linking flow", () => {
    // Start linking a.
    let state = togglePairLink<string>([], null, "a");
    expect(state).toEqual({ pairs: [], linking: "a" });
    // Clicking a again cancels.
    expect(togglePairLink(state.pairs, state.linking, "a")).toEqual({
      pairs: [],
      linking: null,
    });
    // Complete a pair with b.
    state = togglePairLink(state.pairs, state.linking, "b");
    expect(state).toEqual({ pairs: [["a", "b"]], linking: null });
    // Clicking a paired member breaks the pair.
    expect(togglePairLink(state.pairs, null, "b")).toEqual({
      pairs: [],
      linking: null,
    });
  });

  test("works with indices", () => {
    const { pairs } = togglePairLink<number>([], 0, 3);
    expect(pairs).toEqual([[0, 3]]);
  });
});

describe("removeIndexFromPairs()", () => {
  test("removes affected pair and shifts higher indices", () => {
    expect(
      removeIndexFromPairs(
        [
          [0, 4],
          [2, 5],
        ],
        4
      )
    ).toEqual([[2, 4]]);
  });
});

describe("syncPairSelection()", () => {
  const pairs: Team[] = [["a", "b"]];
  test("checking a paired player adds the partner", () => {
    expect(syncPairSelection([], ["a"], pairs).sort()).toEqual(["a", "b"]);
  });
  test("unchecking a paired player removes the partner", () => {
    expect(syncPairSelection(["a", "b"], ["b"], pairs)).toEqual([]);
  });
  test("unpaired players are unaffected", () => {
    expect(syncPairSelection(["c"], ["c", "d"], pairs).sort()).toEqual([
      "c",
      "d",
    ]);
  });
});
