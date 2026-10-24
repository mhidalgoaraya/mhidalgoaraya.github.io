# Reference outputs of the Julia closed forms (TMP-RobustKalman/src/experiments/outlier_change/analytic.jl) on a fixed
# seed, for test/check.mjs. Also writes ../welllog.json (the scaled well-log series and the consensus reference level,
# exactly as in e4_welllog.jl). Run: julia test/check.jl [path to TMP-RobustKalman]   (then: node test/check.mjs)
using Random, Statistics, Printf
repo = length(ARGS) >= 1 ? ARGS[1] : joinpath(homedir(), "Documents", "PhD", "Repositories", "TMP-RobustKalman")
include(joinpath(repo, "src", "experiments", "outlier_change", "analytic.jl"))
here = @__DIR__
jarr(v) = "[" * join((isnan(x) ? "null" : @sprintf("%.17g", x) for x in v), ",") * "]"

# synthetic sequence: the paper's figure setting (Q/R = 0.02, outlier at 50, step at 110, both 6√R) plus noise events
rng = MersenneTwister(5); T = 160; Q = 0.02
x = cumsum(randn(rng, T) .* sqrt(Q)); y = x .+ randn(rng, T)
y[50] += 6.0; x[110:end] .+= 6.0; y[110:end] .+= 6.0
cases = [("kf", kf_filter(y; Q)),
         ("st", tmp_filter(y; Q, aO = 2.0, tT = false, lag = 0, nit = 50)),
         ("st_ref", student_t_filter(y; Q, ν = 4.0, nit = 50)),
         ("ot", tmp_filter(y; Q, aO = 8.0, aT = 0.25, lag = 1, nit = 50)),
         ("ot3", tmp_filter(y; Q, aO = 2.0, aT = 0.5, lag = 3, nit = 20))]
open(joinpath(here, "ref.json"), "w") do io
    print(io, "{\"y\":", jarr(y))
    for (k, r) in cases
        print(io, ",\"$k\":{\"xh\":", jarr(r.xh), ",\"gO\":", jarr(r.gO))
        hasproperty(r, :xs) && print(io, ",\"xs\":", jarr(r.xs), ",\"gT\":", jarr(r.gT))
        print(io, "}")
    end
    println(io, "}")
end

# well-log, scaled as in e4_welllog.jl; consensus change points and running-median reference level
DX = joinpath(repo, "src", "data_external"); NTR = 338
yraw = parse.(Float64, readlines(joinpath(DX, "well_log_y.csv")))
ann = Dict(begin k, v = split(l, ","); String(k) => parse.(Int, split(v, ";")) end for l in readlines(joinpath(DX, "well_log_annotations.csv")))
Tw = length(yraw)
σ̂ = 1.4826 * median(abs.(diff(yraw[1:NTR]) .- median(diff(yraw[1:NTR])))) / sqrt(2)
yw = round.((yraw .- median(yraw[1:NTR])) ./ σ̂, digits = 4)   # rounded as shipped, so JS and Julia read the same numbers
allcp = reduce(vcat, values(ann))
cons = sort(unique([c for c in allcp if count(k -> any(abs.(ann[k] .- c) .<= 2), collect(keys(ann))) >= 3]))
cons = [c for (i, c) in enumerate(cons) if i == 1 || c - cons[i-1] > 2]
ref = zeros(Tw); bounds = vcat(0, cons, Tw)
for i = 1:length(bounds)-1
    a, b = bounds[i] + 1, bounds[i+1]
    for t = a:b; ref[t] = median(yw[max(a, t - 4):min(b, t + 4)]); end
end
# paper configs at delay L = 3 (e4/e4_welllog.csv): KF Q 0.1; Student-t Q 1, aO 4; TMP-OT Q 0.1, aO 0.5, aT 0.25
wk = tmp_filter(yw; Q = 0.1, tO = false, tT = false, lag = 3)
ws = tmp_filter(yw; Q = 1.0, aO = 4.0, tT = false, lag = 3, nit = 50)
wo = tmp_filter(yw; Q = 0.1, aO = 0.5, aT = 0.25, lag = 3, nit = 50)
r4(v) = "[" * join((@sprintf("%.4f", x) for x in v), ",") * "]"
open(joinpath(here, "..", "welllog.json"), "w") do io
    print(io, "{\"y\":", r4(yw), ",\"ref\":", r4(ref), ",\"cps\":[", join(cons, ","), "],\"ntrain\":", NTR,
          ",\"scale\":", @sprintf("%.1f", σ̂), "}")
end
open(joinpath(here, "ref_welllog.json"), "w") do io
    print(io, "{\"kf\":", jarr(wk.xs), ",\"st\":", jarr(ws.xs), ",\"ot\":", jarr(wo.xs), ",\"gO\":", jarr(wo.gO), ",\"gT\":", jarr(wo.gT), "}")
end
rm_(v) = sqrt(mean((v[NTR+1:end] .- ref[NTR+1:end]) .^ 2))
@printf("well-log RMSE, evaluation half: KF %.3f  Student-t %.3f  TMP-OT %.3f (paper: 0.93, 0.59, 0.36)\n", rm_(wk.xs), rm_(ws.xs), rm_(wo.xs))
