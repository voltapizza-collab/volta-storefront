package com.volta.poslab;

import android.app.*;
import android.content.*;
import android.content.pm.*;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import org.json.*;
import java.io.*;
import java.lang.ref.WeakReference;
import java.security.MessageDigest;
import java.util.concurrent.*;

/** Self-update uses platform TLS, device proofs and the installed APK signer.
 * The initial validation channel installs only during an operator-authorized
 * release window after the operator approves and local operations finish.
 */
public final class PosUpdater {
    public static final String RESULT_ACTION = "com.volta.poslab.UPDATE_RESULT";
    public static final OperationGate GATE = new OperationGate();
    private static PosUpdater instance;
    private final Context context;
    private final SharedPreferences prefs;
    private final ScheduledExecutorService worker = Executors.newSingleThreadScheduledExecutor();
    private WeakReference<PosActivity> activity = new WeakReference<>(null);
    private volatile boolean foreground, restored, ordersRead, printerReady, uiReady;
    private volatile Integer storeId;
    private volatile boolean busy;
    private int failures;
    private long nextAttempt;
    private volatile boolean checkOnOpen = true, noticeOnOpen = true;
    private volatile long lastOrdersRead, lastPrinterRead;
    private long lastHealthReport;
    private final Object decisionLock = new Object();

