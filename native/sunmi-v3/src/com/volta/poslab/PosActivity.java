package com.volta.poslab;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.*;
import android.view.WindowManager;
import android.net.Uri;
import org.json.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import com.sunmi.printerx.*;
import com.sunmi.printerx.api.*;
import com.sunmi.printerx.enums.*;
import com.sunmi.printerx.style.*;

/** Only APK-packaged UI can access this bridge. No remote top-level navigation. */
public class PosActivity extends Activity {
    private static final String ORIGIN = "https://pos.volta.invalid";
    private final ExecutorService worker = Executors.newFixedThreadPool(3);
    private final java.util.concurrent.atomic.AtomicBoolean printing = new java.util.concurrent.atomic.AtomicBoolean();
    private WebView web;
    private PosClient client;
    private PosUpdater updater;
    private android.widget.FrameLayout root;
    private android.widget.TextView maintenance;
    private volatile PrinterSdk.Printer printer;
    private volatile boolean destroyed;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        try { client = new PosClient(this); } catch (Exception e) { finish(); return; }
        if (client.deviceId().isEmpty()) {
            startActivity(new android.content.Intent(this, SessionActivity.class)
                .putExtra("return_to_pos", true));
            finish();
            return;
        }
        updater = PosUpdater.get(this); updater.attach(this);
        web = new WebView(this);
        // Development inspection over the already-authorized USB connection only.
        WebView.setWebContentsDebuggingEnabled(PosClient.BASE_URL.equals("http://127.0.0.1:8091"));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSaveFormData(false);
        web.setImportantForAutofill(android.view.View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
        web.addJavascriptInterface(new Bridge(), "VoltaNative");
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) {
                view.postDelayed(new Runnable() { public void run() {
                    if (!destroyed) view.evaluateJavascript("JSON.stringify({login:!!document.querySelector('.pos-loginPanel'),pos:!!document.querySelector('.pos-shell'),inputs:document.querySelectorAll('.pos-loginPanel input').length,overflow:document.documentElement.scrollWidth>innerWidth+2,cardsFit:[...document.querySelectorAll('.pos-orderCard')].every(e=>e.getBoundingClientRect().right<=e.parentElement.getBoundingClientRect().right+1&&e.scrollWidth<=e.clientWidth+1),inventory:!!document.querySelector('.pos-inventoryFab'),updateNotice:!!document.querySelector('.pos-updateNotice'),updateDialog:!!document.querySelector('.pos-updateDialog[open]'),updateFits:[...document.querySelectorAll('.pos-updateNotice,.pos-updateDialog')].every(e=>e.scrollWidth<=e.clientWidth+1),updateDetailsBounds:(()=>{const e=document.querySelector('.pos-updateNotice button');if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:devicePixelRatio};})()})",
                        value -> {
                            android.util.Log.i("VoltaUi", "UI_CHECK " + value);
                            try {
                                JSONObject ui = new JSONObject((String)new JSONTokener(value).nextValue());
                                updater.uiReady(ui.optBoolean("pos") || (!client.hasSession() && ui.optBoolean("login")));
                            } catch (Exception ignored) { updater.uiReady(false); }
                        });
                    if (!destroyed) view.postDelayed(this,30000);
                } }, 25000);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) { return true; }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri uri = req.getUrl();
                if (!"pos.volta.invalid".equals(uri.getHost()) || !"https".equals(uri.getScheme())) return null;
                try {
                    String path = uri.getPath();
                    if (path == null || path.equals("/")) path = "/index.html";
                    if (path.contains("..")) throw new IOException();
                    String mime = path.endsWith(".js") ? "application/javascript" : path.endsWith(".css") ? "text/css" :
                        path.endsWith(".html") ? "text/html" : path.endsWith(".svg") ? "image/svg+xml" :
                        path.endsWith(".png") ? "image/png" : path.endsWith(".woff2") ? "font/woff2" : "application/octet-stream";
                    return new WebResourceResponse(mime, "UTF-8", getAssets().open("pos" + path));
                } catch (Exception e) { return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", new HashMap<>(), new ByteArrayInputStream(new byte[0])); }
            }
        });
        root = new android.widget.FrameLayout(this); root.addView(web);
        setContentView(root); web.loadUrl(ORIGIN + "/index.html");
        android.content.pm.ShortcutManager shortcuts = getSystemService(android.content.pm.ShortcutManager.class);
        if (shortcuts != null && shortcuts.isRequestPinShortcutSupported()) {
            android.content.Intent open = new android.content.Intent(this, PosActivity.class).setAction(android.content.Intent.ACTION_MAIN);
            android.content.pm.ShortcutInfo shortcut = new android.content.pm.ShortcutInfo.Builder(this,"volta-pos-home")
                .setShortLabel("Volta POS").setIcon(android.graphics.drawable.Icon.createWithResource(this,getApplicationInfo().icon)).setIntent(open).build();
            if (shortcuts.getPinnedShortcuts().isEmpty()) shortcuts.requestPinShortcut(shortcut,null);
            else shortcuts.updateShortcuts(java.util.Collections.singletonList(shortcut));
        }
        try { PrinterSdk.getInstance().getPrinter(getApplicationContext(), new PrinterSdk.PrinterListen() {
            @Override public void onDefPrinter(PrinterSdk.Printer value) { printer = value; }
            @Override public void onPrinters(List<PrinterSdk.Printer> values) { }
        }); } catch (Exception ignored) { printer = null; }
    }
    private JSONObject sessionData(JSONObject bootstrap) throws Exception {
        JSONObject s = bootstrap.getJSONObject("store"), p = bootstrap.getJSONObject("partner");
        return new JSONObject().put("partnerId",p.getInt("id")).put("partnerName",p.getString("name"))
            .put("storeId",s.getInt("id")).put("storeName",s.getString("name")).put("deviceName","SUNMI V3")
            .put("pairedAt",java.time.Instant.now().toString());
    }
    private void respond(String id, int status, Object data) {
        if (destroyed) return;
        try {
            String script = "window.__voltaResult(" + JSONObject.quote(id) + "," + new JSONObject().put("status", status).put("data",data) + ")";
            runOnUiThread(() -> { if (!destroyed) web.evaluateJavascript(script,null); });
        } catch (Exception ignored) { }
    }
    private class Bridge {
        @JavascriptInterface public void call(String id, String operation, String raw) {
            if (raw == null || raw.length() > 100000 || destroyed) return;
            if (!PosUpdater.GATE.enter()) {
                try { respond(id,503,new JSONObject().put("error","terminal_updating")); } catch(Exception ignored) { }
                return;
            }
            java.util.concurrent.atomic.AtomicBoolean released = new java.util.concurrent.atomic.AtomicBoolean();
            Runnable release = () -> { if (released.compareAndSet(false,true)) PosUpdater.GATE.leave(); };
            try { worker.execute(() -> {
                boolean asynchronous = false;
                try {
                    JSONObject body = new JSONObject(raw);
                    Object result;
                    if (operation.equals("restore")) {
                        if (client.logoutPending()) client.logout();
                        client.device();
                        if (!client.hasSession()) result = JSONObject.NULL;
                        else try { result = sessionData(client.bootstrap()); }
                        catch (PosClient.ApiException e) { if (e.status != 401) throw e; client.logout(); result = JSONObject.NULL; }
                        updater.restored(result instanceof JSONObject ? (JSONObject)result : null);
                    } else if (operation.equals("logout")) { client.logout(); updater.restored(null); result = new JSONObject(); }
                    else if (operation.equals("updateSettings")) { showUpdateSettings(); result = new JSONObject(); }
                    else if (operation.equals("updateStatus")) { result = updater.status(); }
                    else if (operation.equals("updateNoticeSeen")) { result = updater.noticeSeen(body.getString("sha256")); }
                    else if (operation.equals("updatePermission")) { updater.permission(); result = new JSONObject(); }
                    else if (operation.equals("updateCheck")) { updater.checkSoon(); result = updater.status(); }
                    else if (operation.equals("updateDecision")) {
                        JSONObject session = client.bootstrap();
                        result = updater.decide(body,session.getJSONObject("store").getInt("id"));
                    }
                    else if (operation.equals("request")) {
                        String path = body.getString("path"), method = body.getString("method");
                        JSONObject payload = body.optJSONObject("body");
                        if (path.equals("/partners/pos-login") && method.equals("POST")) {
                            if (client.logoutPending()) client.logout();
                            client.login(payload.getString("username"), payload.getString("pin"));
                            result = sessionData(client.bootstrap());
                            updater.restored((JSONObject)result);
                        } else {
                            JSONObject params = body.optJSONObject("params");
                            if (params != null && params.length()>0) {
                                StringJoiner query = new StringJoiner("&");
                                Iterator<String> names = params.keys();
                                while(names.hasNext()) { String name=names.next(); query.add(Uri.encode(name)+"="+Uri.encode(params.getString(name))); }
                                path += "?" + query;
                            }
                            result = client.uiRequest(method,path,payload);
                            if (method.equals("GET") && path.split("\\?",2)[0].equals("/api/myorders/pending")) updater.ordersRead();
                        }
                    } else if (operation.equals("printerStatus")) {
                        boolean ready = printer != null && printer.queryApi().getStatus() == Status.READY;
                        updater.printerReady(ready);
                        result = new JSONObject().put("realConnected",ready).put("virtualReady",false).put("label", ready ? "SUNMI V3" : "Comprueba papel e impresora");
                    } else if (operation.equals("print")) {
                        asynchronous = true; print(id, body, false, release); return;
                    } else if (operation.equals("printTest")) {
                        client.bootstrap(); asynchronous = true; print(id, body, true, release); return;
                    } else throw new IOException("Unsupported operation");
                    respond(id,200,result);
                } catch (Exception e) {
                    release.run();
                    try { respond(id, e instanceof PosClient.ApiException ? ((PosClient.ApiException)e).status : 503,
                        new JSONObject().put("error",e instanceof PosClient.ApiException ? ((PosClient.ApiException)e).code :
                            operation.equals("updateDecision") && e.getMessage() != null && e.getMessage().matches("[a-z_]{1,80}") ? e.getMessage() : "terminal_operation_failed")); } catch (Exception ignored) { }
                } finally { if (!asynchronous) release.run(); }
            }); } catch (RejectedExecutionException e) { release.run(); }
        }
    }
    private void print(String id, JSONObject data, boolean test, Runnable release) throws Exception {
        // Validate active store and ownership before sending this ticket to hardware.
        if (!test) client.uiRequest("GET", "/api/myorders/"+data.getInt("orderId")+"/messages", null);
        if (!printing.compareAndSet(false,true)) throw new IOException("Printer busy");
        try {
            if (printer == null || printer.queryApi().getStatus() != Status.READY) throw new IOException("Printer unavailable");
            JSONArray lines = data.getJSONArray("lines");
            LineApi line = printer.lineApi();
            line.enableTransMode(true); line.initLine(BaseStyle.getStyle());
            if (test) line.printText("PRUEBA - NO ES UNA COMPRA\nPAPEL 58 mm / AREA 48 mm\n123456789012345678901234567890\n",TextStyle.getStyle().setTextSize(24));
            for(int i=0;i<lines.length();i++) {
                String text = lines.getString(i);
                boolean heading = text.equals("VOLTA POS") || text.startsWith("Total:") || text.equals("ENVIO / DELIVERY") || text.equals("RECOGIDA / PICKUP") || text.equals("CONSUMO EN LOCAL") || text.startsWith("MODALIDAD:") || text.startsWith("PROGRAMADO:");
                if (text.startsWith("---")) line.printText("\n",TextStyle.getStyle().setTextSize(12));
                for (String row:Receipt58.wrap(text)) {
                    line.printText(row+"\n",TextStyle.getStyle().setTextSize(24).enableBold(heading || text.equals("  CAMBIOS:") || text.startsWith("  - SIN ")));
                    line.printText("\n",TextStyle.getStyle().setTextSize(6));
                }
                if (text.equals("VOLTA POS")) line.printText("\n",TextStyle.getStyle().setTextSize(12));
            }
            if (test) line.printText("SIN VALIDEZ COMERCIAL\n",TextStyle.getStyle().setTextSize(24));
            line.printText("\n\n",TextStyle.getStyle().setTextSize(24)); line.autoOut();
            line.printTrans(new PrintResult() {
                @Override public void onResult(int code,String message) {
                    android.util.Log.i("VoltaPrint", "PRINT_RESULT code="+code);
                    printing.set(false);
                    release.run();
                    try { respond(id,code==0 ? 200 : 503,new JSONObject().put("confirmed",code==0)); } catch(Exception ignored) { }
                }
            });
        } catch(Exception e) { printing.set(false); throw e; }
    }
    public void showUpdateMaintenance(boolean visible) {
        runOnUiThread(() -> {
            if (destroyed || root == null) return;
            if (maintenance == null) {
                maintenance = new android.widget.TextView(this);
                maintenance.setText("Actualizando Volta POS…\nEspera a que termine la instalación.");
                maintenance.setGravity(android.view.Gravity.CENTER); maintenance.setTextSize(22);
                maintenance.setPadding(24,24,24,24); maintenance.setTextColor(0xff222222);
                maintenance.setBackgroundColor(0xfffaf6ef); maintenance.setClickable(true);
                root.addView(maintenance, new android.widget.FrameLayout.LayoutParams(-1,-1));
            }
            maintenance.setVisibility(visible ? android.view.View.VISIBLE : android.view.View.GONE);
        });
    }
    private void showUpdateSettings() throws Exception {
        JSONObject status = updater.status();
        java.util.Map<String,String> labels = new HashMap<>();
        labels.put("idle","Sin actualizaciones pendientes"); labels.put("healthy","Actualización comprobada");
        labels.put("downloading","Descargando"); labels.put("ready","Preparada para instalar");
        labels.put("waiting_safe","Esperando condiciones de mantenimiento"); labels.put("waiting_permission","Falta autorización de Android");
        labels.put("installing","Instalando"); labels.put("installed","Comprobando funcionamiento");
        labels.put("confirmation_required","Android solicita confirmación; instalación detenida"); labels.put("failed","La actualización no se completó");
        String state = status.optString("state");
        String text = "Versión " + status.getString("versionName") + "\n\n" +
            (status.optBoolean("configured") ? labels.getOrDefault(state,"Comprobando actualizaciones") : "Actualizaciones remotas pendientes de configuración");
        runOnUiThread(() -> {
            if (destroyed) return;
            android.app.AlertDialog.Builder dialog = new android.app.AlertDialog.Builder(this)
                .setTitle("Actualizaciones de Volta POS").setMessage(text).setNegativeButton("Cerrar",null);
            if (status.optBoolean("configured")) {
                if (!status.optBoolean("canInstall")) dialog.setPositiveButton("Autorizar",(d,w) -> updater.permission());
                else dialog.setPositiveButton("Comprobar",(d,w) -> updater.checkSoon());
            }
            dialog.show();
        });
    }
    @Override protected void onPause() { super.onPause(); if (updater != null) updater.visibility(this,false); if (web != null) web.onPause(); }
    @Override protected void onResume() { super.onResume(); if (updater != null) updater.visibility(this,true); if (web != null) web.onResume(); }
    @Override public void onBackPressed() { if (!PosUpdater.GATE.isMaintenance()) moveTaskToBack(true); }
    @Override protected void onDestroy() {
        destroyed=true; worker.shutdown();
        if (web != null) {
            web.removeJavascriptInterface("VoltaNative"); web.destroy();
            PrinterSdk.getInstance().destroy();
        }
        super.onDestroy();
    }
}
