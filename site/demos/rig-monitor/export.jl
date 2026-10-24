# Export the SKAB rig monitor's analysis of a few files to compact JSON for the web demo (a replay, not a live model).
# Re-runnable: julia export.jl [round tag] [model code dir]     e.g. julia export.jl r6c
# The model code dir holds run.jl and rig_model.jl. Default: the SKAB-TMP repo (src/) if present, else the old location
# in TMP-RobustKalman (src/experiments/skab_rig). Change RIG below to point elsewhere.
# Reads the round's fitted model (out/model_<tag>.jls, located through run.jl's own OUT) and reuses run.jl's set-up code
# (everything before its calibration section), so a new round exports without changes here. The monitor is re-run on
# each file with one addition: it also records the healthy-rig one-step prediction and its standard deviation per
# channel (the band).
using Printf, Serialization
const REPOS = joinpath(homedir(), "Documents", "PhD", "Repositories")
const RIG = length(ARGS) >= 2 ? ARGS[2] :
    first(filter(d -> isfile(joinpath(d, "run.jl")), [joinpath(REPOS, "SKAB-TMP", "src"), joinpath(REPOS, "SKAB-TMP"),
                                                       joinpath(REPOS, "TMP-RobustKalman", "src", "experiments", "skab_rig")]))
tag = length(ARGS) >= 1 ? ARGS[1] : "r4"
println("model code: $RIG, round $tag")
OUTDIR = joinpath(@__DIR__, "data"); mkpath(OUTDIR)

# 1. run.jl's set-up (data, normal fit, thermal mode, thermal_for), with ARGS = [tag]
src = read(joinpath(RIG, "run.jl"), String)
cut = findfirst(r"\n# -+ calibration", src); cut === nothing && error("run.jl: calibration marker not found")
empty!(ARGS); push!(ARGS, tag)
include_string(Main, src[1:first(cut)], joinpath(RIG, "run.jl"))
M = deserialize(joinpath(OUT, "model_$tag.jls"))   # OUT is defined by run.jl
cvO, τ, KWm = M.cvO, M.τ, M.KW

# 2. the monitor, with the prediction band recorded (text patch of rig_model.jl's monitor; fails loudly if it moved)
ms = read(joinpath(RIG, "rig_model.jl"), String)
a = findfirst("function monitor(", ms); b = findnext(r"\nend\n", ms, last(a))
code = ms[first(a):last(b)]
for (old, new) in (("function monitor(", "function monitor_band("),
                   ("out = (pN = ones(T),", "out = (yhat = zeros(T, D), ysd = zeros(T, D), pN = ones(T),"),
                   ("out.gO[t] = γ", "out.gO[t] = γ; out.yhat[t, :] = c .+ C * xp; out.ysd[t, :] = sqrt.(max.(diag(C * Pp * C' + Rl), 0))"))
    occursin(old, code) || error("rig_model.jl monitor: anchor not found: $old")
    global code = replace(code, old => new; count = 1)
end
include_string(Main, code, joinpath(RIG, "rig_model.jl"))

# 3. the files of the demo
const PICK = [("valve1/15.csv", "valve", "Valve closure", "SKAB valve1/15: the valve at the pump inlet is closed, then reopened."),
              ("other/3.csv", "leak", "Leak", "SKAB other/3: water is let out of the loop (a simulated leak), then the leak stops."),
              ("other/7.csv", "rotor", "Rotor imbalance", "SKAB other/7: a weight unbalances the pump rotor in one step."),
              ("anomaly-free/anomaly-free.csv", "normal", "Normal running", "SKAB anomaly-free run, a 20-minute stretch with no fault.")]
const FREE = 4001:5200          # the anomaly-free stretch (rows of anomaly-free.csv)
const UNITS = ["g", "g", "A", "bar", "°C", "°C", "V", "L/min"]
jn(v, d) = "[" * join((isfinite(x) ? (d == 0 ? string(round(Int, x)) : @sprintf("%.*f", d, x)) : "null" for x in v), ",") * "]"
jstr(s) = "\"" * replace(s, "\\" => "\\\\", "\"" => "\\\"") * "\""
index = String[]
for (rel, key, title, note) in PICK
    st, Y, an, cpt = read_skab(joinpath(SK, rel))
    if key == "normal"; st, Y, an, cpt = st[FREE], Y[FREE, :], an[FREE], cpt[FREE]; end
    T = size(Y, 1); μ = vec(mean(Y[1:400, :], dims = 1)); σ = vec(std(Y[1:400, :], dims = 1)); σ[σ .== 0] .= 1
    Z = standardise(Y)
    Sg = signatures(F; L = KWm.L, thermal = thermal_for(Y))
    r, al = monitor_band(Z, F, Sg; τ, cvO, KWm...)
    ch = ["{\"name\":$(jstr(SHORT[i])),\"unit\":$(jstr(UNITS[i])),\"mu\":$(@sprintf("%.6g", μ[i])),\"sd\":$(@sprintf("%.6g", σ[i])),\"z\":$(jn(Z[:, i], 2)),\"m\":$(jn(r.yhat[:, i], 2)),\"s\":$(jn(r.ysd[:, i], 2))}" for i = 1:D]
    alj = String[]
    for x in al
        hasproperty(x, :reported) && !x.reported && continue
        push!(alj, "{\"t\":$(x.t - 1),\"onset\":$(x.onset - 1),\"kind\":$(jstr(x.kind)),\"ch\":$(x.ch - 1),\"partner\":$(hasproperty(x, :partner) ? x.partner - 1 : -1),\"size\":$(@sprintf("%.3g", x.sz)),\"text\":$(jstr(finding(x)))}")
    end
    # the experimenters' fault interval (SKAB labels), shown as the answer key
    iv = Int[]; for t = 1:T; (an[t] == 1) != (t > 1 && an[t-1] == 1) && push!(iv, t - 1); end
    an[end] == 1 && push!(iv, T)
    out = "{\"file\":$(jstr(rel)),\"key\":$(jstr(key)),\"title\":$(jstr(title)),\"note\":$(jstr(note)),\"round\":$(jstr(tag)),\"start\":$(jstr(st[1])),\"T\":$T,\"ntrain\":400," *
          "\"labels\":$(jn(iv, 0)),\"channels\":[" * join(ch, ",") * "]," *
          "\"pN\":$(jn(r.pN, 3)),\"pstep\":$(jn(r.pstep, 3)),\"pramp\":$(jn(r.pramp, 3)),\"pvar\":$(jn(r.pvar, 3)),\"prel\":$(jn(hasproperty(r, :prel) ? r.prel : zeros(T), 3))," *
          "\"gO\":$(jn(r.gO, 2)),\"alarms\":[" * join(alj, ",") * "]}"
    write(joinpath(OUTDIR, "$key.json"), out)
    push!(index, key)
    @printf("%-32s %5d rows, %3d findings, %6.0f kB\n", rel, T, length(alj), filesize(joinpath(OUTDIR, "$key.json")) / 1e3)
end
sc = joinpath(OUT, "score_$tag.txt")
line = isfile(sc) ? something(findfirst(l -> startswith(l, "| all"), split(read(sc, String), "\n")) |> i -> i === nothing ? "" : strip(split(read(sc, String), "\n")[i]), "") : ""
write(joinpath(OUTDIR, "meta.json"), "{\"round\":$(jstr(tag)),\"score\":$(jstr(line)),\"cvO\":$(cvO),\"tau\":$(jn(collect(τ), 3))}")
println("exported round $tag to $OUTDIR")
