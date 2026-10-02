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
 * maintenance window while the assigned store is closed and its queue empty.
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
    private volatile long lastOrdersRead, lastPrinterRead;
    private long lastHealthReport;

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
        if (activity.get() == value) foreground = visible;
    }
    public void restored(JSONObject session) {
        storeId = session == null ? null : session.optInt("storeId");
        restored = true;
        ordersRead = session == null;
    }
    public void ordersRead() { ordersRead = true; lastOrdersRead = System.currentTimeMillis(); }
    public void uiReady(boolean value) { uiReady = value; }
    public void printerReady(boolean value) { printerReady = value; lastPrinterRead = System.currentTimeMillis(); }
    public void checkSoon() { if (configured()) worker.execute(this::tick); }
    public JSONObject status() throws Exception {
        return new JSONObject().put("configured", configured()).put("versionCode", version(context))
            .put("versionName", context.getPackageManager().getPackageInfo(context.getPackageName(), 0).versionName)
            .put("state", prefs.getString("state", "idle")).put("error", prefs.getString("error", ""))
            .put("canInstall", Build.VERSION.SDK_INT >= 31 && context.getPackageManager().canRequestPackageInstalls());
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
            .put("foreground", foreground).put("printerReady", printerReady).put("storeId", storeId == null ? JSONObject.NULL : storeId)); }
        catch (Exception e) { android.util.Log.w("VoltaUpdate", "report_pending"); }
    }
    static void sendReport(Context context, JSONObject body) throws Exception {
        body.put("versionCode", version(context)).put("targetVersionCode", preferences(context).getLong("targetVersion", 0));
        new PosClient(context).updateRequest("POST", "/report", body);
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
            if (previousTarget > 0 && installed == previousTarget && restored && ordersRead && uiReady && foreground && printerReady &&
                (storeId == null || System.currentTimeMillis() - lastOrdersRead < 45000) && System.currentTimeMillis() - lastPrinterRead < 45000) {
                if (!"healthy".equals(state)) { save("healthy", ""); releaseMaintenance(); cleanOldApks(); }
                // A lost report must not permanently hide a successful update.
                if (System.currentTimeMillis() - lastHealthReport > 60000) { report("healthy", ""); lastHealthReport = System.currentTimeMillis(); }
            }
            if ("installing".equals(state) && installed < previousTarget) {
                if (System.currentTimeMillis() - prefs.getLong("stateAt", 0) < 180000) return;
                int sessionId = prefs.getInt("sessionId", -1);
                if (sessionId >= 0) try { context.getPackageManager().getPackageInstaller().abandonSession(sessionId); } catch (Exception ignored) { }
                prefs.edit().putString("blockedSha",prefs.getString("targetSha", "")).commit();
                transition("failed", "installation_timeout"); releaseMaintenance(); return;
            }
            if (!foreground || !restored || !ordersRead || !uiReady) return;
            PosClient client = new PosClient(context);
            JSONObject response = client.updateRequest("GET", "/check", null);
            JSONObject target = response.optJSONObject("target");
            if (target == null || target.getLong("versionCode") <= installed) return;
            String sha = target.getString("sha256");
            if (!sha.matches("[a-f0-9]{64}") || !context.getPackageName().equals(target.getString("packageName"))) throw new IOException("invalid_target");
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
            transition("ready", "");
            if (!foreground || !GATE.beginMaintenance()) { transition("waiting_safe", "operations_in_progress"); return; }
            PosActivity current = activity.get();
            if (current == null) { releaseMaintenance(); return; }
            current.showUpdateMaintenance(true);
            try {
                if (batteryPercent() < 30) throw new IOException("battery_below_30");
                // Revalidate store scope and outstanding orders after draining
                // the local gate. A stale or expired session fails closed.
                JSONObject session = client.hasSession() ? client.bootstrap() : null;
                Integer actualStore = session == null ? null : session.getJSONObject("store").getInt("id");
                if (session != null && (session.getJSONObject("store").optBoolean("active", true) ||
                    client.orders().getJSONArray("items").length() != 0)) throw new IOException("store_not_safe");
                install(apk, target, client, actualStore);
                failures = 0;
            } catch (Exception e) { releaseMaintenance(); throw e; }
        } catch (Exception e) {
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
            JSONObject permit = client.updateRequest("POST", "/prepare", new JSONObject().put("sha256", target.getString("sha256"))
                .put("storeId", actualStore == null ? JSONObject.NULL : actualStore));
            if (!permit.optBoolean("allowed") || java.time.Instant.parse(permit.getString("expiresAt")).toEpochMilli() <= System.currentTimeMillis())
                throw new IOException("maintenance_expired");
            if (!foreground || batteryPercent() < 30) throw new IOException("terminal_not_safe");
            if (!prefs.edit().putInt("sessionId", id).putLong("targetVersion", target.getLong("versionCode"))
                .putString("state", "installing").putString("error", "").putLong("stateAt", System.currentTimeMillis()).commit())
                throw new IOException("update_state_not_saved");
            Intent result = new Intent(context, UpdateResultReceiver.class).setAction(RESULT_ACTION)
                .setData(Uri.parse("volta-update:" + id));
            PendingIntent callback = PendingIntent.getBroadcast(context, id, result, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
            session.commit(callback.getIntentSender()); committed = true;
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
