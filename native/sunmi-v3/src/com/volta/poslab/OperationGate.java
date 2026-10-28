package com.volta.poslab;

/** One gate for queued native requests, physical printing and installation. */
public final class OperationGate {
    private int operations;
    private boolean maintenance;
    private boolean draining;
    public synchronized boolean enter() {
        if (maintenance || draining) return false;
        operations++;
        return true;
    }
    public synchronized void leave() {
        if (operations <= 0) throw new IllegalStateException("Unbalanced POS operation");
        operations--;
        notifyAll();
    }
    public synchronized boolean beginMaintenance() {
        if (maintenance || draining || operations != 0) return false;
        maintenance = true;
        return true;
    }
    /** Bound the drain without abandoning in-flight writes or physical printing. */
    public synchronized boolean drainAndBeginMaintenance(long timeoutMs) throws InterruptedException {
        if (maintenance || draining) return false;
        draining = true;
        long deadline = System.nanoTime() + Math.max(0, Math.min(timeoutMs, 30000)) * 1000000;
        try {
            while (operations > 0) {
                long remaining = deadline - System.nanoTime();
                if (remaining <= 0) return false;
                wait(Math.max(1, remaining / 1000000));
            }
            maintenance = true;
            return true;
        } finally { draining = false; }
    }
    public synchronized int operationCount() { return operations; }
    public synchronized void endMaintenance() { maintenance = false; notifyAll(); }
    public synchronized boolean isMaintenance() { return maintenance; }
}
