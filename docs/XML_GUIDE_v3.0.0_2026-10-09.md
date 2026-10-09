# Butter XML guide — tool 3.0.0 / schemas 3.0 / 2026-10-09

Canonical full examples:
[scenario](../examples/scenario_example_2026-10-09_tool-v3.0.0.xml),
[bank snapshot](../data/banks_verified_2026-10-09_tool-v3.0.0-r2.xml).
The matching YAML files are easier to edit. Use the CLI to serialize them to XML;
do not invent a second dialect. [JSON schemas](../schemas/) and runtime validation
define accepted fields. Unknown keys are rejected.

## Envelope and typed values

```xml
<hysaScenario toolVersion="3.0.0" schemaVersion="3.0" dataAsOf="2026-10-09">
  <scenario type="object">
    <!-- complete ScenarioSchema object, as in the example -->
  </scenario>
</hysaScenario>
```

Bank files use `hysaRules` with a `catalog type="object"` child. The inner object includes
`toolVersion`, `schemaVersion`, and `dataAsOf` (scenario) or `checkedOn` (catalog), matching
the envelope. Every child has a `type`: `object`, `array`, `string`, `number`, `boolean`,
or `null`. Numbers have no currency symbols or commas; APY is percent (4.25), tax rate a
fraction (0.22), cash USD, booleans `true`/`false`, dates `YYYY-MM-DD`.

```xml
<startingCash type="number">25000</startingCash>
<rateAsOf type="null"/>
<eStatements type="boolean">true</eStatements>
<notes type="array"><item type="string">Example &amp; assumption</item></notes>
```

Array member tags: `banks/account`, `flows/flow`, `events/event`, `sources/source`,
`discoveries/discovery`, `rateHistory/point`, `reviews/review`, `conflicts/conflict`,
`promotions/promotion`, `bonuses/bonus`. All other arrays use `item`.
Facts are an object with `fact key="..." type="object"` children. A fact's child `value`
retains its actual primitive type. Source IDs are references, not URLs without metadata.

Each bank account also has `id`, `name`, `legalInstitutionName`, `calculatorModel`,
`verified`, `dataAsOf`, `researchedAt` attributes. They must agree with its inner fields
and profile. `verified` describes the **calculation scope**, not every operational fact.

```xml
<fact key="outgoingAchDaily" type="object">
  <value type="number">25000</value>
  <unit type="string">USD</unit>
  <status type="string">verified</status>
  <confidence type="string">high</confidence>
  <sourceIds type="array"><item type="string">transfer-agreement</item></sourceIds>
  <notes type="string">Synthetic example; bank-initiated outgoing ACH only.</notes>
</fact>
```

For unknowns: `value type="null"`, `status` and `confidence` = `unknown`, an empty
`sourceIds` array, and notes explaining the unresolved question. Never encode unknown as
zero, false, infinity, an empty string, or an assumed unlimited cap.

Each source includes `id`, `type`, `publisher`, `title`, `url`, `section`, `accessedAt`,
and nullable `effectiveDate`. Types: `official`, `regulator`, `app-store`, `secondary`,
`review`, `community`, `archive`. A verified operational fact requires an official or
regulatory source. Source references must resolve within the bank profile.

## Scenario fields

Required: schema/tool version, ID/name, created date, start/end dates, starting cash,
tax rate, baseline `{name, apy, monthlyFee}`, selected bank IDs, opening transfer
`{businessDays, fee, holdDays}`, and flows. Include `dataAsOf` and optional `focusYear`.
`eligiblePromotionIds` is explicit opt-in, not inferred from a deposit.

Flows contain `id`, `label`, `amount`, `direction` (`in`/`out`), `cadence` (`weekly`/
`monthly`), `interval`, `dayOfMonth`, `startDate`, `endDate`, `qualification` (`none`,
`payroll`, `external-deposit`). Weekly interval 2 = biweekly; monthly interval 3 = quarterly.
Events contain date, signed amount, label and qualification. Enter irregular taxes,
rent changes, travel spending or purchases as separate dated flows/events. Do not add
qualification activity as cash a second time.

`insurance`: ownership `single`/`joint`/`other`, `jointOwners` (2–10), `otherDeposits`
with `{aggregationGroup, amount, label}`. All entered related deposits are assumed to
share the selected category; joint estimates assume eligible equal interests and the
same owner set. Trusts/other categories and sweep allocation remain manual/unknown.

`linkedAccounts`: `{bankId, accountType, reservedBalance, averageDailyBalance,
qualifyingFlowIds, newCustomer, referralEligible, notes}`. `accountType` is checking or
investment; eligibility is yes/no/unknown. Flow IDs reference actual income, never
duplicate it. These fields preserve assumptions for audit; v3 does **not** simulate
coupled checking/investment balances or statement-cycle qualification. Such products
must remain `unsupported`. The ordinary forecast assumes the starting cash is available
to the candidate, excluding any separately reserved cash you did not enter there.

## Bank calculation and research fields

Catalog: ID, schema/tool version, `checkedOn`, currency USD, policy and banks. Each bank
has ID/name/institution, review/effective dates, verification (`verified`/`review`),
source URL, evidence, model, nullable APY, minimums/fees, tiers, promotions, bonuses,
limitations and optional `profile`. Omitted profiles are visibly unaudited legacy data.

