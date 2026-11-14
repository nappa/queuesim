const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const html = fs.readFileSync(require("node:path").join(__dirname, "../index.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
const context = vm.createContext({});
vm.runInContext(script.slice(script.indexOf("function makeRng"), script.indexOf("const clamp")) +
  script.slice(script.indexOf("class BottleneckSim"), script.indexOf("const bKeys")) +
  "globalThis.Model = BottleneckSim;", context);
const config = { arrival: 140, phone: 0, walk: 1.2, slow: 0.4, width: 3, neck: 3, pass: true };
function run(overrides = {}, minutes = 3) {
  const sim = new context.Model({ ...config, ...overrides });
  for (let i = 0; i < minutes * 600; i++) {
    sim.advance(1 / 600);
    assert.equal(sim.arrived, sim.people.length + sim.pending.length + sim.exited + sim.excess);
    assert.equal(new Set(sim.people.map(p => p.x * 4 + p.lane)).size, sim.people.length);
    assert.ok(sim.people.every(p => sim.allowed(p.x, p.lane)));
  }
  return sim;
}
test("all lane widths preserve people, occupancy and walls", () => {
  for (let width = 1; width <= 4; width++) for (let neck = 1; neck <= width; neck++) {
    run({ width, neck, phone: 50, pass: false }, 1);
    run({ width, neck, phone: 50, pass: true }, 1);
  }
});
test("zero arrivals and stopped arrivals drain correctly", () => {
  assert.equal(run({ arrival: 0 }).arrived, 0);
  const sim = run({ phone: 30, neck: 1 }, 1);
  sim.config.arrival = 0;
  sim.advance(15);
  assert.equal(sim.arrived, sim.exited);
});
test("bottlenecks and phone walking reduce throughput with identical arrivals", () => {
  const clear = run(), neck = run({ neck: 1 }), phone = run({ phone: 30 }), both = run({ phone: 30, neck: 1 });
  for (const sim of [neck, phone, both]) {
    assert.equal(sim.arrived, clear.arrived);
    assert.ok(sim.exited < clear.exited);
  }
  console.log(Object.fromEntries(Object.entries({ clear, neck, phone, both }).map(([k, s]) => [k, { arrivals: s.arrived, exits: s.exited, waiting: s.pending.length }])));
});
test("restarts reproduce results and frame size does not alter model", () => {
  const a = run({ neck: 1, phone: 30 }, 1);
  const b = new context.Model({ ...config, neck: 1, phone: 30 });
  b.advance(1);
  assert.equal(JSON.stringify(a.people), JSON.stringify(b.people));
});
