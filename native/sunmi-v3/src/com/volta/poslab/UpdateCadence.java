package com.volta.poslab;

import java.util.Calendar;

/** Local terminal days, so reminders survive restarts and daylight-saving changes. */
public final class UpdateCadence {
    public static String day(Calendar clock) {
        return clock.get(Calendar.YEAR) + "-" + clock.get(Calendar.DAY_OF_YEAR);
    }
    public static boolean discoveryDue(boolean opened, String lastDay, Calendar clock) {
        return opened || (clock.get(Calendar.HOUR_OF_DAY) >= 15 && !day(clock).equals(lastDay));
    }
    public static boolean reminderDue(boolean available, String decision, long until, boolean opened,
                                      String lastDay, Calendar clock) {
        boolean approved = ("scheduled".equals(decision) || "now".equals(decision)) && until > clock.getTimeInMillis();
        return available && !approved && !day(clock).equals(lastDay) &&
            (opened || clock.get(Calendar.HOUR_OF_DAY) >= 15);
    }
}