    private PosUpdater(Context value) {
        context = value.getApplicationContext(); prefs = preferences(context);
        if (configured()) {
            worker.execute(() -> {
                // Sessions interrupted before commit must not accumulate on disk.
                if (Build.VERSION.SDK_INT >= 31) try {
                    PackageInstaller installer = context.getPackageManager().getPackageInstaller();
                    for (PackageInstaller.SessionInfo session : installer.getMySessions())
                        if (!session.isSealed()) installer.abandonSession(session.getSessionId());
                } catch (Exception e) { android.util.Log.w("VoltaUpdate", "session_cleanup_pending"); }
            });
            worker.scheduleWithFixedDelay(this::tick, 10, 30, TimeUnit.SECONDS);
        }
    }
    public static synchronized PosUpdater get(Context context) {
        if (instance == null) instance = new PosUpdater(context);
        return instance;
    }
    static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences("volta-pos-updates-v1", Context.MODE_PRIVATE);
    }
    public static boolean configured() { return !ConnectionConfig.UPDATE_SERVER_URL.isEmpty(); }
    static long version(Context context) throws Exception {
        return context.getPackageManager().getPackageInfo(context.getPackageName(), 0).getLongVersionCode();
    }
    public void attach(PosActivity value) { activity = new WeakReference<>(value); restored = ordersRead = uiReady = printerReady = false; }
    public void visibility(PosActivity value, boolean visible) {
        if (activity.get() == value) {
            if (visible && !foreground) { checkOnOpen = true; noticeOnOpen = true; }
            foreground = visible;
        }
    }
    public void restored(JSONObject session) {
        Integer nextStore = session == null ? null : session.optInt("storeId");
        synchronized (decisionLock) {
            if (nextStore == null || prefs.getInt("approvedStore", -1) != nextStore)
                prefs.edit().remove("approvedSha").remove("approvedStore").remove("decision").remove("scheduledAt").remove("authorizedUntil").commit();
            storeId = nextStore;
        }
        restored = true;
        ordersRead = session == null;
    }
    public void ordersRead() { ordersRead = true; lastOrdersRead = System.currentTimeMillis(); }
    public void uiReady(boolean value) { uiReady = value; }
    public void printerReady(boolean value) { printerReady = value; lastPrinterRead = System.currentTimeMillis(); }
    public void checkSoon() { if (configured()) worker.execute(() -> { checkOnOpen = true; nextAttempt = 0; tick(); }); }
    public JSONObject status() throws Exception {
        JSONObject target = new JSONObject(prefs.getString("availableTarget", "{}"));
        boolean available = target.optLong("versionCode", 0) > version(context);
        return new JSONObject().put("configured", configured()).put("versionCode", version(context))
            .put("versionName", context.getPackageManager().getPackageInfo(context.getPackageName(), 0).versionName)
            .put("state", prefs.getString("state", "idle")).put("error", prefs.getString("error", ""))
            .put("canInstall", Build.VERSION.SDK_INT >= 31 && context.getPackageManager().canRequestPackageInstalls())
            .put("available", available).put("target", target.length() == 0 ? JSONObject.NULL : target)
            .put("reminderDue", UpdateCadence.reminderDue(available, prefs.getString("decision", "pending"),
                prefs.getLong("authorizedUntil", 0), noticeOnOpen, prefs.getString("lastNoticeDay", ""), java.util.Calendar.getInstance()))
            .put("blocked", available && target.optString("sha256").equals(prefs.getString("blockedSha", "")))
            .put("decision", prefs.getString("decision", "pending")).put("scheduledAt", prefs.getLong("scheduledAt", 0))
            .put("authorizedUntil", prefs.getLong("authorizedUntil", 0));
    }
    public JSONObject noticeSeen(String sha) throws Exception {
        synchronized (decisionLock) {
            JSONObject current = status();
            boolean claimed = foreground && current.optBoolean("reminderDue") &&
                sha.equals(current.getJSONObject("target").optString("sha256"));
            if (claimed) {
                if (!prefs.edit().putString("lastNoticeDay", UpdateCadence.day(java.util.Calendar.getInstance())).commit())
                    throw new IOException("update_state_not_saved");
                noticeOnOpen = false;
            }
            return new JSONObject().put("claimed", claimed);
        }
    }
    public JSONObject decide(JSONObject body, int verifiedStore) throws Exception {
        synchronized (decisionLock) {
            if (!foreground || storeId == null || storeId != verifiedStore) throw new IOException("update_session_changed");
            JSONObject target = new JSONObject(prefs.getString("availableTarget", "{}"));
            String sha = body.getString("sha256");
            if (!sha.equals(target.optString("sha256")) || target.optLong("versionCode") <= version(context))
                throw new IOException("update_target_changed");
            String decision = body.getString("decision");
            long now = System.currentTimeMillis();
            long at = "scheduled".equals(decision) ? body.getLong("scheduledAt") : now;
            long until = UpdateConsent.deadline(decision, at, now);
            if (!prefs.edit().putString("approvedSha",sha).putInt("approvedStore",verifiedStore)
                .putString("decision",decision).putLong("scheduledAt","pending".equals(decision) ? 0 : at)
                .putLong("authorizedUntil",until).commit()) throw new IOException("update_state_not_saved");
            save("scheduled".equals(decision) ? "scheduled" : "pending".equals(decision) ? "pending" : "waiting_safe", "");
        }
        worker.execute(() -> { report(prefs.getString("state","pending"), ""); nextAttempt = 0; checkOnOpen = true; tick(); });
        return status();
    }
    private boolean consentAllows(String sha, Integer actualStore) {
        return UpdateConsent.allows(sha, actualStore == null ? -1 : actualStore,
            prefs.getString("approvedSha", ""), prefs.getInt("approvedStore", -1), prefs.getString("decision", "pending"),
            prefs.getLong("scheduledAt", 0), prefs.getLong("authorizedUntil", 0), System.currentTimeMillis());
    }
    public void permission() {
        PosActivity current = activity.get();
        if (current != null && foreground && Build.VERSION.SDK_INT >= 26) current.runOnUiThread(() ->
            current.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + context.getPackageName()))));
    }
    private void save(String state, String error) {
        if (!prefs.edit().putString("state", state).putString("error", error).putLong("stateAt", System.currentTimeMillis()).commit())
            throw new IllegalStateException("update_state_not_saved");
        android.util.Log.i("VoltaUpdate", state + (error.isEmpty() ? "" : ":" + error));
    }
    private void report(String state, String error) {
        try { sendReport(context, new JSONObject().put("state", state).put("error", error.isEmpty() ? JSONObject.NULL : error)
            .put("foreground", foreground).put("printerReady", printerReady).put("storeId", storeId == null ? JSONObject.NULL : storeId)
            .put("decision",prefs.getString("decision","pending")).put("scheduledAt",prefs.getLong("scheduledAt",0))
            .put("authorizedUntil",prefs.getLong("authorizedUntil",0)).put("approvedSha",prefs.getString("approvedSha", ""))); }
        catch (Exception e) { android.util.Log.w("VoltaUpdate", "report_pending"); }
    }
    static void sendReport(Context context, JSONObject body) throws Exception {
        body.put("versionCode", version(context)).put("targetVersionCode", preferences(context).getLong("targetVersion", 0));
        // BroadcastReceiver.goAsync has a short execution budget. Reports are
        // best effort; normal catalogue/download requests use longer timeouts.
        new PosClient(context).updateRequest("POST", "/report", body, 4000);
    }
    private void transition(String state, String error) {
        if (!state.equals(prefs.getString("state", "")) || !error.equals(prefs.getString("error", ""))) {
            save(state, error); report(state, error);
        }
    }
    private void releaseMaintenance() {
        GATE.endMaintenance();
        PosActivity current = activity.get();
        if (current != null) current.showUpdateMaintenance(false);
    }
    private void tick() {
        if (busy || !configured() || Build.VERSION.SDK_INT < 31 || System.currentTimeMillis() < nextAttempt) return;
        busy = true;
        try {
            long installed = version(context);
            long previousTarget = prefs.getLong("targetVersion", 0);
            String state = prefs.getString("state", "idle");
            if (("installed".equals(state) || "installing".equals(state) || "healthy".equals(state)) &&
                previousTarget > 0 && installed == previousTarget && restored && ordersRead && uiReady && foreground && printerReady &&
                (storeId == null || System.currentTimeMillis() - lastOrdersRead < 45000) && System.currentTimeMillis() - lastPrinterRead < 45000) {
                if (!"healthy".equals(state)) { save("healthy", ""); releaseMaintenance(); cleanOldApks(); }
                // A lost report must not permanently hide a successful update.
                if (System.currentTimeMillis() - lastHealthReport > 300000) { report("healthy", ""); lastHealthReport = System.currentTimeMillis(); }
            }
            if ("installing".equals(state) && installed < previousTarget) {
                if (System.currentTimeMillis() - prefs.getLong("stateAt", 0) < 180000) return;
                int sessionId = prefs.getInt("sessionId", -1);
                if (sessionId >= 0) try { context.getPackageManager().getPackageInstaller().abandonSession(sessionId); } catch (Exception ignored) { }
                prefs.edit().putString("blockedSha",prefs.getString("targetSha", "")).commit();
                transition("failed", "installation_timeout"); releaseMaintenance(); return;
            }
            if (!foreground || !restored || !ordersRead || !uiReady) return;
            // Discover on opening or once per local day from 15:00. Explicit
            // approvals remain evaluated every tick, independently of discovery.
            boolean due = ("now".equals(prefs.getString("decision", "")) || "scheduled".equals(prefs.getString("decision", ""))) &&
                System.currentTimeMillis() >= prefs.getLong("scheduledAt", 0) &&
                System.currentTimeMillis() < prefs.getLong("authorizedUntil", 0);
            if (!due && !UpdateCadence.discoveryDue(checkOnOpen, prefs.getString("lastDiscoveryDay", ""), java.util.Calendar.getInstance())) return;
            checkOnOpen = false;
            PosClient client = new PosClient(context);
            JSONObject response;
            try { response = client.updateRequest("GET", "/check", null); }
            catch (Exception e) { checkOnOpen = true; throw e; }
            prefs.edit().putString("lastDiscoveryDay", UpdateCadence.day(java.util.Calendar.getInstance())).commit();
            failures = 0;
            if (System.currentTimeMillis() - lastHealthReport > 300000) {
                report(prefs.getString("state", "idle"), prefs.getString("error", ""));
                lastHealthReport = System.currentTimeMillis();
            }
            JSONObject target = response.optJSONObject("target");
            if (target == null || target.getLong("versionCode") <= installed) {
                synchronized (decisionLock) {
                    prefs.edit().remove("approvedSha").remove("decision").remove("scheduledAt").remove("authorizedUntil").commit();
                    if (target == null) prefs.edit().remove("availableTarget").commit();
                }
                if (!"healthy".equals(prefs.getString("state","")) && !"installed".equals(prefs.getString("state",""))) transition("idle", "");
                return;
            }
            String sha = target.getString("sha256");
            if (!sha.matches("[a-f0-9]{64}") || !context.getPackageName().equals(target.getString("packageName"))) throw new IOException("invalid_target");
            synchronized (decisionLock) {
                SharedPreferences.Editor edit = prefs.edit().putString("availableTarget", target.toString());
                if (!sha.equals(new JSONObject(prefs.getString("availableTarget", "{}")).optString("sha256")))
                    edit.putString("error", "").putString("state", "pending");
                if (!sha.equals(prefs.getString("approvedSha", "")))
                    edit.remove("approvedSha").remove("approvedStore").remove("decision").remove("scheduledAt").remove("authorizedUntil");
                if (!edit.commit()) throw new IOException("update_state_not_saved");
                if (!consentAllows(sha, storeId)) {
                    String decision = prefs.getString("decision", "pending");
                    if ("scheduled".equals(decision) && System.currentTimeMillis() < prefs.getLong("scheduledAt",0)) save("scheduled", "");
                    else {
                        boolean expired = prefs.getLong("authorizedUntil",0) > 0 && System.currentTimeMillis() >= prefs.getLong("authorizedUntil",0);
                        if (expired) prefs.edit().putString("decision","pending").remove("approvedSha").putLong("authorizedUntil",0).commit();
                        save("pending", expired ? "authorization_expired" : prefs.getString("error", "").equals("authorization_expired") ? "authorization_expired" : "");
                    }
                    return;
                }
            }
            if (sha.equals(prefs.getString("blockedSha", ""))) return;
            if (response.isNull("maintenance")) { transition("waiting_safe", "maintenance_not_authorized"); return; }
            if (!context.getPackageManager().canRequestPackageInstalls()) { transition("waiting_permission", "install_permission_required"); return; }
            if (batteryPercent() < 30) { transition("waiting_safe", "battery_below_30"); return; }
            if (!prefs.edit().putLong("targetVersion", target.getLong("versionCode")).putString("targetSha", sha).commit())
                throw new IOException("update_state_not_saved");
            File directory = new File(context.getFilesDir(), "updates");
            if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("update_storage_unavailable");
            File apk = new File(directory, sha + ".apk");
            long size = target.getLong("size");
            if (size <= 0 || size > 100 * 1024 * 1024) throw new IOException("invalid_target_size");
            if (directory.getUsableSpace() < size * 3 + 20 * 1024 * 1024) { transition("waiting_safe", "insufficient_storage"); return; }
            if (!apk.isFile() || apk.length() != size || !sha.equals(fileHash(apk))) {
                transition("downloading", "");
                File part = new File(directory, "download.part");
                client.downloadUpdate(sha, part, size);
                if (!sha.equals(fileHash(part))) throw new IOException("update_hash_mismatch");
                if (apk.exists() && !apk.delete()) throw new IOException("update_storage_unavailable");
                if (!part.renameTo(apk)) throw new IOException("update_storage_unavailable");
            }
            verifyApk(apk, target);
            synchronized (decisionLock) { if (!consentAllows(sha, storeId)) return; }
            transition("ready", "");
            if (!foreground || !GATE.beginMaintenance()) { transition("waiting_safe", "operations_in_progress"); return; }
            PosActivity current = activity.get();
            if (current == null) { releaseMaintenance(); return; }
            current.showUpdateMaintenance(true);
            try {
                if (batteryPercent() < 30) throw new IOException("battery_below_30");
                // Revalidate store scope after draining local operations.
                // Pending server orders survive replacement and are reloaded.
                JSONObject session = client.hasSession() ? client.bootstrap() : null;
                Integer actualStore = session == null ? null : session.getJSONObject("store").getInt("id");
                install(apk, target, client, actualStore);
                failures = 0;
            } catch (Exception e) { releaseMaintenance(); throw e; }
        } catch (Exception e) {
            checkOnOpen = true; // Preserve retries after a failed daily check or validation.
            String code = e instanceof PosClient.ApiException ? ((PosClient.ApiException)e).code : e.getMessage();
            if (code == null || !code.matches("[a-zA-Z0-9_:-]{1,100}")) code = "update_connection_or_validation_failed";
            transition("failed", code);
            failures++;
            nextAttempt = System.currentTimeMillis() + Math.min(15 * 60_000, 30000L * (1L << Math.min(failures, 5)));
        } finally { busy = false; }
    }
    private void cleanOldApks() {
        File[] files = new File(context.getFilesDir(), "updates").listFiles();
        String keep = prefs.getString("targetSha", "") + ".apk";
        if (files != null) for (File file : files)
            if (file.isFile() && file.getName().matches("[a-f0-9]{64}\\.apk") && !file.getName().equals(keep))
                if (!file.delete()) android.util.Log.w("VoltaUpdate", "artifact_cleanup_pending");
    }
    private int batteryPercent() {
        Intent battery = context.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        if (battery == null) return 0;
        int scale = battery.getIntExtra(BatteryManager.EXTRA_SCALE, 0);
        return scale > 0 ? battery.getIntExtra(BatteryManager.EXTRA_LEVEL, 0) * 100 / scale : 0;
    }
    private void verifyApk(File apk, JSONObject target) throws Exception {
        PackageManager pm = context.getPackageManager();
        PackageInfo archive = pm.getPackageArchiveInfo(apk.getAbsolutePath(), PackageManager.GET_SIGNING_CERTIFICATES);
        PackageInfo installed = pm.getPackageInfo(context.getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
        if (archive == null || !context.getPackageName().equals(archive.packageName) ||
            archive.getLongVersionCode() != target.getLong("versionCode") || archive.getLongVersionCode() <= installed.getLongVersionCode() ||
            archive.applicationInfo == null || archive.applicationInfo.minSdkVersion > Build.VERSION.SDK_INT || archive.applicationInfo.targetSdkVersion < 30)
            throw new IOException("update_package_mismatch");
        if (archive.signingInfo == null || installed.signingInfo == null || archive.signingInfo.hasMultipleSigners() || installed.signingInfo.hasMultipleSigners())
            throw new IOException("update_signer_mismatch");
        String expected = hex(MessageDigest.getInstance("SHA-256").digest(installed.signingInfo.getApkContentsSigners()[0].toByteArray()));
        String actual = hex(MessageDigest.getInstance("SHA-256").digest(archive.signingInfo.getApkContentsSigners()[0].toByteArray()));
        if (!expected.equals(actual) || !actual.equals(target.getString("certificateSha256"))) throw new IOException("update_signer_mismatch");
    }
    private void install(File apk, JSONObject target, PosClient client, Integer actualStore) throws Exception {
        PackageInstaller installer = context.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(context.getPackageName()); params.setSize(apk.length());
        params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
        int id = installer.createSession(params);
        boolean committed = false;
        try (PackageInstaller.Session session = installer.openSession(id)) {
            try (InputStream input = new FileInputStream(apk); OutputStream out = session.openWrite("base.apk", 0, apk.length())) {
                byte[] buffer = new byte[32768]; int size;
                while ((size = input.read(buffer)) != -1) out.write(buffer, 0, size);
                session.fsync(out);
            }
            // Obtain the short-lived maintenance permission after the potentially
            // slow session copy, immediately before committing the replacement.
            long prepareStarted = SystemClock.elapsedRealtime();
            JSONObject permit = client.updateRequest("POST", "/prepare", new JSONObject().put("sha256", target.getString("sha256"))
                .put("storeId", actualStore == null ? JSONObject.NULL : actualStore));
            long validForMs = permit.optLong("validForMs",0);
            // Use elapsed time, not equality of two wall clocks. Deducting the
            // whole round trip is conservative relative to server issuance.
            if (!permit.optBoolean("allowed") || validForMs <= 0 || validForMs > 10000 ||
                SystemClock.elapsedRealtime() - prepareStarted >= validForMs)
                throw new IOException("maintenance_expired");
            if (!foreground || batteryPercent() < 30) throw new IOException("terminal_not_safe");
            synchronized (decisionLock) {
            if (!consentAllows(target.getString("sha256"),actualStore)) throw new IOException("update_consent_required");
            if (!prefs.edit().putInt("sessionId", id).putLong("targetVersion", target.getLong("versionCode"))
                .putString("state", "installing").putString("error", "").putLong("stateAt", System.currentTimeMillis()).commit())
                throw new IOException("update_state_not_saved");
            Intent result = new Intent(context, UpdateResultReceiver.class).setAction(RESULT_ACTION)
                .setData(Uri.parse("volta-update:" + id));
            PendingIntent callback = PendingIntent.getBroadcast(context, id, result, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
            if (SystemClock.elapsedRealtime() - prepareStarted >= validForMs) throw new IOException("maintenance_expired");
            session.commit(callback.getIntentSender()); committed = true;
            }
            android.util.Log.i("VoltaUpdate", "install_committed session=" + id);
        } finally { if (!committed) installer.abandonSession(id); }
    }
    static String fileHash(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[32768]; int size;
            while ((size = input.read(buffer)) != -1) digest.update(buffer, 0, size);
        }
        return hex(digest.digest());
    }
    private static String hex(byte[] data) {
        StringBuilder result = new StringBuilder();
        for (byte value : data) result.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
        return result.toString();
    }
    static void result(Context context, Intent intent) {
        SharedPreferences prefs = preferences(context);
        int id = intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -1);
        if (!RESULT_ACTION.equals(intent.getAction()) || id < 0 || id != prefs.getInt("sessionId", -2)) return;
        int result = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        String state = result == PackageInstaller.STATUS_SUCCESS ? ("healthy".equals(prefs.getString("state", "")) ? "healthy" : "installed") :
            result == PackageInstaller.STATUS_PENDING_USER_ACTION ? "confirmation_required" : "failed";
        String error = result == PackageInstaller.STATUS_SUCCESS ? "" : "installer_status_" + result;
        SharedPreferences.Editor edit = prefs.edit().putString("state", state).putString("error", error);
        if (result != PackageInstaller.STATUS_SUCCESS) {
            edit.putString("blockedSha", prefs.getString("targetSha", ""));
            try { context.getPackageManager().getPackageInstaller().abandonSession(id); } catch (Exception ignored) { }
        }
        edit.commit();
        android.util.Log.i("VoltaUpdate", state + " session=" + id + " status=" + result);
        if (instance != null) instance.releaseMaintenance();
    }
}
