package com.volta.poslab;

/** Pure admission policy: scheduling never grants indefinite authorization. */
public final class UpdateConsent {
    public static final long NOW_WINDOW = 15 * 60_000L;
    public static final long SCHEDULE_WINDOW = 60 * 60_000L;
    public static final long MAX_SCHEDULE = 30 * 24 * 60 * 60_000L;
    public static boolean allows(String target, int store, String approvedTarget, int approvedStore,
                                 String decision, long scheduledAt, long until, long now) {
        return store > 0 && store == approvedStore && target != null && target.equals(approvedTarget) &&
            ("now".equals(decision) || "scheduled".equals(decision)) && scheduledAt <= now && now < until;
    }
    public static long deadline(String decision, long scheduledAt, long now) {
        if ("pending".equals(decision)) return 0;
        if ("now".equals(decision)) return now + NOW_WINDOW;
        if (!"scheduled".equals(decision) || scheduledAt <= now || scheduledAt > now + MAX_SCHEDULE)
            throw new IllegalArgumentException("invalid_update_schedule");
        return scheduledAt + SCHEDULE_WINDOW;
    }
}
