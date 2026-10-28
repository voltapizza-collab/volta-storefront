import com.volta.poslab.OperationGate;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public class OperationGateTest {
    static void check(boolean condition) { if (!condition) throw new AssertionError(); }
    public static void main(String[] args) throws Exception {
        OperationGate gate = new OperationGate();
        check(gate.enter()); check(gate.enter()); // queued request + asynchronous printer
        check(!gate.beginMaintenance()); gate.leave(); check(!gate.beginMaintenance());
        gate.leave(); check(gate.beginMaintenance()); check(!gate.enter()); check(!gate.beginMaintenance());
        gate.endMaintenance(); check(gate.enter()); gate.leave();
        boolean caught = false; try { gate.leave(); } catch (IllegalStateException expected) { caught = true; }
        check(caught);
        ExecutorService workers = Executors.newFixedThreadPool(2);
        try {
            OperationGate draining = new OperationGate();
            check(draining.enter());
            Future<Boolean> drain = workers.submit(() -> draining.drainAndBeginMaintenance(2000));
            long until = System.nanoTime() + TimeUnit.SECONDS.toNanos(1);
            boolean rejected = false;
            while (System.nanoTime() < until) {
                if (!draining.enter()) { rejected = true; break; }
                draining.leave(); Thread.yield();
            }
            check(rejected); check(!drain.isDone()); // async print still owns the gate
            check(!draining.beginMaintenance());
            draining.leave(); check(drain.get()); check(!draining.enter()); draining.endMaintenance();
            check(draining.enter());
            check(!draining.drainAndBeginMaintenance(1)); // timeout never discards a print
            check(draining.operationCount() == 1); check(draining.enter());
            draining.leave(); draining.leave();
            for (int i = 0; i < 1000; i++) {
                OperationGate race = new OperationGate(); CountDownLatch start = new CountDownLatch(1);
                AtomicInteger owners = new AtomicInteger();
                Future<?> request = workers.submit(() -> { try { start.await(); if (race.enter()) owners.incrementAndGet(); } catch (InterruptedException e) { throw new RuntimeException(e); } });
                Future<?> update = workers.submit(() -> { try { start.await(); if (race.beginMaintenance()) owners.incrementAndGet(); } catch (InterruptedException e) { throw new RuntimeException(e); } });
                start.countDown(); request.get(); update.get(); check(owners.get() == 1);
            }
        } finally { workers.shutdownNow(); }
        System.out.println("OperationGate: queued operations, async print and 1000 concurrent races passed");
    }
}
