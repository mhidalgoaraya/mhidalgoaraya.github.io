// Compare the JS port (../tmp.js) with the Julia closed forms. Run `julia test/check.jl` first, then `node test/check.mjs`.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const T = require("../tmp.js");
const here = new URL(".", import.meta.url);
const ref = JSON.parse(readFileSync(new URL("ref.json", here)));
const wl = JSON.parse(readFileSync(new URL("../welllog.json", here)));
const rw = JSON.parse(readFileSync(new URL("ref_welllog.json", here)));
let worst = 0, fail = false;
function cmp(name, a, b) {
  let d = 0;
  for (let i = 0; i < b.length; i++) if (b[i] !== null) d = Math.max(d, Math.abs(a[i] - b[i]));
  worst = Math.max(worst, d); const ok = d < 1e-9; fail ||= !ok;
  console.log(`${ok ? "ok  " : "FAIL"} ${name.padEnd(28)} max |JS − Julia| = ${d.toExponential(2)}`);
}
const y = ref.y, Q = 0.02;
const kf = T.kfFilter(y, { Q });
cmp("KF xh", kf.xh, ref.kf.xh);
const st = T.tmpFilter(y, { Q, aO: 2, tT: false, lag: 0, nit: 50 });
cmp("Student-t (TMP-O) xh", st.xh, ref.st.xh); cmp("Student-t (TMP-O) gO", st.gO, ref.st.gO);
const sr = T.studentTFilter(y, { Q, nu: 4, nit: 50 });
cmp("Student-t (Piché) xh", sr.xh, ref.st_ref.xh); cmp("TMP-O vs Piché (JS only)", st.xh, sr.xh);
for (const [k, o] of [["ot", { aO: 8, aT: 0.25, lag: 1, nit: 50 }], ["ot3", { aO: 2, aT: 0.5, lag: 3, nit: 20 }]]) {
  const r = T.tmpFilter(y, { Q, ...o });
  for (const f of ["xh", "xs", "gO", "gT"]) cmp(`TMP-OT ${k} ${f}`, r[f], ref[k][f]);
  // streaming = batch for every step whose window is complete
  const s = new T.Tracker({ Q, ...o }); y.forEach(v => s.push(v));
  cmp(`TMP-OT ${k} stream vs batch`, s.xs, r.xs.slice(0, s.xs.length));
}
const yw = wl.y;
cmp("well-log KF L=3", T.tmpFilter(yw, { Q: 0.1, tO: false, tT: false, lag: 3 }).xs, rw.kf);
cmp("well-log Student-t L=3", T.tmpFilter(yw, { Q: 1, aO: 4, tT: false, lag: 3, nit: 50 }).xs, rw.st);
const wo = T.tmpFilter(yw, { Q: 0.1, aO: 0.5, aT: 0.25, lag: 3, nit: 50 });
cmp("well-log TMP-OT L=3 xs", wo.xs, rw.ot); cmp("well-log TMP-OT gO", wo.gO, rw.gO); cmp("well-log TMP-OT gT", wo.gT, rw.gT);
console.log(`worst ${worst.toExponential(2)}: ${fail ? "FAILED" : "all within 1e-9"}`);
process.exit(fail ? 1 : 0);
