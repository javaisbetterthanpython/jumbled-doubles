/** @jest-environment jsdom */
import { defaultState, shufflerReducer, State } from "../src/useShuffler";
import { Round, Team } from "../src/matching/types";

const baseState = (overrides: Partial<State> = {}): State => ({
  ...defaultState,
  players: ["id-a", "id-b", "id-c", "id-d"],
  playersById: {
    "id-a": { id: "id-a", name: "Alice" },
    "id-b": { id: "id-b", name: "Bob" },
    "id-c": { id: "id-c", name: "Cleo" },
    "id-d": { id: "id-d", name: "Dan" },
  },
  ...overrides,
});

describe("shufflerReducer", () => {
  describe("rename-player", () => {
    test("renames and preserves id, roster, and rounds", () => {
      const rounds: Round[] = [
        { matches: [[["id-a", "id-b"], ["id-c", "id-d"]]], sitOuts: [] },
      ];
      const state = baseState({ rounds });
      const next = shufflerReducer(state, {
        type: "rename-player",
        payload: { id: "id-a", name: "  Alicia " },
      });
      expect(next.playersById["id-a"].name).toBe("Alicia");
      expect(next.playersById["id-a"].id).toBe("id-a");
      expect(next.players).toEqual(state.players);
      expect(next.rounds).toEqual(rounds);
    });

    test("ignores empty names and unknown ids", () => {
      const state = baseState();
      expect(
        shufflerReducer(state, {
          type: "rename-player",
          payload: { id: "id-a", name: "   " },
        })
      ).toBe(state);
      expect(
        shufflerReducer(state, {
          type: "rename-player",
          payload: { id: "nope", name: "X" },
        })
      ).toBe(state);
    });
  });

  describe("fixed pairs state", () => {
    test("new-game-start replaces pairs and resets rounds", () => {
      const pairs: Team[] = [["id-a", "id-b"]];
      const state = baseState({
        fixedPairs: [["id-c", "id-d"]],
        rounds: [{ matches: [], sitOuts: [] }],
      });
      const next = shufflerReducer(state, {
        type: "new-game-start",
        payload: {
          players: state.players,
          playersById: state.playersById,
          courts: 2,
          courtNames: [],
          fixedPairs: pairs,
        },
      });
      expect(next.fixedPairs).toEqual(pairs);
      expect(next.rounds).toEqual([]);
      expect(next.generating).toBe(true);
    });

    test("start-generation keeps pairs unless overridden", () => {
      const state = baseState({ fixedPairs: [["id-a", "id-b"]] });
      const kept = shufflerReducer(state, {
        type: "start-generation",
        payload: { volunteerSitouts: [] },
      });
      expect(kept.fixedPairs).toEqual([["id-a", "id-b"]]);
      const overridden = shufflerReducer(state, {
        type: "start-generation",
        payload: { volunteerSitouts: [], fixedPairs: [] },
      });
      expect(overridden.fixedPairs).toEqual([]);
    });
  });

  describe("generation failures", () => {
    test.each(["new-game-fail", "new-round-fail"] as const)(
      "%s resets generating",
      (type) => {
        const state = baseState({ generating: true });
        const next = shufflerReducer(state, {
          type,
          payload: { error: new Error("boom") },
        });
        expect(next.generating).toBe(false);
      }
    );
  });

  describe("load-from-cache backward compatibility", () => {
    afterEach(() => window.localStorage.clear());

    const legacyBlob = {
      players: ["id-a", "id-b", "id-c", "id-d"],
      courts: 2,
      courtNames: [],
      rounds: [],
      volunteerSitoutsByRound: [],
      playersById: baseState().playersById,
    };

    test("legacy cache without fixedPairs loads with empty pairs", () => {
      window.localStorage.setItem("state", JSON.stringify(legacyBlob));
      const next = shufflerReducer(defaultState, {
        type: "load-from-cache",
        payload: null,
      });
      expect(next.cacheLoaded).toBe(true);
      expect(next.players).toEqual(legacyBlob.players);
      expect(next.fixedPairs).toEqual([]);
    });

    test("stale pairs referencing removed players are dropped", () => {
      window.localStorage.setItem(
        "state",
        JSON.stringify({
          ...legacyBlob,
          fixedPairs: [
            ["id-a", "id-b"],
            ["id-c", "id-gone"],
          ],
        })
      );
      const next = shufflerReducer(defaultState, {
        type: "load-from-cache",
        payload: null,
      });
      expect(next.fixedPairs).toEqual([["id-a", "id-b"]]);
    });
  });
});
