# How Butter compares cash accounts

Each row is a separate use of the same starting cash and posted income/spending. No cash is
split between candidates. Baseline flows are identical; baseline cash stays parked.

## Daily calculation

Start/end dates are inclusive. UTC dates avoid daylight-saving errors.

```text
daily_rate = (1 + APY / 100)^(1 / 365) - 1
interest_today = eligible_balance * daily_rate
estimated_tax = (interest + bonuses) * tax_rate
net_return = interest + bonuses - fees - estimated_tax
incremental_gain = candidate_net_return - baseline_net_return
```

This is APY-equivalent daily accrual, not an exact statement-posting ledger. Leap years still
use 365. Arithmetic keeps full floating-point precision; display rounds to cents. Tax is
reserved at horizon end, leaving daily compounding unchanged. Fees are not tax deductions.
Take-home salary is never taxed again.

Cash flows post before interest. Monthly days beyond month end clamp to the last date.
`interval: 2` with weekly cadence is biweekly, anchored to its start date. Flow dates are
clipped to the horizon. Monthly fees charge on calendar month-end, with no charge in an
incomplete final month. Balance waivers use the minimum modeled daily balance; partial
opening months include only modeled days. Other statement-cycle rules need another model.

## Transfers and feasibility

Opening fees reduce cash on day one. One user-entered opening delay applies to all candidates.
Positive business-day delays initiated on weekends start the next weekday. Weekends count;
federal holidays and cutoffs are not modeled. Transit earns zero interest; holds after arrival
earn interest. The hold setting is in calendar days. The baseline has no opening transfer.

Later cash flows are already-posted movements. Recurring transfer friction, actual bank hold
rules, transfer limits and a separate spending account are not modeled; review each bank's
limitations and set realistic dates. Withdrawals before assumed initial availability,
negative cash balances and failed minimum opening deposits make candidates infeasible.
An infeasible baseline stops the comparison. No shortfall is silently repaired.

## Models and promotions

Supported models: flat, whole-balance tiers, marginal tiers, and rolling payroll qualification.
SoFi covers only standard non-Plus savings with explicit payroll; ACH never becomes payroll.
No bank grace period is inferred.

Rate promotions require their ID in `eligiblePromotionIds`, opening in the enrollment window,
and their conditions to be true. A fixed rate or APY delta ends at its calendar-month
anniversary. Caps boost only the eligible portion. Stacked rate offers are excluded until
their interaction is modeled. Promotion duration begins on the scenario opening date; a
later-funded offer may differ. Intraday cutoffs need manual verification.

Balance bonuses require a complete funding window and complete minimum/average balance
maintenance window. Funding counts net external flows. Payroll bonuses anchor to the first
eligible payroll, not the calendar month. Payout uses the latest stated delay; bonuses beyond
the horizon are not credited. A credited bonus then earns interest. E*TRADE funding spans
30 days, maintenance the next 45, with conservative payout on opening +105 days. Deposits
must be new-to-bank funds; promo code and lifetime eligibility are explicit opt-in assumptions.

Axos and Happen need further account/cycle models and are unranked. Bask, SoFi, Marcus, CIT
and Live Oak specify excluded rewards in their limitations. Rankings mean **best among the
selected modeled options**, not best bank in the market. Ties share a rank. The baseline wins
when it matches or beats candidates because moving cash adds no modeled benefit.

## Dated data

`checkedOn` is our retrieval/review date; `rateAsOf` is the provider's stated effective date,
or null if unavailable. Account details show both. Rates remain fixed to the input snapshot
except modeled promotional transitions. A snapshot over 30 days before the scenario start
produces a warning; one after the start is labeled a what-if, not a historical backtest.
The UI always displays the snapshot date. Old data does not establish today's offer.

The CLI includes exact-file hashes. The engine never fetches rates or silently updates data.
The comparator does not model simultaneous multi-bank strategies, travel,
Chex history, unentered penalties, account closures or market investments. Provider eligibility
and actual funds availability must be checked before executing a forecast.

## Liquidity and insurance (v3)

`exitAnalysis` is separate from the yield ledger. It assesses settled cash on a selected
date assuming unused transfer capacity. It does not automatically delay salary/expenses
or deduct a hypothetical exit fee from a forecast that has no planned exit.

ACH lower bounds use documented daily, transaction and count caps, supported calendar/
rolling-30 monthly windows and rolling-7 weekly windows. Unknown windows are not guessed;
warnings explain omitted constraints. Per-transaction caps alone do not imply a daily
capacity. Banking-day initiation skips weekends; federal holidays/cutoffs are unmodeled.
Calendar days and final initiation date are reported separately. Processing is added to
the final initiation to illustrate a theoretical arrival range. Actual review/recipient
holds, used/shared limits and outstanding-transfer restrictions can make it longer.

Full wire capacity requires an explicit no-amount-cap statement for the route, or sufficient
documented transaction AND daily limits. Published new-account restrictions take precedence.
Telephone-only routes retain that condition in sourced notes. A wire route is not a timing
guarantee. Without a documented processing range, arrival remains unknown. Real-world
evacuation is always unknown until account-specific availability is established. Stress
tests use $50k/$100k/$250k/$500k; the UI also uses actual daily cash or a custom balance.

FDIC estimates require sourced direct-bank structure, FDIC eligibility and aggregation
group. Single ownership uses $250,000, eligible equal-share joint ownership $250,000 per
owner; entered related deposits reduce remaining capacity. Joint estimates assume the
same owner set and no unequal interests. Other ownership and actual sweep allocation
are not inferred. Peak and ending cash are checked before tax reserve because accrued
interest also occupies coverage. Related brands share the legal-bank group. A merger
grace period requires manual review; the model conservatively uses combined coverage.

## Research statistics and ranking

The earnings winner is after-tax return, never a composite safety/reputation score.
Friction counts seven documented obstacles: monthly fee, linked account, required DD,
no outgoing wire, daily ACH cap below $100k, new-account hold, and no 24/7 support.
Unknown checks are displayed separately; a complete numeric score requires all seven.
Customer-service sorting uses service-scoped ratings only, not app/company scores.

History is grouped by product/tier/rate series. A dated observation covers one day unless
the evidence explicitly establishes `validThrough`. Full coverage of every day in a
3/6/12-calendar-month lookback (inclusive endpoints) is required for its time-weighted
average. Overlapping conflicting values leave that day uncovered. Sparse observations
can show observed low/high/population standard deviation and changes, but cannot establish
the actual number of market rate changes. Missing observations are never filled forward.

Effective APY annualizes total interest divided by the sum of daily earning balances;
it excludes bonuses/fees/taxes and is unknown with no earning balance. Focus-year interest
sums daily accrual in the requested year. Yield lost to tiers/caps compares the day's
actual accrual to its highest eligible rate with no threshold/cap, holding daily cash
fixed; qualification loss compares the qualified rate on unqualified days. These are
diagnostics, not compounded alternate-strategy returns, and are not added to earnings.

Freshness is evaluated against the real UTC date or explicit `--as-of`, independent of
scenario dates: 0–7 Fresh, 8–30 Recent, 31–90 Aging, >90 Stale; future-dated inputs warn.
Sources retain their own access/effective dates. Local audit does not reverify websites.

## Individual comments

Review sentiment is a curator's label for the selected comment, never a calculated safety
score or population estimate. Mixed reports preserve both sides. Duplicate permalinks are
rejected; counts of distinct public handles do not authenticate distinct people. A reported
transfer cap does not enter exit calculations until independently established as a sourced
bank rule. Existing aggregate platform listings and individual comments remain separate.
