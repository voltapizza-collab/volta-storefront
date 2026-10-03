import com.volta.poslab.UpdateCadence;
import java.util.Calendar;
import java.util.TimeZone;

public class UpdateCadenceTest {
    static void check(boolean value) { if (!value) throw new AssertionError(); }
    public static void main(String[] args) {
        Calendar clock = Calendar.getInstance(TimeZone.getTimeZone("Europe/Madrid"));
        clock.clear(); clock.set(2026, Calendar.OCTOBER, 3, 10, 0);
        String today = UpdateCadence.day(clock);
        check(UpdateCadence.discoveryDue(true, today, clock)); // reopening forces discovery
        check(!UpdateCadence.discoveryDue(false, "", clock)); // no periodic morning poll
        clock.set(Calendar.HOUR_OF_DAY, 15);
        check(UpdateCadence.discoveryDue(false, "", clock));
        check(!UpdateCadence.discoveryDue(false, today, clock)); // already checked today
        check(UpdateCadence.reminderDue(true, "pending", 0, true, "", clock));
        check(!UpdateCadence.reminderDue(true, "pending", 0, true, today, clock)); // persisted across restarts
        long future = clock.getTimeInMillis() + 86400000L;
        check(!UpdateCadence.reminderDue(true, "scheduled", future, true, "", clock));
        check(!UpdateCadence.reminderDue(true, "now", future, true, "", clock));
        check(UpdateCadence.reminderDue(true, "scheduled", clock.getTimeInMillis(), true, "", clock));
        check(!UpdateCadence.reminderDue(false, "pending", 0, true, "", clock));
        clock.add(Calendar.DAY_OF_MONTH, 1);
        clock.set(Calendar.HOUR_OF_DAY, 14);
        check(!UpdateCadence.discoveryDue(false, today, clock));
        check(!UpdateCadence.reminderDue(true, "pending", 0, false, today, clock));
        check(UpdateCadence.reminderDue(true, "pending", 0, true, today, clock));
        clock.set(Calendar.HOUR_OF_DAY, 15);
        check(UpdateCadence.discoveryDue(false, today, clock));
        check(UpdateCadence.reminderDue(true, "pending", 0, false, today, clock));
        clock.set(2026, Calendar.OCTOBER, 25, 15, 0); // daylight-saving transition
        check(UpdateCadence.discoveryDue(false, "2026-297", clock));
        check(!UpdateCadence.discoveryDue(false, UpdateCadence.day(clock), clock));
        System.out.println("UpdateCadence: opening, local daily boundary, restart deduplication, DST and retained consent passed");
    }
}
