package com.volta.poslab;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.text.InputType;
import android.widget.*;
import android.content.Intent;
import android.view.WindowManager;
import org.json.*;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

public class SessionActivity extends Activity {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private PosClient client;
    private LinearLayout root;
    private volatile boolean destroyed;
    private final android.os.Handler handler = new android.os.Handler(android.os.Looper.getMainLooper());
    private boolean foreground, storeVisible, refreshing;
    private int generation;
    private TextView syncStatus, ordersText;
    private final Runnable refreshTask = () -> refreshOrders();
    private void scheduleRefresh() {
        handler.removeCallbacks(refreshTask);
        if (foreground && storeVisible && !destroyed) handler.postDelayed(refreshTask, 10000);
    }
    private void renderOrders(JSONObject orders) {
        JSONArray items = orders.optJSONArray("items");
        StringBuilder text = new StringBuilder("Pedidos pendientes: ").append(items == null ? 0 : items.length());
        if (!orders.isNull("nextCursor")) text.append(" (primera página)");
        if (items != null) for (int i=0; i<items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            text.append("\n\n").append(item.optString("code")).append(" · ").append(item.optString("total")).append(" ").append(item.optString("currency"));
        }
        ordersText.setText(text.toString());
        syncStatus.setText("Actualizado: " + new java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(new java.util.Date()) + " · Consulta automática cada 10 s");
    }
    private void refreshOrders() {
        if (!foreground || !storeVisible || refreshing || destroyed) return;
        refreshing = true;
        final int current = generation;
        worker.execute(() -> {
            try {
                JSONObject orders = client.orders();
                ui(() -> { if (current == generation && storeVisible) renderOrders(orders); });
            } catch (Exception e) {
                ui(() -> {
                    if (current != generation || !storeVisible) return;
                    if (e instanceof PosClient.ApiException &&
                        (((PosClient.ApiException)e).status == 401 || ((PosClient.ApiException)e).status == 403)) error(e);
                    else syncStatus.setText("Sin conexión confirmada · Reintentando. Los pedidos mostrados pueden haber cambiado.");
                });
            } finally { ui(() -> { refreshing = false; scheduleRefresh(); }); }
        });
    }
    @Override protected void onResume() { super.onResume(); foreground = true; scheduleRefresh(); }
    @Override protected void onPause() { foreground = false; handler.removeCallbacks(refreshTask); super.onPause(); }
    private interface Job { void run() throws Exception; }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        screen("Conectando con Volta…");
        // One-use operator enrollment during the USB pilot; never persists the code.
        String enrollmentCode = state == null ? getIntent().getStringExtra("enrollment_code") : null;
        getIntent().removeExtra("enrollment_code");
        work(() -> {
            client = new PosClient(this);
            if (client.deviceId().isEmpty() && enrollmentCode != null) client.enroll(enrollmentCode);
            restore();
        });
    }
    private void work(Job job) {
        worker.execute(() -> { try { job.run(); } catch (Exception e) { error(e); } });
    }
    private void ui(Runnable run) { runOnUiThread(() -> { if (!destroyed) run.run(); }); }
    private void restore() throws Exception {
        if (client.logoutPending()) client.logout();
        if (client.deviceId().isEmpty()) { ui(this::enrollmentScreen); return; }
        JSONObject device = client.device();
        android.util.Log.i("VoltaIdentity", "DEVICE_AUTHORIZED");
        if (client.hasSession()) {
            try { showStore(client.bootstrap()); return; }
            catch (PosClient.ApiException e) {
                if (e.status != 401) throw e;
                client.logout();
            }
        }
        ui(() -> loginScreen(device.optJSONObject("device")));
    }
    private void screen(String subtitle) {
        storeVisible = false; generation++; handler.removeCallbacks(refreshTask);
        ScrollView scroll = new ScrollView(this); scroll.setBackgroundColor(Color.rgb(246,243,250));
        root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);
        int pad = (int)(24 * getResources().getDisplayMetrics().density);
        root.setPadding(pad,pad,pad,pad); scroll.addView(root); setContentView(scroll);
        label("VOLTA POS", 30); label(subtitle, 18);
        label("Piloto de conexión por USB", 12);
    }
    private void label(String text, int size) {
        TextView v = new TextView(this); v.setText(text); v.setTextSize(size); v.setTextColor(Color.rgb(60,30,90));
        v.setPadding(0,16,0,16); root.addView(v);
    }
    private EditText field(String hint, boolean secret, boolean numeric) {
        EditText v = new EditText(this); v.setHint(hint); v.setSingleLine(true);
        v.setInputType(numeric ? InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD :
            InputType.TYPE_CLASS_TEXT | (secret ? InputType.TYPE_TEXT_VARIATION_PASSWORD : InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS));
        v.setImportantForAutofill(android.view.View.IMPORTANT_FOR_AUTOFILL_NO);
        root.addView(v); return v;
    }
    private void button(String title, Runnable action) {
        Button b = new Button(this); b.setText(title); b.setAllCaps(false); root.addView(b);
        b.setOnClickListener(v -> action.run());
    }
    private void enrollmentScreen() {
        screen("Autorizar este terminal");
        label("Introduce el código de alta generado por la administración de Volta. Este paso se realiza una sola vez.",16);
        EditText code = field("Código de alta", true, false);
        button("Registrar terminal", () -> {
            String value = code.getText().toString().trim(); code.setText(""); screen("Registrando terminal…");
            work(() -> { client.enroll(value); restore(); });
        });
        button("Probar impresora", () -> startActivity(new Intent(this, MainActivity.class)));
    }
    private void loginScreen(JSONObject device) {
        android.util.Log.i("VoltaIdentity", "STORE_LOGIN_SCREEN");
        screen("Terminal autorizado · Inicia sesión");
        if (device != null) label(device.optString("name"), 16);
        EditText user = field("Usuario de la pizzería", false, false);
        EditText pin = field("PIN de 6 dígitos", true, true);
        button("Entrar en la pizzería", () -> {
            String username = user.getText().toString(), password = pin.getText().toString();
            pin.setText(""); screen("Validando credenciales…");
            work(() -> { client.login(username, password); showStore(client.bootstrap()); });
        });
        button("Probar impresora", () -> startActivity(new Intent(this, MainActivity.class)));
    }
    private void showStore(JSONObject data) throws Exception {
        JSONObject orders = client.orders();
        android.util.Log.i("VoltaIdentity", "STORE_SESSION_ACTIVE");
        ui(() -> {
            JSONObject store = data.optJSONObject("store"), partner = data.optJSONObject("partner");
            screen("Sesión de pizzería activa");
            label(partner.optString("name") + " · " + store.optString("name"), 24);
            label("La información se obtiene de la tienda autorizada por el servidor.", 16);
            syncStatus = new TextView(this); root.addView(syncStatus);
            ordersText = new TextView(this); ordersText.setTextSize(18); root.addView(ordersText);
            renderOrders(orders); storeVisible = true; scheduleRefresh();
            button("Actualizar información", this::refreshOrders);
            button("Cerrar sesión / Cambiar pizzería", () -> { screen("Cerrando sesión…"); work(() -> { client.logout(); restore(); }); });
            button("Probar impresora", () -> startActivity(new Intent(this, MainActivity.class)));
        });
    }
    private void error(Exception error) {
        android.util.Log.w("VoltaIdentity", error instanceof PosClient.ApiException ?
            ((PosClient.ApiException) error).code : "connection_or_local_storage_error");
        String message = "No se pudo conectar. Comprueba el cable USB y el servidor de prueba.";
        if (error instanceof PosClient.ApiException) {
            String code = ((PosClient.ApiException) error).code;
            if (code.equals("invalid_credentials")) message = "Usuario o PIN incorrectos.";
            else if (code.equals("device_not_authorized")) message = "Este terminal está suspendido o revocado. Contacta con administración.";
            else if (code.equals("login_rate_limited")) message = "Demasiados intentos. Espera 15 minutos.";
            else if (code.equals("invalid_enrollment")) message = "Código de alta inválido, vencido o ya utilizado.";
            else if (code.equals("ambiguous_credentials")) message = "Estas credenciales coinciden con varias tiendas. Administración debe asignar un PIN diferente. Solo necesitas usuario y PIN.";
            else if (code.equals("logout_required")) message = "Hay una sesión previa en el servidor. Ciérrala antes de volver a entrar.";
            else if (code.equals("invalid_device_proof")) message = "No se validó la identidad. Comprueba la fecha y hora del terminal.";
            else message = "No se completó la operación: " + code;
        }
        final String shown = message;
        ui(() -> {
            screen("Operación pendiente"); label(shown,16);
            button("Volver a comprobar", () -> { screen("Comprobando…"); work(this::restore); });
            if (client != null && !client.deviceId().isEmpty()) button("Cerrar sesión anterior", () -> {
                screen("Cerrando sesión…"); work(() -> { client.logout(); restore(); });
            });
        });
    }
    @Override protected void onDestroy() { destroyed = true; handler.removeCallbacks(refreshTask); worker.shutdown(); super.onDestroy(); }
}
