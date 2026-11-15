const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const html = fs.readFileSync(require("node:path").join(__dirname, "../index.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const context = vm.createContext({});
vm.runInContext(script.slice(0, script.indexOf("// ------------------------------------------------------------ 画面")) + script.slice(script.indexOf("const DAY_FROM"), script.indexOf("const daySim =")) + "globalThis.Model = DaySim; globalThis.config = dayConfig;", context);
test("opening stops ongoing registration and prevents new assignments", () => {
  const model = new context.Model({ ...context.config, preStaff: 2 });
  model.clock = 719;
  const complete = { id: 1, arrived: 600, beingRegistered: true, registered: false };
  const unfinished = { id: 2, arrived: 600, beingRegistered: true, registered: false };
  model.queue.push(complete); model.queue.push(unfinished);
  model.desks = [{ customer: complete, ends: 720 }, { customer: unfinished, ends: 721 }];
  model.nextArrival = Infinity;
  model.advance(1);
  assert.equal(complete.registered, true);
  assert.equal(unfinished.registered, false);
  assert.equal(unfinished.beingRegistered, false);
  assert.equal(model.desks.length, 0);
  model.config.preStaff = 6; model.syncDesks(); model.assignDesks();
  assert.equal(model.desks.length, 0);
  model.advance(30); assert.equal(model.registered, 1);
});
test("simulation stops at 13:00 and preserves unfinished customers", () => {
  const model = new context.Model({ ...context.config, arrivals: { 10: 600, 11: 600, 12: 600 } });
  model.advance(120);
  const registered = model.registered;
  model.advance(1000);
  assert.equal(model.clock, 780);
  assert.equal(model.registered, registered);
  assert.equal(model.arrived, model.served + model.queue.length + model.busyCount());
  assert.ok(model.queue.length > 0);
  const snapshot = JSON.stringify(model);
  model.advance(1000); assert.equal(JSON.stringify(model), snapshot);
});
test("zero arrivals stops at 13:00 and reset restores preopening state", () => {
  const model = new context.Model({ ...context.config, arrivals: { 10: 0, 11: 0, 12: 0 } });
  model.advance(500); assert.equal(model.clock, 780); assert.equal(model.arrived, 0);
  model.reset(); assert.equal(model.clock, 600); assert.equal(model.desks.length, 3);
});

test("opening schedule supports 4000 arrivals per hour and 30 lanes", () => {
  const model = new context.Model({ ...context.config, arrivals: { 10: 4000, 11: 4000, 12: 4000 }, windows: { 12: 30 } });
  model.advance(120);
  assert.equal(model.servers.length, 30);
  assert.ok(model.arrived > 7000);
  model.advance(60);
  assert.equal(model.clock, 780);
  assert.equal(model.arrived, model.served + model.queue.length + model.servers.filter(Boolean).length);
});

test("opening windows count continuous service and reset after waiting", () => {
  const model = new context.Model({ ...context.config, preStaff: 0, arrivals: { 10: 0, 11: 0, 12: 0 }, windows: { 12: 1 } });
  model.advance(120);
  model.exponential = () => 0.125;
  for (let i = 1; i <= 105; i++) model.queue.push({ id: i, arrived: 720, registered: false });
  model.dispatch();
  model.advance(99 * 0.125);
  assert.equal(model.servers[0].streak, 100);
  model.advance(2);
  assert.equal(model.servers[0], null);
  model.queue.push({ id: 106, arrived: model.clock, registered: false });
  model.dispatch();
  assert.equal(model.servers[0].streak, 1);
});

test("live lane changes preserve clock and customers before and after opening", () => {
  const model = new context.Model({ ...context.config, arrivals: { 10: 600, 11: 600, 12: 600 }, windows: { 12: 6 } });
  model.advance(60);
  model.config.windows[12] = 30; model.applyWindows();
  assert.equal(model.clock, 660);
  assert.equal(model.servers.length, 0);
  model.advance(60);
  assert.equal(model.servers.length, 30);
  const arrived = model.arrived, served = model.served;
  for (const lanes of [1, 10, 30]) {
    model.config.windows[12] = lanes; model.applyWindows();
    assert.equal(model.clock, 720);
    assert.equal(model.servers.length, lanes);
    assert.equal(model.arrived, arrived);
    assert.equal(model.served, served);
    assert.equal(model.arrived, model.served + model.queue.length + model.busyCount());
  }
});
