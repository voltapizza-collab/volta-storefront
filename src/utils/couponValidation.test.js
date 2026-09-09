import { createCouponValidationController } from "./couponValidation";

const pending = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { resolve, promise }; };
test("only the latest cart response can commit", async () => {
  const controller = createCouponValidationController(), old = pending(), latest = pending(), commit = jest.fn();
  const first = controller.run("cart-1", () => old.promise, commit);
  await Promise.resolve();
  const second = controller.run("cart-2", () => latest.promise, commit);
  await Promise.resolve(); latest.resolve(7); await second;
  old.resolve(5); expect(await first).toBeNull();
  expect(commit.mock.calls).toEqual([[7]]);
});
test("removing a coupon prevents its pending result from reapplying", async () => {
  const controller = createCouponValidationController(), response = pending(), commit = jest.fn();
  const request = controller.run("coupon", () => response.promise, commit);
  await Promise.resolve(); controller.invalidate(); response.resolve(5);
  expect(await request).toBeNull(); expect(commit).not.toHaveBeenCalled();
});
test("same cart deduplicates requests and commits, while retry starts new work", async () => {
  const controller = createCouponValidationController(), load = jest.fn(async () => 5), commit = jest.fn();
  await Promise.all([controller.run("cart", load, commit), controller.run("cart", load, commit)]);
  expect(load).toHaveBeenCalledTimes(1); expect(commit).toHaveBeenCalledTimes(1);
  controller.invalidate(); await controller.run("cart", load, commit);
  expect(load).toHaveBeenCalledTimes(2);
});
test("rendered cart context invalidates a result before the next effect runs", async () => {
  const controller = createCouponValidationController(), response = pending(), commit = jest.fn();
  let current = true;
  const request = controller.run("cart", () => response.promise, commit, () => current);
  await Promise.resolve(); current = false; response.resolve(5); await request;
  expect(commit).not.toHaveBeenCalled();
});
test("invalidating before the request starts prevents its loading side effects", async () => {
  const controller = createCouponValidationController(), load = jest.fn();
  const request = controller.run("cart", load, jest.fn()); controller.invalidate(); await request;
  expect(load).not.toHaveBeenCalled();
});
