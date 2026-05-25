/** Periodic IRR: find annual rate r such that Σₜ CFₜ/(1+r)ᵗ = 0 (t = 0…n). */

function npvDiscrete(cashFlows: number[], r: number): number {
  return cashFlows.reduce((acc, c, t) => acc + c / Math.pow(1 + r, t), 0);
}

/** Bisection on NPV(r); requires bracket where NPV endpoints have opposite signs (or zero). */
export function irrBisection(
  cashFlows: number[],
  opts?: { low?: number; high?: number; tol?: number; maxIter?: number }
): number | null {
  const low = opts?.low ?? -0.999;
  const high = opts?.high ?? 10;
  const tol = opts?.tol ?? 1e-7;
  const maxIter = opts?.maxIter ?? 1000;

  if (!(high > low) || low <= -1 + 1e-12) return null;

  const npv = (r: number) => npvDiscrete(cashFlows, r);
  let a = low;
  let b = high;
  let fa = npv(a);
  let fb = npv(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb)) return null;
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) return null;

  for (let i = 0; i < maxIter; i++) {
    const m = (a + b) / 2;
    const fm = npv(m);
    if (!Number.isFinite(fm)) return null;
    if (Math.abs(fm) < tol || Math.abs(b - a) < tol) return m;
    if (fa * fm < 0) {
      b = m;
      fb = fm;
    } else {
      a = m;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

/**
 * Robust IRR for discrete annual flows: bisection brackets up to 1000% return + coarse scan for sign changes.
 * Returns null if no root found or flows lack both positive and negative values.
 */
export function solveIrrPeriodicCashFlows(cashFlows: number[]): number | null {
  if (cashFlows.length < 2) return null;
  const hasPos = cashFlows.some((c) => c > 0);
  const hasNeg = cashFlows.some((c) => c < 0);
  if (!hasPos || !hasNeg) return null;

  const brackets = [
    { low: -0.999, high: 10 },
    { low: -0.999, high: 50 },
    { low: -0.999, high: 100 },
    { low: -0.999, high: 500 },
    { low: -0.999, high: 2500 }
  ];
  for (const b of brackets) {
    const r = irrBisection(cashFlows, { ...b, tol: 1e-7, maxIter: 1000 });
    if (r != null && Number.isFinite(r) && r > -1 + 1e-9) return r;
  }

  const scanRates: number[] = [];
  for (let k = -999; k < -500; k += 20) scanRates.push(k / 1000);
  for (let k = -500; k <= -50; k += 25) scanRates.push(k / 100);
  scanRates.push(-0.49, -0.48, -0.46, -0.44, -0.42, -0.38, -0.34, -0.3, -0.26, -0.22, -0.18, -0.14, -0.1, -0.06, -0.02, 0);
  for (let hp = 1; hp <= 400; hp++) scanRates.push(hp / 100);
  scanRates.push(4.25, 5.5, 7, 9, 12, 17, 24, 35, 50, 75, 110, 170, 260, 400, 650, 1000);

  let prevR = scanRates[0]!;
  let prevV = npvDiscrete(cashFlows, prevR);
  for (let i = 1; i < scanRates.length; i++) {
    const r = scanRates[i]!;
    const v = npvDiscrete(cashFlows, r);
    if (!Number.isFinite(prevV) || !Number.isFinite(v)) {
      prevR = r;
      prevV = v;
      continue;
    }
    if (prevV === 0) return prevR;
    if (v === 0) return r;
    if (prevV * v < 0) {
      const lo = Math.min(prevR, r);
      const hi = Math.max(prevR, r);
      const sol = irrBisection(cashFlows, { low: lo, high: hi, tol: 1e-7, maxIter: 1000 });
      if (sol != null && Number.isFinite(sol) && sol > -1 + 1e-9) return sol;
    }
    prevR = r;
    prevV = v;
  }

  return null;
}
