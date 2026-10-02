package com.volta.poslab;

/** One gate for queued native requests, physical printing and installation. */
public final class OperationGate {
    private int operations;
    private boolean maintenance;
    public synchronized boolean enter() {
        if (maintenance) return false;
        operations++;
        return true;
    }
    public synchronized void leave() {
        if (operations <= 0) throw new IllegalStateException("Unbalanced POS operation");
        operations--;
    }
    public synchronized boolean beginMaintenance() {
        if (maintenance || operations != 0) return false;
        maintenance = true;
        return true;
    }
    public synchronized void endMaintenance() { maintenance = false; }
    public synchronized boolean isMaintenance() { return maintenance; }
}
