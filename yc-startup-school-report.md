# Coding Session Report: Greenwich Park

Greenwich Park is a hyperlocal parking demand predictor for Greenwich Avenue in Greenwich, CT. It is live at parking.philipcamuto.com. It predicts how busy the Avenue will be at any day and hour by fusing a trained statistical model with six live real-time signals. This writeup covers the session where I took it from an empty repository to a deployed product, the engineering I did afterward to validate and harden the model, and the key decisions I drove along the way.

Stack: Next.js 16 (App Router, Turbopack), TypeScript, Drizzle ORM on Neon Postgres, deployed on Vercel with a GitHub Actions cron driving ingest, Vitest for the test suite.

## Empty repo to live product in one session

This was a long, dense build: well over a hundred file edits, around 145 commits, roughly 180 shell operations, and a test suite written alongside the code. I built it so the integrations were real from the start rather than mocked, and I held the architecture to a single pure scoring function, `computeDemand(input) -> output`, that runs identically for the live snapshot, every slot of the 4-hour forecast, and per-block scoring. That purity is deliberate: it makes the system deterministic and unit-testable, and it is why the suite is now over 220 tests. The score is the trained demand base plus a set of independent, individually-tested modifiers (weather, traffic, holidays, school calendar, events, transit), each clamped and composed in one place.

Six live sources feed it: weather (Open-Meteo), the CTDOT 511 incident feed, TomTom traffic-flow segment data, daily Metro-North ridership (Socrata), real-time New Haven Line service alerts, and aggregated special events from multiple ticketing APIs. Every source degrades gracefully: a missing key or a failed fetch returns `ok: false`, the corresponding modifier returns 0, and the page still renders, so no single upstream can take the app down. Ingest runs on a 30-minute GitHub Actions cron rather than Vercel Cron, because the platform's free tier was too coarse for the cadence I wanted. By the end of the session it was deployed and serving on a custom domain.

## Making it a real model, not a story about one

Once the scaffold was live, I pushed to make the demand surface a genuinely trained model instead of hand-tuned weights:

> Is this actually ML, and what are the concrete next steps to get there?

That became a Poisson GLM trained on 21,892 parking citations I obtained by FOIA request (2022 to 2024). The core modeling problem is that citations are a biased proxy for demand: a citation only exists if an officer was present and chose to write it, and staffing varies, so raw counts conflate how busy it was with how many officers were working. I corrected for this by modeling citations per officer-day as a rate, with a log-exposure offset, so the trained surface estimates demand intensity rather than enforcement volume. It is validated out-of-sample with forward-chaining (time-series) cross-validation, training on past years and testing on a held-out future year, not random k-fold, because the data is temporal.

I also wanted to know where the real ceiling was, the model or the data:

> What's the ceiling here, the model as it stands now or near-perfect data?

The honest answer was that the citation proxy caps out and the unlock is ground-truth occupancy data, not a fancier algorithm, which is what set up the model comparison later.

I kept confounded signals out of the trained surface on purpose. Weather is the clearest case: rain suppresses both shopping and ticket-writing, so a model that learns weather from citations over-penalizes rain. I split weather into a separately-estimated, patrol-controlled modifier instead of letting the trained model absorb the confound. When that reasoning was handed to me as already settled, I refused to take it on faith:

> Have we actually tested this? You wrote the doc making the claim.

## Local knowledge the data cannot see

A generic model would not know what moves this specific street, so I drove domain structure into it. I made the model account for the local private-school calendars, which diverge from the public-school calendar enough to shift demand (the two-week private spring break in early March is a real demand event), and I pushed to treat the street as differentiated rather than uniform:

> I want to predict different parts of the Avenue separately instead of one block, and surface the real hotspots people actually drive to.

That became a hotspot layer keyed to real destinations and a parking inventory structured into on-Avenue street, side streets, and rear lots, with the schema ready for later per-zone occupancy data. About 70% of downtown capacity is off-Avenue, which changes how predictions should be presented. I also reversed a wrong assumption that came from the data rather than the place:

> Memorial Day is wrong. Plenty of people stay in Greenwich, they don't all leave town.

The model had begun treating it as a getaway day, so I had that modifier pulled. I caught the missing moveable-holiday cases like Easter the same way.

## Validation and adversarial hardening

After launch I did not trust the shipped model. I put it through a staff-level engineering review, and it caught a load-bearing bug: a recalibration path I believed was driving the score was effectively dead code, silently shadowed at runtime by the trained surface. I replaced it with a cross-validated blend between the trained model and the prior, implemented test-first. I had already flagged that the blend weight was not a throwaway detail:

> If the cross-validated blend weight is 0.95 and not the 0.6 we assumed, that's a huge difference. Why aren't we using it?

It came out at 0.95, which is a large behavioral change: at that weight the trained surface is almost fully in control inside the enforcement window and the prior only fills the hours with no signal. I then ran a separate adversarial review whose only job was to break that fix, and it surfaced a score-floor bug in the rate-to-score mapping that I had missed.

Finally I tested whether a more expressive model would beat the GLM. I built a LightGBM gradient-boosted model with a Poisson objective and a `log(exposure)` offset via init-score, fit under two different exposure definitions to check for leakage, and evaluated it with the same forward-chaining folds against both the GLM and a seasonal-mean baseline. Before trusting any of it I verified the offset wiring with two checks: exposure-linearity (`pred(2·E) == 2·pred(E)`, so the output is a rate times exposure, not a raw count) and offset reconciliation on an unregularized fit (`sum(rate·E) == sum(actual)`).

The honest outcome is a wash, and I reported it as one rather than dressing it up. The GLM won pooled held-out deviance by 0.6%, but the order flipped on MAE and the two models split by fold. The tell is that even the seasonal-mean baseline — each cell's own historical rate, no day×hour shape at all — landed in the same band. When the dumbest baseline is competitive with both the smoothed GLM and the boosted tree, the surface is simply too small (about 54 day×hour cells over two to three years) for sophistication to extract anything: there is no non-linear interaction in a `(dow, hour)` grid that a cubic-in-hour crossed with day dummies cannot already represent. So the correct claim is "no evidence a GBM helps at this data scale," not "the GBM is worse." I kept the simpler, already-validated GLM and wrote a decision record with the exact conditions that would flip the verdict: several more citation-years, or the Phase-4 swap to real occupancy labels, where genuine weather×event×day interactions would finally give a tree something the GLM's additive offset structurally cannot see. Reporting a wash as a wash is better engineering than tuning until one model appears to win.

Because the ceiling is data and not algorithm, I have already filed for the data that lifts it. On 2026-06-17 I sent a public-records request to the Town of Greenwich for the two specific unlocks the decision record names: real occupancy and payment data (ParkMobile transactions, meter and pay-station payments, garage entry/exit, occupancy surveys) to replace the citation proxy with ground-truth labels, and the enforcement patrol schedule to replace the ticket-derived exposure offset with a truly exogenous one. The Town acknowledged it the same day; records are pending. When they arrive the model comparison and the exposure model both get re-run on ground truth, and that is the point where a more expressive model could finally earn its place.

## Summary

One session took this from an empty repository to a deployed product fusing a trained, confound-corrected statistical model with six live data feeds, behind a deterministic, heavily-tested scoring core. The follow-up validated that model out-of-sample, caught and fixed real bugs through adversarial review, and honestly benchmarked it against a more complex alternative that lost. I architect the system, own the data and the methodology end to end, and hold the bar on testing and honest evaluation.
