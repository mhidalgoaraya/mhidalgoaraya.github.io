// Closed-form 1-D local-level filters, ported line by line from TMP-RobustKalman
// src/experiments/outlier_change/analytic.jl (window_post, solve_window, tmp_filter, kf_filter, student_t_filter).
// Units-invariant TMP: prior Ga(a, a) on each weight, q(γO) = Ga(aO + ½, aO + ½ E[e²]/R), q(γT) = Ga(aT + ½, aT + ½ E[w²]/Q).
// Checked against the Julia reference by test/check.mjs (max abs difference printed there).
(function (root) {
  "use strict";
  const NIT = 20;

  // inverse of a small symmetric positive-definite matrix (Gauss-Jordan with partial pivoting)
  function inv(A) {
    const n = A.length, M = A.map((r, i) => { const o = r.slice(); for (let j = 0; j < n; j++) o.push(i === j ? 1 : 0); return o; });
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (p !== c) { const t = M[p]; M[p] = M[c]; M[c] = t; }
      const d = M[c][c]; for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f !== 0) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
    }
    return M.map(r => r.slice(n));
  }

  /** Gaussian posterior over (x_0, x_1..x_n) given N(m0, P0) on x_0 and effective noise variances. */
  function windowPost(m0, P0, ys, gO, gT, Q, R) {
    const n = ys.length, L = [], h = new Array(n + 1).fill(0);
    for (let i = 0; i <= n; i++) L.push(new Array(n + 1).fill(0));
    L[0][0] += 1 / P0; h[0] += m0 / P0;
    for (let s = 0; s < n; s++) {
      const qv = Q / gT[s], rv = R / gO[s], i = s, j = s + 1;
      L[i][i] += 1 / qv; L[j][j] += 1 / qv; L[i][j] -= 1 / qv; L[j][i] -= 1 / qv;
      L[j][j] += 1 / rv; h[j] += ys[s] / rv;
    }
    const C = inv(L), mu = C.map(r => r.reduce((a, v, k) => a + v * h[k], 0));
    return { mu, C };
  }

  /** Mean-field fixed-iteration solve of the window; returns {gO, gT} for every window step. */
  function solveWindow(m0, P0, ys, Q, R, aO, aT, tO, tT, nit) {
    const n = ys.length, gO = new Array(n).fill(1), gT = new Array(n).fill(1);
    if (!(tO || tT)) return { gO, gT };
    for (let it = 0; it < nit; it++) {
      const { mu, C } = windowPost(m0, P0, ys, gO, gT, Q, R);
      for (let s = 0; s < n; s++) {
        if (tO) { const Ee = (ys[s] - mu[s + 1]) ** 2 + C[s + 1][s + 1]; gO[s] = (aO + 0.5) / (aO + 0.5 * Ee / R); }
        if (tT) { const Ew = (mu[s + 1] - mu[s]) ** 2 + C[s + 1][s + 1] + C[s][s] - 2 * C[s][s + 1]; gT[s] = (aT + 0.5) / (aT + 0.5 * Ew / Q); }
      }
    }
    return { gO, gT };
  }

  /** Streaming TMP filter. Step t is decided once y_{t..t+lag} is in (the next `lag` readings choose the explanation).
   *  tO/tT temper the observation/transition factor; both false = Kalman filter. */
  class Tracker {
    constructor({ Q, R = 1, aO = 2, aT = 2, tO = true, tT = true, lag = 0, nit = NIT }) {
      Object.assign(this, { Q, R, aO, aT, tO, tT, lag, nit });
      this.y = []; this.xh = []; this.xs = []; this.gO = []; this.gT = []; this.z = []; this.m = 0; this.P = R;
    }
    get done() { return this.xh.length; }          // number of decided steps
    push(v) { this.y.push(v); while (this.done < this.y.length && this.done + this.lag < this.y.length) this.step(this.lag); }
    finish() { while (this.done < this.y.length) this.step(Math.min(this.lag, this.y.length - 1 - this.done)); }
    step(n) {
      const t = this.done, y = this.y;
      if (t === 0) { this.m = y[0]; this.P = this.R; this.xh.push(this.m); this.xs.push(this.m); this.gO.push(1); this.gT.push(1); this.z.push(0); return; }
      const { Q, R } = this, m = this.m, P = this.P, win = y.slice(t, t + n + 1);
      this.z.push((y[t] - m) / Math.sqrt(P + Q + R));
      const w = solveWindow(m, P, win, Q, R, this.aO, this.aT, this.tO, this.tT, this.nit);
      const gO = w.gO[0], gT = w.gT[0];
      let xs = n === 0 ? NaN : windowPost(m, P, win, w.gO, w.gT, Q, R).mu[1];
      const Pp = P + Q / gT, K = Pp / (Pp + R / gO);
      this.m = m + K * (y[t] - m); this.P = (1 - K) * Pp;
      if (isNaN(xs)) xs = this.m;
      this.xh.push(this.m); this.xs.push(xs); this.gO.push(gO); this.gT.push(gT);
    }
  }

  /** Batch version, identical to tmp_filter(y; Q, R, aO, aT, tO, tT, lag, nit) in analytic.jl (rule = false). */
  function tmpFilter(y, opts) { const f = new Tracker(opts); for (const v of y) f.push(v); f.finish(); return f; }
  const kfFilter = (y, { Q, R = 1 }) => tmpFilter(y, { Q, R, tO: false, tT: false });

  /** Variational Student-t filter (Piché et al. 2012), ν = 2aO: independent implementation for the check. */
  function studentTFilter(y, { Q, R = 1, nu = 4, nit = NIT }) {
    let m = y[0], P = R; const xh = [m], lam = [1];
    for (let t = 1; t < y.length; t++) {
      const Pp = P + Q; let l = 1;
      for (let k = 0; k < nit; k++) {
        const K = Pp / (Pp + R / l), mb = m + K * (y[t] - m), Pb = (1 - K) * Pp;
        l = (nu + 1) / (nu + ((y[t] - mb) ** 2 + Pb) / R);
      }
      const K = Pp / (Pp + R / l); m = m + K * (y[t] - m); P = (1 - K) * Pp; xh.push(m); lam.push(l);
    }
    return { xh, gO: lam };
  }

  const api = { Tracker, tmpFilter, kfFilter, studentTFilter, windowPost, solveWindow, NIT };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.TMP = api;
})(typeof self !== "undefined" ? self : this);
