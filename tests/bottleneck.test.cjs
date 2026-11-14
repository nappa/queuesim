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
test("live parameter changes preserve clock, counts, history and existing people", () => {
  const sim = run({ phone: 100 }, 1);
  const people = [...sim.people, ...Array.from({ length: sim.pending.length }, (_, i) => sim.pending.at(i))];
  const state = [sim.clock, sim.arrived, sim.exited, sim.travel, sim.excess, sim.hazard, sim.remainder];
  const history = JSON.stringify(sim.history);
  sim.setConfig({ ...sim.config, arrival: 0, phone: 0, walk: 1.8, slow: 1.2, pass: false });
  assert.deepEqual([sim.clock, sim.arrived, sim.exited, sim.travel, sim.excess, sim.hazard, sim.remainder], state);
  assert.equal(JSON.stringify(sim.history), history);
  assert.ok(people.every(p => p.phone));
  sim.advance(20);
  assert.equal(sim.arrived, sim.exited);
});
test("live geometry changes preserve people without overlaps or wall occupants", () => {
  const sim = run({ width: 4, neck: 4, phone: 100, slow: 0.1 }, 2);
  const born = new Map([...sim.people, ...Array.from({ length: sim.pending.length }, (_, i) => sim.pending.at(i))].map(p => [p, p.born]));
  const clock = sim.clock, arrived = sim.arrived;
  for (const width of [1, 4, 2, 3, 1, 4]) for (let neck = 1; neck <= width; neck++) {
    sim.setConfig({ ...sim.config, width, neck });
    assert.equal(sim.clock, clock); assert.equal(sim.arrived, arrived);
    assert.equal(sim.arrived, sim.people.length + sim.pending.length + sim.exited + sim.excess);
    assert.equal(new Set(sim.people.map(p => p.x * 4 + p.lane)).size, sim.people.length);
    assert.ok(sim.people.every(p => sim.allowed(p.x, p.lane)));
    for (const p of sim.people) assert.equal(p.born, born.get(p));
    for (let i = 0; i < sim.pending.length; i++) assert.equal(sim.pending.at(i).born, born.get(sim.pending.at(i)));
  }
  sim.setConfig({ ...sim.config, arrival: 0, slow: 1.2 });
  sim.advance(30); assert.equal(sim.arrived, sim.exited);
});
