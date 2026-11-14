// The full Sherpas analysis of any family, read from the same files the MCP serves
// (financial-health, investment-analysis, persona). One function builds every figure the
// blocks use; anything a family doesn't have comes back empty, and its blocks stay hidden.
// Nothing here is typed in by hand.
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const caseIds = ["michael-carter", "timothy-melanie-weah", "daniel-emily-johnson", "samantha-lewis"] as const;

const year = (iso: string) => Number(String(iso).slice(0, 4));
const month = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const val = (o: any): number | null => num(o?.value);

export type PersonId = string;
export type PersonaDim = { code: string; name: string; value: string; text: string };
export type PersonaItem = { code: string; title: string; level: string; text: string };

const read = (slug: string, file: string) => readFileSync(join(process.cwd(), "mock/cases", slug, file), "utf8");

export function buildPlan(slug: string) {
  const fh = JSON.parse(read(slug, "financial-health.json"));
  const ia = JSON.parse(read(slug, "investment-analysis.json"));
  const personaMd = read(slug, "persona.md");
  const km = fh.key_metrics;
  const ikm = ia.key_metrics;

  const members = fh.case.household as any[];
  const adultsRaw = members.filter((m) => m.role === "client" || m.role === "co-client");
  const kidsRaw = members.filter((m) => m.role === "child");
  const client = adultsRaw[0];
  const coClient = adultsRaw[1] ?? null;

  const household = {
    slug,
    family: adultsRaw.length > 1 ? `${adultsRaw.map((a) => a.first_name).join(" & ")} ${titleCase(slug.split("-").pop()!)}` : `${client.first_name} ${titleCase(slug.split("-").pop()!)}`,
    place: `${fh.case.city}, ${fh.case.state}`,
    couple: adultsRaw.length > 1,
    adults: adultsRaw.map((m) => ({
      id: String(m.first_name).toLowerCase() as PersonId,
      name: m.first_name as string,
      age: m.age as number,
      retireAge: m.retirement_age as number,
      risk: m.risk_profile as string,
    })),
    kids: kidsRaw.map((k) => ({ name: k.first_name as string, age: k.age as number })),
  };

  /* ---------- Score ---------- */
  const score = {
    value: fh.score.published_score as number,
    band: fh.score.band as string,
    bands: [
      { name: "critical", to: 40 },
      { name: "vulnerable", to: 60 },
      { name: "stable", to: 80 },
      { name: "strong", to: 100 },
    ],
    caps: (fh.score.caps_applied ?? []) as any[],
    pillars: (fh.score.pillars as any[]).map((p) => {
      const [got, max] = String(p.points_shown_in_app).split("/").map(Number);
      return { key: p.pillar as string, name: p.pillar as string, got, max };
    }),
    moves: (fh.score.top_moves as any[]).map((m) => ({ title: m.title as string, action: m.action as string, effort: m.effort as string, after: m.score_after as number })),
    combos: (fh.score.combined_moves as any[]).map((c) => ({ moves: c.moves as string[], after: c.score_after as number })),
  };

  /* ---------- Cash flow ---------- */
  const cf = km.cashflowStatement;
  const outflow = (name: string) => (cf.outflows.items as any[]).find((i) => i.name === name);
  const flows = [
    { key: "taxes", label: "Taxes", amount: outflow("Taxes")?.total ?? 0 },
    { key: "living", label: "Living costs", amount: outflow("Expenses")?.total ?? 0 },
    { key: "housing", label: "Home", amount: outflow("Housing Expenses")?.total ?? 0 },
    { key: "saving", label: "Already saving", amount: outflow("Savings")?.total ?? 0 },
    { key: "debt", label: "Debt payments", amount: outflow("Debt Payments")?.total ?? 0 },
  ].filter((f) => f.amount > 0) as { key: string; label: string; amount: number }[];
  const free = cf.freeCashflow.total as number;
  const cashflow = {
    income: cf.inflows.total as number,
    earners: [
      { name: client.first_name as string, amount: cf.inflows.client as number },
      ...(coClient ? [{ name: coClient.first_name as string, amount: cf.inflows.coClient as number }] : []),
    ].filter((e) => e.amount > 0),
    flows: free > 0 ? [...flows, { key: "free", label: "Left over", amount: free }] : flows,
    free,
    savingSplit: ((outflow("Savings")?.items ?? []) as any[]).map((i) => ({ label: String(i.name).replace(" savings", "").replace(" Savings", ""), amount: i.total as number })),
  };

  /* ---------- Cushion ---------- */
  const ef = km.ratios.emergencyFund;
  const cashNow = km.protection.emergencyFund.cashAndExpensesOverview.cashReserves as number;
  const cushion = {
    months: Number(km.facts.cash.monthsCovered.value),
    minMonths: ef.minRecommendedEFMonths as number,
    maxMonths: ef.maxRecommendedEFMonths as number,
    cash: val(km.facts.cash.accessibleCash) ?? cashNow,
    monthly: Math.round(ef.minRecommendedEmergencyFund / ef.minRecommendedEFMonths),
    targetMin: ef.adjustedRecommendedMinAmount as number,
    gap: Math.max(0, Math.round(ef.adjustedRecommendedMinAmount - (val(km.facts.cash.accessibleCash) ?? cashNow))),
  };

  /* ---------- Projection ---------- */
  const yearlyRaw = fh.projections.yearly as any[];
  const yearly = yearlyRaw.map((r, i) => ({ year: r.year as number, age: client.age + i, investable: r.investable_assets as number, netWorth: r.net_worth as number }));
  const netWorthPath = yearlyRaw.map((r, i) => ({ year: r.year as number, age: client.age + i, value: r.net_worth_todays_dollars as number, debts: r.total_debts as number }));

  const rf = km.facts.retirement ?? {};
  const dep = km.retirementAndOtherGoals.assetDepletion;
  const bucket = (name: string) => ((ikm.savingsAndContributions.taxOpportunityCheck.annualTaxSavingsByBucket as any[][]) ?? []).find((r) => r[1] === name);
  const k401 = bucket("401k");
  const need = val(rf.spendingNeed);
  const gapDraw = val(rf.spendingGap) ?? val(rf.averagePortfolioDraw);
  const retirement = {
    need: need !== null ? Math.round(need) : null,
    fromSavings: gapDraw !== null ? Math.round(gapDraw) : null,
    fromIncome: need !== null && gapDraw !== null ? Math.round(need - gapDraw) : null,
    leftAtEnd: val(rf.savingsLeftAtPlanEnd) !== null ? Math.round(val(rf.savingsLeftAtPlanEnd)!) : Math.round(dep.liquidAssetsAtEndOfPlan),
    endAge: km.retirementAndOtherGoals.clientProfile.endOfPlanAge as number,
    runsOutAt: num(dep.ageWhenTheyRunOutOfLiquidAssets),
    gap: Math.round(km.ratios.retirementSavings?.planningGapAtRetirementAgeInTodaysDollars ?? 0),
    extraPerYear: Math.round(km.ratios.retirementSavings?.requiredExtraSavings ?? 0),
    free: Math.round(free),
    drawRate: num(km.retirementAndOtherGoals.withdrawals?.withdrawalRatio),
    limitEach: (km.protection.emergencyFund.taxAdvantagedAccountsContributions as any[][] | undefined)?.find((r) => /401/.test(String(r[0])))?.[3] ?? null,
    contributing: (fh.profile.accounts as any[]).filter((a) => /401|IRA/i.test(a.account_type)).reduce((s, a) => s + (a.yearly_contribution_total ?? 0), 0) as number,
    taxCut: k401 ? (num(k401[5]) ?? null) : null,
    taxCutOn: k401 ? (num(k401[4]) ?? num(k401[3])) : null,
    taxRate: Number(((ikm.savingsAndContributions.taxOpportunityCheck.annualTaxSavingsByBucket as any[][])[0][5] ?? "").match(/(\d+)%/)?.[1] ?? 0) / 100,
  };

  /* ---------- Life events ---------- */
  const ss = (fh.profile.incomes as any[]).filter((i) => i.type === "SOCIAL_SECURITY");
  const chartGoals = fh.goals.chartGoals as any[];
  const retireYear = Math.max(...chartGoals.filter((g) => g.goalType === "RETIREMENT").map((g) => year(g.date)), year(String(yearlyRaw[0].year + (client.retirement_age - client.age))));
  const events = [
    ...chartGoals
      .filter((g) => ["COLLEGE", "RETIREMENT", "PURCHASE"].includes(g.goalType))
      .map((g) => ({
        year: year(g.date),
        until: g.goalType === "COLLEGE" && g.termDate ? year(g.termDate) : undefined,
        label: g.name as string,
        kind: g.goalType === "COLLEGE" ? "college" : g.goalType === "PURCHASE" ? "purchase" : "retire",
        who: g.goalType === "COLLEGE" ? String(g.name).replace("College ", "") : g.goalType === "RETIREMENT" ? String(g.name).split("'")[0] : "all",
      })),
    ...(km.ratios.creditCardDebt?.ccPayoffDate ? [{ year: year(km.ratios.creditCardDebt.ccPayoffDate), label: "Card paid off", kind: "debt", who: client.first_name }] : []),
    ...(km.ratios.currentDPD?.debtLastPayment ? [{ year: year(km.ratios.currentDPD.debtLastPayment), label: "Last debt payment", kind: "debt", who: "adults" }] : []),
    ...ss.map((i) => ({ year: i.starts as number, label: "Social Security starts", kind: "income", who: i.owner[0] as string })),
    ...(retirement.runsOutAt ? [{ year: yearlyRaw[0].year + (retirement.runsOutAt - client.age), label: "Savings run out", kind: "alert", who: client.first_name }] : []),
  ] as { year: number; until?: number; label: string; kind: "college" | "retire" | "debt" | "income" | "purchase" | "alert"; who: string }[];
  const timeline = {
    from: yearlyRaw[0].year as number,
    to: Math.min(yearlyRaw[yearlyRaw.length - 1].year, Math.max(retireYear + 8, ...events.filter((e) => e.kind !== "alert").map((e) => e.year + 2))),
    events,
    retireYear,
  };
  timeline.to = Math.max(timeline.to, ...events.map((e) => e.year + 1));

  /* ---------- Protection ---------- */
  const life = km.ratios.lifeInsurance;
  const lifeRow = (m: any, coverage: number, income: number, earner: any) =>
    earner && income > 0
      ? { who: String(m.first_name).toLowerCase(), name: m.first_name as string, has: coverage, min: income * earner.adequatelyInsured, max: income * earner.slightlyOverInsured, income, multiple: [earner.adequatelyInsured, earner.slightlyOverInsured] as number[] }
      : null;
  const ownedAssets = fh.profile.other_assets as any[];
  const collegeGoal = (fh.goals.goalsSummary as any[]).find((g) => g.goalType === "COLLEGE");
  const exposedRows = (km.protection.umbrellaInsurance?.assetExposed?.assetExposedSummary ?? []) as any[][];
  const protection = {
    life: [lifeRow(client, life.clientCoverage, life.clientEarnedIncome, life.clientEarner), coClient ? lifeRow(coClient, life.coClientCoverage, life.coClientEarnedIncome ?? cf.inflows.coClient, life.coClientEarner) : null].filter(Boolean) as {
      who: string;
      name: string;
      has: number;
      min: number;
      max: number;
      income: number;
      multiple: number[];
    }[],
    umbrella: { has: km.ratios.umbrella.currentCoverage as number, recommended: km.ratios.umbrella.recommendedCoverage as number },
    exposed: {
      liquid: (km.protection.umbrellaInsurance?.assetExposed?.totalLiquidAssets ?? 0) as number,
      property: (exposedRows.find((r) => r[0] === "Total")?.[3] ?? 0) as number,
      incomes: cf.inflows.total as number,
    },
    disability: (fh.profile.insurance as any[]).filter((i) => i.type === "LONG_TERM_DI").length,
    insurance: (fh.profile.insurance as any[]).map((i) => ({ name: i.name as string, type: i.type as string, owner: i.owner?.[0] as string, coverage: i.coverage })),
    owes: km.debtManagement.debtOverview.debtBalance as number,
    college: collegeGoal ? kidsRaw.length * collegeGoal.amount : 0,
  };

  /* ---------- Debt ---------- */
  const debts = ((km.debtManagement.listOfDebts ?? []) as any[][]).slice(1).map((r) => ({ name: r[0] as string, kind: r[1] as string, balance: r[2] as number, rate: r[3] as number, monthly: r[4] as number, interest: r[5] as number }));
  debts.sort((a, b) => b.rate - a.rate);
  const card = debts.find((d) => d.kind === "Credit card" && d.balance > 0);
  const debt = {
    list: debts,
    total: km.debtManagement.debtOverview.debtBalance as number,
    card: card ? { ...card, payoff: km.ratios.creditCardDebt?.ccPayoffDate ? month(km.ratios.creditCardDebt.ccPayoffDate) : null } : null,
    dti: km.ratios.debtToIncome.ratio as number,
  };

  /* ---------- Competing needs ---------- */
  const eduGap = val(km.facts.education?.fundingGap);
  const eduExtra = val(km.facts.education?.extraYearlySaving);
  const lifeShort = protection.life.reduce((s, l) => s + Math.max(0, l.min - l.has), 0);
  const tension = {
    free: retirement.free,
    needs: [
      ...(retirement.extraPerYear > 0 ? [{ key: "retire", label: "Retirement", amount: retirement.extraPerYear, unit: "a year more" }] : []),
      ...(cushion.gap > 0 ? [{ key: "cash", label: "Cash cushion", amount: cushion.gap, unit: "to build up" }] : []),
      ...(eduExtra && eduExtra > 0 ? [{ key: "college", label: "College", amount: Math.round(eduExtra), unit: "a year more, rising" }] : []),
      ...(chartGoals.some((g) => g.goalType === "PURCHASE") ? [(() => { const g = (fh.goals.goalsSummary as any[]).find((x) => x.goalType === "PURCHASE"); return { key: "purchase", label: `Buying ${String(g.value).replace(/^Plan to purchase /, "").replace(/ for .*/, "")}`, amount: (g.amount ?? null) as number | null, unit: `in ${chartGoals.find((x) => x.goalType === "PURCHASE").date.slice(0, 4)}` }; })()] : []),
      ...(lifeShort > 0 || protection.umbrella.has < protection.umbrella.recommended ? [{ key: "protect", label: "Life and umbrella cover", amount: null as number | null, unit: "premium not in the plan" }] : []),
    ].slice(0, 4) as { key: string; label: string; amount: number | null; unit: string }[],
    collegeGap: eduGap !== null ? Math.round(eduGap) : null,
  };

  /* ---------- Persona ---------- */
  const persona = readPersona(personaMd);

  /* ---------- Risk ---------- */
  const allocAccts = ikm.allocationBenchmarkAnalysis.accounts as any[];
  const retAcct = (name: string) => allocAccts.find((a) => /401|IRA/i.test(String(a.accountName)) && String(a.accountName).includes(name) && a.currentEF?.equity !== undefined && a.benchmarkEF?.equity !== undefined);
  const riskScale = ["Conservative", "Income", "Moderate", "Growth", "Aggressive"];
  const cls = persona.classification;
  const t = (s?: string) => (s ? titleCase(s.toLowerCase()) : "");
  const risk = {
    scale: riskScale,
    people: adultsRaw
      .map((m) => {
        const a = retAcct(m.first_name);
        return a ? { who: String(m.first_name).toLowerCase(), name: m.first_name as string, says: m.risk_profile as string, stocks: a.currentEF.equity as number, benchmark: a.benchmarkEF.equity as number } : null;
      })
      .filter(Boolean) as { who: string; name: string; says: string; stocks: number; benchmark: number }[],
    household: { stocks: ia.analysis.summary.assetAllocation.currentEFC.equity as number, target: ia.analysis.summary.assetAllocation.targetEFC.equity as number },
    readings: [
      { label: "What you say", value: t(cls.D4a) },
      { label: "What you hold", value: t(cls.D4b) },
      { label: "What your whole picture adds up to", value: t(cls.D4c) },
    ],
    alignment: t(cls.D4),
    reasons: [
      ...(cushion.months < cushion.minMonths ? [`Cash for ${cushion.months} months`] : []),
      ...(lifeShort > 0 ? ["Life cover below the range"] : []),
      ...(protection.umbrella.has < protection.umbrella.recommended ? ["No umbrella policy"] : []),
      ...(card ? [`A ${(card.rate * 100).toFixed(1)}% card`] : []),
      ...(retirement.contributing === 0 ? ["Nothing going into retirement accounts"] : []),
      ...(free < 0 ? ["Spending more than comes in"] : []),
    ],
  };

  const ownership = {
    accounts: (fh.profile.accounts as any[]).map((a) => ({ name: a.name as string, owner: a.owner as string[], balance: a.balance as number, yearly: (a.yearly_contribution_total ?? 0) as number })),
    liabilities: (fh.profile.liabilities as any[]).map((l) => ({ name: l.name as string, owner: (l.owner ?? []) as string[], balance: l.balance as number })),
  };

  /* ---------- Investments ---------- */
  const efc = (o: any) => ({ stocks: (o?.equity ?? 0) as number, bonds: (o?.fixedIncome ?? 0) as number, cash: (o?.cash ?? 0) as number });
  const cdiv = ikm.concentrationAndDiversification;
  const ipa = ikm.performanceAnalysis;
  const portfolio = {
    now: efc(ia.analysis.summary.assetAllocation.currentEFC),
    target: efc(ia.analysis.summary.assetAllocation.targetEFC),
    value: ipa.household.aum as number,
    return3y: ipa.household.return3yAnnualized as number,
    worstFall: ipa.household.maxDrawdown3y as number,
    recoveryDays: ipa.household.maxDrawdownRecoveryDays as number,
    tech: (cdiv.sectorConcentration?.[1]?.[1] ?? 0) as number,
    us: (cdiv.geographyByRegion?.[1]?.[1] ?? 0) as number,
    holdings: (ia.positions as any[]).map((p) => ({ account: p.account as string, ticker: (p.ticker || "Cash") as string, name: p.name as string, category: (p.category ?? "") as string, value: p.value as number })),
  };

  /* ---------- Writing ---------- */
  const fn = fh.narrative;
  const inn = ia.narrative;
  const writing = {
    summary: fn.summary_main as string,
    recommendations: fn.summary_recommendations as string,
    retirement: fn.retirement_short_observations as string,
    retirementLook: fn.retirement_what_to_look_into as string,
    assets: fn.assets_short_observations as string,
    assetsLook: fn.assets_what_to_look_into as string,
    debt: fn.debt_short_observations as string,
    debtLook: fn.debt_what_to_look_into as string,
    savings: fn.savings_short_observations as string,
    savingsLook: fn.savings_what_to_look_into as string,
    protectionIntro: fn.protection_intro as string,
    emergency: fn.protection_emergency_fund_short_observations as string,
    life: fn.protection_life_insurance_short_observations as string,
    umbrella: fn.protection_umbrella_short_observations as string,
    invSummary: inn.summary_main as string,
    invSnapshot: inn.snapshot_main as string,
    invIntro: inn.portfolio_today_intro as string,
    invJobs: inn.portfolio_today_what_it_needs_to_do as string,
    invDoing: inn.portfolio_today_what_its_actually_doing as string,
    invTimeline: inn.portfolio_today_performance_timeline as string,
    invWorking: inn.portfolio_today_whats_working as string,
    invPriorities: inn.portfolio_today_priorities as string,
    invVerdict: inn.portfolio_today_verdict as string,
    invHsa: inn.portfolio_today_also_meaningful as string,
    invRecs: inn.recommendations_main as string,
    invScenarios: inn.recommendations_scenarios as string,
  };

  const recFirst = String(fn.summary_recommendations ?? "").trim().split(/\n+- /)[0].replace(/^- /, "");
  const cut = recFirst.search(/(, since|, because|, which|: )/);
  const firstStep = {
    title: cut > 0 ? recFirst.slice(0, cut) : recFirst,
    detail: cut > 0 ? recFirst.slice(cut + 2).replace(/^\w/, (c) => c.toUpperCase()) : "",
  };

  const goals = {
    list: (fh.goals.goalsSummary as any[]).map((g) => ({ type: g.goalType as string, text: g.value as string, amount: (g.amount ?? null) as number | null })),
    chart: chartGoals.filter((g) => g.name).map((g) => ({ name: g.name as string, type: g.goalType as string, from: year(g.date), to: g.termDate ? year(g.termDate) : null })),
  };

  const retGoal = (fh.profile.goals as any[]).find((g) => g.type === "RETIREMENT");
  const retirementIncome = {
    streams: (fh.profile.incomes as any[])
      .filter((i) => i.type !== "SALARY_AND_WAGES")
      .map((i) => ({ name: String(i.name).replace("Survivor Benefit of", "Survivor benefit,"), who: i.owner?.[0] as string, yearly: Math.round(i.yearly), from: i.starts as number, to: i.ends as number })),
    health: ((retGoal?.yearly_costs ?? []) as any[]).map((c) => ({ who: String(c.name).replace("Retirement health costs of ", ""), yearly: Math.round(c.yearly), from: c.from_year as number, to: c.to_year as number })),
    ssAverage: Math.round(km.retirementAndOtherGoals.guaranteedIncome?.[1]?.[2] ?? 0),
    totalDraw: Math.round(km.retirementAndOtherGoals.withdrawals?.supplementalTotalWithdrawals ?? 0),
  };

  const assetRows = ((km.assetsAndInvestments.listOfAssets ?? []) as any[][]).slice(1);
  const homeAsset = ownedAssets.find((a) => a.type === "PRIMARY_HOME");
  const re = km.debtManagement.realEstate;
  const netWorth = ownedAssets.reduce((s, a) => s + a.value, 0) + (fh.profile.accounts as any[]).reduce((s, a) => s + a.balance, 0) - (fh.profile.liabilities as any[]).reduce((s, l) => s + l.balance, 0);
  const assets = {
    rows: assetRows.filter((r) => r[2] > 0).map((r) => ({ type: r[0] as string, count: r[1] as number, value: r[2] as number, equity: r[4] as number, shareOfNetWorth: r[5] as number })),
    total: assetRows.reduce((s, r) => s + r[2], 0) as number,
    netWorth,
    home: homeAsset && re ? { value: homeAsset.value as number, equity: re.realEstateEquity as number, share: re.percentageOfRealEstateEquity as number, low: re.realEstateEquityThreshold1 as number, high: re.realEstateEquityThreshold2 as number } : null,
  };

  const dti = km.ratios.debtToIncome;
  const freeRow = netWorthPath.find((r) => r.debts === 0);
  const debtRatios = {
    ratios: [
      { label: "Debt payments", sub: "Debt-to-income", value: (dti.debtOnlyDti ?? 0) as number },
      { label: "Home and debt together", sub: "Housing-obligations ratio", value: (dti.ratio ?? 0) as number },
      { label: "Home alone", sub: "Housing ratio", value: (km.ratios.housingRatio?.ratio ?? 0) as number },
    ],
    lines: [0.36, 0.43, 0.5],
    monthly: (dti.monthlyDebtPayments ?? 0) as number,
    debtFree: freeRow ? { year: freeRow.year, age: freeRow.age } : null,
    ofIncome: (km.debtManagement.debtOverview.percentageOfDebtOverGrossIncome ?? 0) as number,
  };

  const outflowDetail = (cf.outflows.items as any[]).map((g) => ({ name: g.name as string, total: g.total as number, items: ((g.items ?? []) as any[]).map((i) => ({ name: i.name as string, total: i.total as number })) }));

  const savingNow = {
    rate: (ikm.savingsAndContributions.currentSavings?.currentSavingsRate ?? 0) as number,
    total: (ikm.savingsAndContributions.currentSavings?.reportedAnnualSavings ?? cashflow.savingSplit.reduce((s, x) => s + x.amount, 0)) as number,
    split: cashflow.savingSplit,
    retirement: (km.savingsAndExpenses.annualSavings?.currentAnnualSavingsAtRetirementAccounts ?? 0) as number,
  };

  const kidsEdu = ((km.assetsAndInvestments.listOfChildrenAndEducationGoals ?? []) as any[][]).slice(1);
  const acc529 = (fh.profile.accounts as any[]).filter((a) => /529/.test(a.account_type));
  const college =
    collegeGoal && kidsEdu.length
      ? {
          kids: kidsEdu.map((r) => ({ name: r[0] as string, age: r[1] as number, span: String(r[2]), yearsTo: r[3] as number, perYear: r[4] as number, stocks: (num(r[5]) ?? 0) as number })),
          balance: acc529.reduce((s, a) => s + a.balance, 0) as number,
          yearly: acc529.reduce((s, a) => s + (a.yearly_contribution_total ?? 0), 0) as number,
          accounts: (fh.profile.accounts as any[]).filter((a) => /529|Custodial/i.test(a.account_type + a.name)).map((a) => ({ name: a.name as string, balance: a.balance as number })),
          perChild: collegeGoal.amount as number,
          gap: tension.collegeGap,
          extra: eduExtra !== null && eduExtra > 0 ? Math.round(eduExtra) : null,
        }
      : null;

  const cur = ia.analysis.portfolioAnalysis.allocationSnapshot;
  const tgt = ia.analysis.targetAnalysis.allocationSnapshot;
  const proposal = {
    rows: [
      { label: "Stocks / bonds", now: `${Math.round(cur.allocation.ef.equity * 100)} / ${Math.round(cur.allocation.ef.fixedIncome * 100)}`, next: `${Math.round(tgt.allocation.ef.equity * 100)} / ${Math.round(tgt.allocation.ef.fixedIncome * 100)}`, a: cur.allocation.ef.equity, b: tgt.allocation.ef.equity, kind: "share" },
      { label: "Expected return a year", now: ikm.portfolioAnalysis?.performance?.expectedPerformance, next: ikm.targetAnalysis?.performance?.expectedPerformance, kind: "pct" },
      { label: "Return over the last 3 years, a year", now: cur.allocation.annualReturn, next: tgt.allocation.annualReturn, kind: "pct" },
      { label: "How much it swings", now: cur.allocation.standardDeviation, next: tgt.allocation.standardDeviation, kind: "pct" },
      { label: "Worst fall in 3 years", now: ipa.household.maxDrawdown3y, next: ikm.targetAnalysis?.maxDrawdown, kind: "pct" },
      { label: "Return for each unit of risk", now: ipa.household.sharpe3y, next: ikm.targetAnalysis?.sharpe, kind: "num" },
    ].filter((r) => r.now !== undefined && r.next !== undefined && r.now !== null && r.next !== null) as { label: string; now: number | string; next: number | string; kind: string; a?: number; b?: number }[],
    classes: (() => {
      const order = ["U.S. Equity", "Non-U.S. Equity", "U.S. Fixed Income", "Non-U.S. Fixed Income", "Cash"];
      const w = (rows: any[], l: string) => rows.find((r) => r.label === l)?.weight ?? 0;
      return order.map((l) => ({ label: l, now: w(cur.rows, l) as number, next: w(tgt.rows, l) as number }));
    })(),
    benchmark: ((ikm.targetBenchmarkComposition ?? []) as any[]).map((b) => ({ ticker: b.ticker as string, name: b.name as string, weight: b.weight as number })),
  };

  const performance = {
    you: { cumulative: ipa.household.return3yCumulative, yearly: ipa.household.return3yAnnualized, swing: ipa.household.volatility3y, worst: ipa.household.maxDrawdown3y, sharpe: ipa.household.sharpe3y },
    same: { cumulative: ipa.sameRiskBenchmark.return3yCumulative, yearly: ipa.sameRiskBenchmark.return3yAnnualized, swing: ipa.sameRiskBenchmark.volatility3y, worst: ipa.sameRiskBenchmark.maxDrawdown3y, sharpe: ipa.sameRiskBenchmark.sharpe3y },
    up: ipa.household.upsideCapture3y as number,
    down: ipa.household.downsideCapture3y as number,
    recovery: ipa.household.maxDrawdownRecoveryDays as number,
    window: { from: ipa.window.startDate as string, to: ipa.window.endDate as string },
    accounts: ((ipa.goalGroups ?? []) as any[]).flatMap((g) => g.accounts ?? []).map((a: any) => ({ name: a.name as string, balance: a.balance as number, yearly: a.return3yAnnualized as number, swing: a.volatility3y as number })).filter((a) => typeof a.yearly === "number"),
    gap: { total: (ipa.gapDecomposition?.totalGapDollars ?? 0) as number, mix: (ipa.gapDecomposition?.assetAllocationGapDollars ?? 0) as number, funds: (ipa.gapDecomposition?.productPickingGapDollars ?? 0) as number },
  };

  const drawdowns = (ipa.perEventDrawdowns ?? []) as any[];
  const market = {
    events: (ia.analysis.events as any[]).map((e) => {
      const d = drawdowns.find((x) => x.eventTitle === e.name);
      return { name: e.name as string, date: e.startDate as string, impact: e.portfolioImpact as string, type: e.type as string, text: e.description as string, you: d ? (d.household.returnDuringPct as number) : null, same: d ? (d.sameRiskBenchmark.returnDuringPct as number) : null };
    }),
    periods: (ia.analysis.periods as any[]).map((p) => ({ name: p.name as string, from: p.startDate as string, to: p.endDate as string, theme: p.theme as string, text: p.portfolioExperience as string })),
    // Only the Johnsons' report chart was read (page 17); the JSON doesn't carry these.
    scenarios:
      slug === "daniel-emily-johnson"
        ? [
            { name: "Post-crisis bull run", when: "Apr 2009 to Apr 2011", now: 0.513, next: 0.333 },
            { name: "Global financial crisis", when: "Oct 2007 to Mar 2009", now: -0.204, next: -0.099 },
            { name: "Global equity sell-off", when: "Sep 2018 to Dec 2018", now: -0.066, next: -0.079 },
            { name: "COVID-19 crash", when: "Feb 2020 to Mar 2020", now: -0.126, next: -0.127 },
          ]
        : [],
  };

  const exposure = {
    sectors: ((cdiv.sectorConcentration ?? []) as any[][]).slice(1).map((r) => ({ name: r[0] as string, weight: r[1] as number, limit: r[2] as string, flag: r[3] as string })),
    regions: ((cdiv.geographyByRegion ?? []) as any[][]).slice(1).map((r) => ({ name: r[0] as string, weight: r[1] as number })),
  };

  const roll = (ikm.taxDragAnalysis?.householdRollup ?? []) as any[][];
  const fall = (ikm.savingsAndContributions.savingsWaterfall ?? []) as any[][];
  const hsa = ikm.savingsAndContributions.taxOpportunityCheck.hsaCheck;
  const matches = fall.filter((r) => /employer match/i.test(String(r[1])) && typeof r[3] === "number" && r[3] > 0);
  const buckets3 = ((ikm.savingsAndContributions.taxOpportunityCheck.annualTaxSavingsByBucket ?? []) as any[][]).slice(1).filter((r) => num(r[5]));
  const taxes = {
    dragCost: (num(roll[1]?.[1]) ?? 0) as number,
    rate: retirement.taxRate,
    onTable: [
      ...matches.map((r, i) => ({ label: `${adultsRaw[i]?.first_name ?? "Your"}'s estimated employer match`, amount: r[3] as number, sure: false })),
      ...buckets3.map((r) => ({
        label: r[1] === "401k" ? "Less tax from filling the 401(k)" + (household.couple ? "s" : "") : r[1] === "HSA" ? (hsa?.hasHsa ? "Less tax from topping up the HSA" : "Less tax from an HSA, if your health plan qualifies") : `Less tax from ${r[1]}`,
        amount: r[5] as number,
        sure: r[1] !== "HSA" || Boolean(hsa?.hasHsa),
      })),
    ].filter((x) => x.amount > 0),
    hsaMax: (hsa?.maxContribution ?? 0) as number,
  };

  const waterfall = fall.slice(1).map((r) => ({
    step: r[0] as number,
    name: r[1] as string,
    now: typeof r[2] === "number" ? (r[2] as number) : null,
    target: typeof r[3] === "number" ? (r[3] as number) : null,
    status: (typeof r[3] === "number" ? r[4] : "Not for you") as string,
    estimated: r[6] === "Estimated",
  }));

  const accs = fh.profile.accounts as any[];
  const sumBy = (f: (a: any) => boolean) => ({ amount: accs.filter(f).reduce((s, a) => s + a.balance, 0) as number, count: accs.filter(f).length });
  const buckets = [
    { label: "Retirement, tax later", note: "401(k), traditional IRA", ...sumBy((a) => a.tax_treatment === "TAX_DEFERRED") },
    { label: "Retirement, tax-free", note: "Roth", ...sumBy((a) => /Roth/i.test(a.account_type + a.name)) },
    { label: "Health, tax-free", note: "HSA", ...sumBy((a) => /HSA/.test(a.account_type)) },
    { label: "Education", note: "529, custodial", ...sumBy((a) => /529|Custodial|UTMA|UGMA/i.test(a.account_type + a.name)) },
    { label: "Investing, taxed", note: "Brokerage", ...sumBy((a) => /Brokerage/i.test(a.account_type)) },
    { label: "Cash", note: "Checking and savings", ...sumBy((a) => /Checking|Savings account|Money market/i.test(a.account_type)) },
  ];

  const assumptions = {
    inflation: [
      { label: "Prices in general", value: 0.03 },
      { label: "Healthcare", value: 0.05 },
      { label: "Education", value: 0.05 },
    ],
    lifeExpectancy: retirement.endAge,
    byProfile: [
      { label: "Capital preservation", value: 0.0586 },
      { label: "Conservative", value: 0.0667 },
      { label: "Moderate", value: 0.073 },
      { label: "Growth", value: 0.0776 },
      { label: "Dynamic", value: 0.0818 },
    ],
  };

  const snapshot = {
    income: cashflow.income,
    netWorth,
    investable: accs.filter((a) => !/Checking|Savings account/.test(a.account_type)).reduce((s, a) => s + a.balance, 0) as number,
    debt: debt.total,
    monthly: debtRatios.monthly,
    filing: String(fh.case.tax_filing_status).replace("_", " ").toLowerCase(),
    salaryShare: netWorth > 0 ? cashflow.income / netWorth : 0,
  };

  return {
    household, score, cashflow, cushion, yearly, retirement, timeline, protection, debt, tension, risk, ownership, portfolio, firstStep,
    writing, goals, netWorthPath, retirementIncome, assets, debtRatios, outflowDetail, savingNow, college, proposal, performance, market, exposure, taxes, waterfall, buckets, assumptions, snapshot, persona,
  };
}

