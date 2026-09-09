// A removed/replaced coupon invalidates pending work, even if its request completes later.
export function createCouponValidationController() {
  let generation = 0;
  let current = null;
  return {
    invalidate() { generation += 1; current = null; },
    run(key, load, commit, isCurrent = () => true) {
      if (current?.key === key) return current.promise;
      const version = ++generation;
      const promise = Promise.resolve().then(() => version === generation ? load() : null).then(value => {
        if (version !== generation) return null;
        if (!isCurrent()) { current = null; return null; }
        commit(value);
        return value;
      });
      current = { key, promise };
      return promise;
    },
  };
}
