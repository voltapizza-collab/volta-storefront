package com.volta.poslab;

import android.content.*;
import org.json.JSONObject;

public final class PackageReplacedReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction())) return;
        try {
            if (PosUpdater.preferences(context).getLong("targetVersion", 0) != PosUpdater.version(context)) return;
            PosUpdater.preferences(context).edit().putString("state", "installed").putString("error", "").commit();
            // This is a request, not proof of foreground recovery. Only an
            // actual resumed, authenticated POS can report itself healthy.
            try { context.startActivity(new Intent(context, PosActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP)); }
            catch (Exception e) { android.util.Log.w("VoltaUpdate", "reopen_not_allowed"); }
            PendingResult pending = goAsync();
            new Thread(() -> {
                try { PosUpdater.sendReport(context, new JSONObject().put("state", "installed")); }
                catch (Exception ignored) { } finally { pending.finish(); }
            }, "VoltaPackageReplaced").start();
        } catch (Exception e) { android.util.Log.w("VoltaUpdate", "replacement_unverified"); }
    }
}
