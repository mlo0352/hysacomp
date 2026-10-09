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
The comparator does not model simultaneous multi-bank strategies, FDIC aggregation, travel,
Chex history, unentered penalties, account closures or market investments. Provider eligibility
and actual funds availability must be checked before executing a forecast.
