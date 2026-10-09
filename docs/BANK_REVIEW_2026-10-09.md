# Official-provider bank review — October 9, 2026

All 17 original accounts were revisited; eight were added. The new catalog contains 25
accounts, 17 supported models and eight excluded entries. This is a manual source review,
not continuous monitoring. The canonical [YAML snapshot](../data/banks-2026-10-09.yaml)
includes source URLs, provider effective dates, evidence and limitations for every entry.

## Existing catalog

| Account | Observed rate / decision | Source |
| --- | --- | --- |
| Axos ONE | 1.00% base; conditional 4.21%/3.50% and new-customer boost. Unranked until linked checking and statement-cycle economics are modeled. | [Axos](https://www.axosbank.com/personal/bank/axos-one) |
| Openbank | 3.80% base; +0.35 points for six months, eligible new accounts through November 3. Opt-in boost supported. | [Openbank](https://www.openbank.us/banking/high-yield-savings-account/) |
| Wealthfront | 3.55% base; new-client +0.65 points for three months up to $150,000. Other boosts excluded. | [Wealthfront](https://www.wealthfront.com/cash) |
| SoFi | Standard non-Plus 0.80%/3.30% payroll path. Plus tiers and promotional awards excluded. | [Rate sheet](https://www.sofi.com/legal/banking-rate-sheet/) |
| E*TRADE | 3.75% base; eligible six-month 4.25% offer and SAVE800 bonus. Corrected average-balance and payout timing. | [E*TRADE](https://us.etrade.com/bank/premium-savings-account) |
| EverBank | 4.20%, all balances, new-account scope; zero monthly maintenance fee/minimum. | [Rates](https://www.everbank.com/rates), [product](https://www.everbank.com/banking/performance-savings) |
| Capital One | Dynamic official rate returned NaN. Current APY unresolved; excluded. | [Capital One](https://www.capitalone.com/bank/savings-accounts/online-performance-savings-account/) |
| Happen LevelUp | 4.20% qualified / 3.00% standard; prior-cycle $250 deposits. Excluded until exact cycle behavior is supported. | [Happen](https://www.happen.com/personal-banking/savings/high-yield-savings) |
| CIT Platinum | Whole-balance tiers: 0.25% below $5,000; 3.75% from $5,000. Old boost not reconfirmed. | [CIT](https://www.cit.com/cit-bank/bank/savings/platinum-savings-account) |
| Marcus | 3.50% base; referral start/eligibility not modeled. | [Marcus](https://www.marcus.com/us/en/savings/high-yield-savings) |
| Forbright | 3.85%; official product selector supplied the rate where the application shell did not. | [Product selector](https://openaccount.forbrightbank.com/products?customerCategory=personal&productType=savings) |
| Western Alliance | 3.80%; $500 minimum, no account fees. Page still labels rate effective January 8. Transfer-only funding limitations shown. | [Western Alliance](https://www.westernalliancebancorporation.com/personal-banking/high-yield-savings-account) |
| Peak | Fresh October 1 disclosure resolves cached conflicts: 4.27% below $500,000 and 3.40% above. Opening hold disclosed. | [Peak](https://www.peak.bank/peak-bank/savings/) |
| Bask | 3.90% base. Bundle boost/cash bonuses require separate checking and are excluded. | [Savings](https://baskbank.com/products/interest-savings-account), [bundle rules](https://baskbank.com/more-ways-disclosures) |
| Bread | Current APY unavailable in retrieved product/application pages. Excluded, previous rate not relabeled as fresh. | [Bread](https://www.breadfinancial.com/en/bread-savings/high-yield-savings-account.html) |
| Live Oak | 4.00% base. Reviewed but excluded $300 promotion: threshold date, existing-customer benchmark and 45-day payout need further modeling. | [Live Oak](https://www.liveoak.bank/personal-savings/) |
| Barclays | Official page retrieval failed; current exact tiers unresolved. Excluded. | [Barclays](https://banking.barclaysus.com/tiered-savings.html) |

## Added accounts

| Account | Observed rate / decision | Source |
| --- | --- | --- |
| Ally | 3.10% across current tiers, $0 opening/monthly fee; withdrawal-count limitation shown. | [Ally](https://www.ally.com/bank/online-savings-account/) |
| BrioDirect | 3.75%; $5,000 to open, $25 to earn rate, no monthly maintenance fee. | [BrioDirect](https://www.briodirectbanking.com/high-yield-savings/) |
| Ivy | 4.00% at $2,500–$1m, 0.05% at $10–$2,499.99; $2,500 opening minimum. | [Ivy](https://www.ivybank.com/), [fees](https://www.ivybank.com/files/2025-06/IVY-0001_Ivy%20Bank%20Fee%20Schedule_20250604.pdf) |
| Vio | 3.40%, $100 opening minimum, $5 paper-statement fee. Holds and opening cap disclosed. | [Vio](https://www.viobank.com/cornerstone-money-market-savings) |
| Pibank | 4.25% dated September 29 on homepage supersedes July 2 product-page 4.10%. Wire-only limitations shown. | [Homepage](https://www.pibank.com/), [product details](https://www.pibank.com/pibank-savings/) |
| Newtek | Advertises 4.20% but explicitly pauses new applications. Excluded. | [Newtek](https://www.newtekbank.com/personal/high-yield-savings/) |
| American Express | Dynamic rate not available in retrieved official page. APY left null; excluded. | [Amex](https://www.americanexpress.com/en-us/banking/online-savings/high-yield-savings-account/) |
| Synchrony | Numeric rate absent in retrieved official page. APY left null; excluded. | [Synchrony](https://www.synchrony.com/banking/products/high-yield-savings) |

Unverified entries may retain descriptive opening/fee fields from earlier material; they
never enter arithmetic. Reverify their full terms before changing status. “Verified” for
modeled entries covers the stated scope, not every possible promotion or eligibility case.
