import com.volta.poslab.UpdateConsent;

public class UpdateConsentTest {
    static void check(boolean condition) { if (!condition) throw new AssertionError(); }
    static boolean allowed(String decision, long at, long until, long now) {
        return UpdateConsent.allows("apk-a",2,"apk-a",2,decision,at,until,now);
    }
    public static void main(String[] args) {
        long now = 1_800_000_000_000L;
        check(!allowed("pending",0,0,now));
        check(!UpdateConsent.allows("apk-a",2,"",2,"now",now,now+1000,now));
        long deadline = UpdateConsent.deadline("now",now,now);
        check(allowed("now",now,deadline,now));
        check(!allowed("now",now,deadline,deadline));
        check(!UpdateConsent.allows("apk-b",2,"apk-a",2,"now",now,deadline,now));
        check(!UpdateConsent.allows("apk-a",3,"apk-a",2,"now",now,deadline,now));
        check(!UpdateConsent.allows("apk-a",-1,"apk-a",-1,"now",now,deadline,now));
        long scheduled = now+60000;
        deadline = UpdateConsent.deadline("scheduled",scheduled,now);
        check(!allowed("scheduled",scheduled,deadline,now));
        check(allowed("scheduled",scheduled,deadline,scheduled));
        check(allowed("scheduled",scheduled,deadline,deadline-1));
        check(!allowed("scheduled",scheduled,deadline,deadline));
        check(!allowed("pending",scheduled,deadline,scheduled)); // cancellation
        for (long invalid : new long[]{0,now,now-1,now+UpdateConsent.MAX_SCHEDULE+1}) {
            boolean rejected=false;
            try { UpdateConsent.deadline("scheduled",invalid,now); } catch(IllegalArgumentException expected) { rejected=true; }
            check(rejected);
        }
        boolean rejected=false;
        try { UpdateConsent.deadline("always",now,now); } catch(IllegalArgumentException expected) { rejected=true; }
        check(rejected);
        System.out.println("UpdateConsent: absent consent, cancellation, APK/store binding, schedule boundaries and expiry passed");
    }
}