Models: `flat`, `whole-balance`, `marginal`, `rolling-payroll`, `unsupported`. Use a
model only if it captures the complete selected calculation path. Unsupported rules
cannot be approximated by a misleading rate. `calculation.*` facts map numeric engine
inputs to supporting evidence; the CLI audit flags missing/contradictory mappings.

`profile` contains:

- `researchedAt`, `facts`, `sources`.
- `conflicts`: key, at least two sourced claim objects, resolution, resolved boolean.
- `discoveries`: ID/date/category/title/finding/implication/action/status/sourceIds/
  relatedFacts. Status verified/unresolved/reported; action is the user's manual check.
- `researchLog`: date/area/outcome/notes/sourceIds. Outcomes reviewed/partial/not-found/blocked.
- `rateHistory`: date/APY/product/tier/series/sourceIds/confidence, optional validThrough.
- `reviews`: ID/category/scope/rating/reviewCount/ratingDate/accessedAt/sourceIds/notes.
  Rating/count may be null. Categories app/service/transfer/overall must stay distinct.
- `themes`: category/description/reportCount/sourceIds/notes. Minimum two independent
  reports; retain corroborating URLs. Themes are customer sentiment, not bank policy.

The complete field inventory is [fact-inventory.json](../schemas/fact-inventory.json),
generated from `lib/profile.ts`. Research **every group**:

| Group | Required scope |
| --- | --- |
| Identity & insurance | Legal bank, parent, division, FDIC certificate/regulator, same-bank group, direct/sweep/pass-through structure, ownership, program count/conditional ceiling, acquisitions, dated regulator actions and review scope |
| Rates & qualification | Regular/base/qualified/intro/guaranteed APY, variable flag, all tier thresholds/methods/caps, dates, bonus/code, eligibility/referral, linked products, payroll vs other deposits, checking/savings ADB and statement cycles |
| Minimums & fees | Opening/interest/waiver minimums; monthly, inactivity, closure, ACH, incoming/outgoing wire, paper, check, card/replacement, ATM/foreign/transaction, excess-withdrawal and returned-deposit fees |
| Deposits & holds | Opening methods/cap, incoming pull transaction/day/week/month limits, external pushes, mobile/mailed/branch checks and limits, wires/cash/ATMs, linked-bank counts, pull/new/check/wire availability and extended holds |
| Withdrawals & exit | Bank-initiated ACH transaction/day/week/month/count/reset windows, internal vs external rails, external pulls, wires and amount/fee/cutoff, same-day ACH, phone increases, age/personalization, closure/full-balance/check payout, processing and review delays |
| Cards & access | Debit/ATM availability, linked checking requirements, network/count, fees/refunds, ATM/purchase caps, international access, mobile wallets/card locks, cash access |
| Support | Phone/hours/24-7/weekend, chat/secure messages/email/callback, branches, international number, fraud/lost-card contact, U.S. phone dependencies |
| Security | MFA, SMS, authenticator, passkeys, hardware keys, biometrics, trusted devices/removal, login/transfer/transaction/large-withdrawal alerts, card/account locks, fraud monitoring and suspicious-login blocking |

Unsupported numeric semantics stay in sourced notes, not an invented scalar. For example,
relationship-dependent ranges are not a universal daily cap. `wireNoPublishedCap=true`
requires an **explicit official no-limit statement** for the supported route.
Monthly exit calculations support `achLimitWindow=calendar` or `rolling-30`; weekly
currently supports `achWeeklyWindow=rolling-7`. Other/unknown windows warn and are not
silently assigned a reset. See methodology for the lower-bound assumptions.

## Validation, export and compatibility

```sh
npx tsx cli.ts scenario --scenario plan.local.yaml --format xml --output outputs/scenario.xml
npx tsx cli.ts banks --banks data/banks-2026-10-09-v3-r2.yaml --format xml --output outputs/banks.xml
npx tsx cli.ts validate --scenario outputs/scenario.xml --banks outputs/banks.xml
npx tsx cli.ts audit --banks outputs/banks.xml
```

Validate dates, unique IDs, cross-file bank/offer references, source IDs, model rules,
envelope consistency and financial feasibility. Reject incompatible major versions;
this release writes tool 3.0.0/schema 3.0. It does not interpret new rule semantics merely
because XML is well formed. DTDs/custom entities, duplicate fields and files >12 MB are rejected.

Explicit legacy migration supports v2 YAML/JSON and limited v1 XML: scenario schema 1.0,
bank schema 2.1. Migration notes explain defaults and missing research. V1 undated monthly
metrics are rejected; convert to real dated events/linked assumptions manually. Unsupported
legacy account rules remain excluded. Old data is not freshly verified by importing it.

New releases increment versions, regenerate schemas, update this guide and every prompt,
and preserve published dated snapshots. Name files `banks_verified_DATE_tool-vVERSION.xml`
and `scenario_example_DATE_tool-vVERSION.xml`. The historical filename does not certify
all facts: inspect each fact's status and the product's calculation verification.
