package com.volta.poslab;

import android.content.*;
import org.json.JSONObject;

public final class UpdateResultReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        PosUpdater.result(context, intent);
        PendingResult pending = goAsync();
        new Thread(() -> {
            try { PosUpdater.sendReport(context, new JSONObject()
                .put("state", PosUpdater.preferences(context).getString("state", "failed"))
                .put("error", PosUpdater.preferences(context).getString("error", "").isEmpty() ? JSONObject.NULL : PosUpdater.preferences(context).getString("error", ""))); }
            catch (Exception ignored) { } finally { pending.finish(); }
        }, "VoltaUpdateResult").start();
    }
}
