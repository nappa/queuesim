const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const html = fs.readFileSync(require("node:path").join(__dirname, "../index.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const context = vm.createContext({});
vm.runInContext(script.slice(0, script.indexOf("// ------------------------------------------------------------ 画面")) +
  script.slice(script.indexOf("class TutorialComparisonSim"), script.indexOf("const tutorialAnimations")) +
  "globalThis.Comparison = TutorialComparisonSim; globalThis.Network = TutorialNetwork;", context);
function snapshot(network) {
  return JSON.stringify({ clock: Math.round(network.clock * 1e9) / 1e9, arrived: network.arrived, exited: network.exited,
    stages: network.stages.map(({ model }) => [model.arrived, model.served, model.queue.items, model.queue.head, model.servers]) });
}
test("comparison shares arrival times and per-customer service requirements", () => {
  const models = [3, 4].map(servers => new context.Comparison({ arrivalsPerHour: 100, servicesPerHour: 30, servers, arrivalCv: 1 }));
  const samples = models.map(model => {
    const values = [], original = model.exponential.bind(model);
    model.exponential = mean => { const value = original(mean); values.push(value); return value; };
    return values;
  });
  for (let i = 0; i < 600; i++) {
    models.forEach(model => model.advance(0.1));
    assert.equal(models[0].arrived, models[1].arrived);
    assert.equal(models[0].nextArrival, models[1].nextArrival);
    for (const model of models) assert.equal(model.arrived, model.served + model.queue.length + model.busyCount());
  }
  const common = Math.min(...samples.map(values => values.length));
  assert.deepEqual(samples[0].slice(0, common), samples[1].slice(0, common));
  assert.ok(models[0].stats().avgWait > models[1].stats().avgWait);
});
test("network preserves people across stages and accumulates at the bottleneck", () => {
  const before = new context.Network("before", [60, 120, 120]);
  const after = new context.Network("after", [120, 120, 50]);
  for (let i = 0; i < 600; i++) {
    for (const network of [before, after]) {
      network.advance(0.1);
      const ids = [];
      for (const { model } of network.stages) {
        assert.equal(model.arrived, model.served + model.queue.length + model.busyCount());
        for (let j = 0; j < model.queue.length; j++) ids.push(model.queue.at(j).id);
        for (const slot of model.servers) if (slot) ids.push(slot.customer.id);
      }
      assert.equal(network.arrived, network.exited + ids.length);
      assert.equal(ids.length, new Set(ids).size);
      assert.equal(network.stages[1].model.arrived, network.stages[0].model.served);
      assert.equal(network.stages[2].model.arrived, network.stages[1].model.served);
    }
    assert.equal(before.arrived, after.arrived);
  }
  assert.ok(before.stages[0].model.queue.length > before.stages[1].model.queue.length);
  assert.ok(after.stages[2].model.queue.length > after.stages[1].model.queue.length);
});
test("network seek reproduces uninterrupted state and drains when arrivals stop", () => {
  const network = new context.Network("after", [120, 120, 50]);
  network.advance(30);
  const expected = snapshot(network);
  network.advance(30);
  network.reset();
  for (let i = 0; i < 300; i++) network.advance(0.1);
  assert.equal(snapshot(network), expected);
  network.nextArrival = Infinity;
  network.advance(600);
  assert.equal(network.arrived, network.exited);
});
