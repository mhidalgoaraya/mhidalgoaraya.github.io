// AudioWorklet processor: the SEM-v2 hearing aid (sem.wasm) in the browser's audio thread. Microphone in, headphones
// out, at the AudioContext rate (sem_web.c resamples to 16 kHz and back). Messages from the page:
//   {type: "init", wasm: ArrayBuffer, iters}   {type: "set", theta, floor, volume, enhance}   {type: "calibrate"}
//   {type: "gain", value} (a stored calibration, dB)   {type: "record"} (start/stop)   {type: "context"} (the last 3 s)
// Messages to the page: {type: "ready", prime, rate}, {type: "state", s} ten times per second, {type: "context", s},
//   {type: "calibrated", ok, gain}, {type: "recording", input, output} (16 kHz Float32Arrays).
const NB = 17, VIEW = Math.round(16000 / 10 / 24), CONTEXT = 2000;    // 0.1 s and 3 s of 24-sample blocks

class SemProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.e = null; this.recording = false; this.frames = 0;
    this.port.onmessage = ev => this.onMessage(ev.data);
  }
  async onMessage(m) {
    if (m.type === "init") {
      const { instance } = await WebAssembly.instantiate(m.wasm, {});
      const e = instance.exports;
      e._initialize();
      const prime = e.web_init(m.iters || 5, sampleRate);
      this.io_in = new Float32Array(e.memory.buffer, e.web_in(), 4096);
      this.io_out = new Float32Array(e.memory.buffer, e.web_out(), 4096);
      this.e = e;
      this.port.postMessage({ type: "ready", prime, rate: sampleRate });
      return;
    }
    const e = this.e;
    if (!e) return;
    if (m.type === "set") e.web_set(m.theta, m.floor, m.volume, m.enhance ? 1 : 0);
    else if (m.type === "calibrate") e.web_calibrate();
    else if (m.type === "gain") e.web_set_in_gain(m.value);
    else if (m.type === "context") this.port.postMessage({ type: "context", s: this.state(CONTEXT) });
    else if (m.type === "record") {
      if (!this.recording) { e.web_rec_start(); this.recording = true; }
      else {
        const n = e.web_rec_stop(); this.recording = false;
        const input = new Float32Array(e.memory.buffer, e.web_rec_in(), n).slice();
        const output = new Float32Array(e.memory.buffer, e.web_rec_out(), n).slice();
        this.port.postMessage({ type: "recording", input, output }, [input.buffer, output.buffer]);
      }
    }
  }
  state(m) {                    // see web_state in sem_web.c
    const e = this.e, a = new Float64Array(e.memory.buffer, e.web_state(m), 8 + 6 * NB);
    const arr = k => Array.from(a.subarray(8 + k * NB, 8 + (k + 1) * NB));
    return { snr: a[0], presence: a[1], noise: a[2], level: a[3], blocks: a[4], underruns: a[5], input_gain: a[6],
             cal_progress: a[7], hz: arr(0), xi: arr(1), p: arr(2), gain: arr(3), y: arr(4), noise_band: arr(5),
             rec_s: e.web_rec_seconds(), recording: this.recording };
  }
  process(inputs, outputs) {
    const out = outputs[0][0];
    if (!out) return true;
    if (!this.e) { out.fill(0); return true; }
    const inp = inputs[0] && inputs[0][0], n = out.length;
    if (inp) this.io_in.set(inp); else this.io_in.fill(0, 0, n);
    this.e.web_process(n);
    for (let c = 0; c < outputs[0].length; c++) outputs[0][c].set(this.io_out.subarray(0, n));   // both ears
    this.frames += n;
    if (this.frames >= sampleRate / 10) {
      this.frames = 0;
      const s = this.state(VIEW), r = this.e.web_cal_result();
      this.port.postMessage({ type: "state", s });
      if (r) this.port.postMessage({ type: "calibrated", ok: r === 1, gain: s.input_gain });
    }
    return true;
  }
}
registerProcessor("sem-processor", SemProcessor);