export type Plan = ReturnType<typeof buildPlan>;

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// The persona is Markdown: D0–D6, concerns O1…, tensions T1…, and a classification block.
function readPersona(md: string) {
  const classification: Record<string, string> = {};
  const block = md.match(/```classification([\s\S]*?)```/)?.[1] ?? "";
  for (const line of block.split("\n")) {
    const m = line.match(/^(D\d[a-c]?):\s*(.+)$/);
    if (m) classification[m[1]] = m[2].trim();
  }
  const sections = md
    .split(/\n## /)
    .slice(1)
    .map((s) => {
      const [head, ...rest] = s.split("\n");
      return { head: head.trim(), body: rest.join("\n").replace(/```[\s\S]*?```/g, "").trim() };
    });
  const dims: PersonaDim[] = sections
    .filter((s) => /^D\d/.test(s.head))
    .map((s) => {
      const [code, name] = s.head.split(": ");
      const first = s.body.match(/^([A-Z][A-Z ]+)\./);
      return { code, name, value: classification[code] ?? (first ? first[1] : ""), text: (first ? s.body.slice(first[0].length) : s.body).trim() };
    });
  const items = (head: string) =>
    (sections.find((s) => s.head === head)?.body ?? "")
      .split("\n- ")
      .map((l) => l.replace(/^- /, "").trim())
      .filter(Boolean)
      .map((l) => {
        // Two layouts appear across personas: "**O1: Title (LEVEL).**" and "**O1 LEVEL: Title.**".
        const a = l.match(/^\*\*([OT]\d+)(?::\s*([^(*]+))?\s*\(([A-Z]+)\):?\.?\*\*\s*([\s\S]*)$/);
        if (a) return { code: a[1], title: (a[2] ?? "").trim(), level: a[3], text: a[4].trim() };
        const b = l.match(/^\*\*([OT]\d+)\s+([A-Z]+):?\s*([^*]*?)\.?\*\*\s*([\s\S]*)$/);
        if (b) return { code: b[1], title: b[3].trim(), level: b[2], text: b[4].trim() };
        return null;
      })
      .filter((x): x is PersonaItem => Boolean(x));
  return {
    dims,
    classification,
    concerns: items("Objective concerns"),
    tensions: items("Tensions"),
    subjective: sections.find((s) => s.head === "Subjective concerns")?.body ?? "",
    unknown: sections.find((s) => s.head === "Subjective concerns")?.body ?? "",
    alerts: sections.find((s) => s.head === "Transition alerts")?.body ?? "",
  };
}
