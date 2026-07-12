# Jumbled Doubles

Fair, social doubles shuffling for pickleball, tennis, badminton, and any
other sport played in teams of two — live at
**[jumbleddoubles.ca](https://jumbleddoubles.ca)**.

Enter your players and courts, and Jumbled Doubles builds each round so that:

- **Partners rotate**: you never partner the same person twice until you've
  partnered everyone available (exact minimum-cost matching, not luck).
- **Fixed pairs**: link two players (🔗) and they play as partners all
  session — and sit out together.
- **Sit-outs are fair**: nobody sits a second time before everyone has sat
  once. Volunteers can sit on request.
- **Opponents vary**: exact rematches (same four players, same teams) are
  avoided, and who-you-face spreads out.
- **Live edits**: add, remove, rename (tap any name), or pair players
  mid-session; adjust courts; redo the current round any time.

Everything runs in your browser (PWA, works offline); session state lives in
localStorage. No accounts, no server.

## Development

Requires Node 18+ (Yarn 3 is vendored via `packageManager`).

```sh
yarn install
yarn dev       # http://localhost:3000
yarn test:ci   # full test suite, incl. shuffle-quality simulations
yarn build     # production build
```

The matching engine lives in `src/matching/`:

- `generate.ts` — candidate-round loop (fair sit-outs → partner matching →
  opponent matching, scored lexicographically)
- `matching.ts` — exact branch-and-bound / stochastic min-weight perfect
  matching
- `cost.ts` — cost functions and the round-quality tuple
- `stats.ts` — session history digests
- `sitouts.ts`, `fixedPairs.ts` — hard sit-out fairness and the
  pairs-sit-together policy

`test/simulation.spec.tsx` measures shuffle quality (repeat partners, exact
rematches, sit-out fairness) and documents the before/after numbers versus the
upstream algorithm.

## Deployment

Deployed on Vercel; pushes to `main` go live at jumbleddoubles.ca.

## Credits

Based on [pickleball-shuffler](https://github.com/morinted/pickleball-shuffler)
by Ted Morin, released under the MIT License — thank you! The matching
algorithm has since been rewritten and fixed pairs / live rename added. See
[LICENSE](LICENSE).
