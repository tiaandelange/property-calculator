import { irrBisection, solveIrrPeriodicCashFlows } from "../../../shared/calculatorShared/irrSolver";

describe("irrSolver", () => {
  test("bisection finds root for textbook two-period flow", () => {
    const cf = [-1000, 1100];
    const r = irrBisection(cf, { low: -0.5, high: 2, tol: 1e-8, maxIter: 1000 });
    expect(r).not.toBeNull();
    const npv = cf.reduce((s, c, t) => s + c / Math.pow(1 + r!, t), 0);
    expect(Math.abs(npv)).toBeLessThan(1e-5);
  });

  test("golden growth-mode-equivalent series yields ~22.78% per year", () => {
    const fv = 2_700_000 * Math.pow(1.06, 25);
    const netSale = fv - fv * 0.05 - 1_900_000;
    const cf0 = -80_000;
    const mid = Array.from({ length: 24 }, () => 6000);
    const finalYear = 6_000 + netSale;
    const cashFlows = [cf0, ...mid, finalYear];
    const irr = solveIrrPeriodicCashFlows(cashFlows);
    expect(irr).not.toBeNull();
    const pct = (irr as number) * 100;
    expect(pct).toBeGreaterThan(22.7);
    expect(pct).toBeLessThan(22.9);
  });

  test("returns null when all flows same sign", () => {
    expect(solveIrrPeriodicCashFlows([-100, -50, -20])).toBeNull();
    expect(solveIrrPeriodicCashFlows([100, 200, 300])).toBeNull();
  });
});
