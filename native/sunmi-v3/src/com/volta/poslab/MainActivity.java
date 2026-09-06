package com.volta.poslab;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import com.sunmi.printerx.*;
import com.sunmi.printerx.api.*;
import com.sunmi.printerx.enums.*;
import com.sunmi.printerx.style.*;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Hardware-only pilot. No network permission, production orders or device policy changes. */
public class MainActivity extends Activity {
    private static final String TAG = "VoltaPosLab";
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private volatile PrinterSdk.Printer printer;
    private TextView status, detail, result;
    private Button printButton, refreshButton;
    private boolean busy, destroyed, autoTest, bound;
    private int jobSequence;
    private final Runnable timeout = () -> finishJob(jobSequence,
        "Sin confirmación del servicio. Revisa el papel antes de repetir.");

    private final PrinterSdk.PrinterListen connection = new PrinterSdk.PrinterListen() {
        @Override public void onDefPrinter(PrinterSdk.Printer device) {
            printer = device;
            main.post(() -> {
                if (destroyed) return;
                status.setText(device == null ? "Impresora no disponible" : "Impresora conectada");
                printButton.setEnabled(device != null && !busy);
                if (device != null) {
                    refreshStatus();
                    if (autoTest) { autoTest = false; printTicket(); }
                }
            });
        }
        @Override public void onPrinters(java.util.List<PrinterSdk.Printer> devices) {
            Log.i(TAG, "PRINTERS_FOUND " + devices.size());
        }
    };

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        autoTest = saved == null && getIntent().getBooleanExtra("print_test", false);
        getWindow().setStatusBarColor(Color.rgb(29, 18, 53));
        getWindow().setNavigationBarColor(Color.rgb(29, 18, 53));
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.rgb(246, 243, 250));
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(24), dp(30), dp(24), dp(26));
        scroll.addView(root);
        TextView brand = text("VOLTA", 38, true);
        brand.setTextColor(Color.rgb(72, 25, 126));
        root.addView(brand);
        root.addView(text("PRUEBA DE TERMINAL", 12, true));
        space(root, 24);
        root.addView(text("Prueba de impresora", 27, true));
        root.addView(text("Primera conexión de Volta con la impresora integrada del SUNMI V3.", 16, false));
        space(root, 24);
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(18), dp(20), dp(18), dp(20));
        GradientDrawable bg = new GradientDrawable(); bg.setColor(Color.WHITE); bg.setCornerRadius(dp(16));
        card.setBackground(bg);
        status = text("Conectando impresora…", 20, true);
        detail = text("Consultando servicio SUNMI", 14, false);
        card.addView(status); card.addView(detail); root.addView(card);
        space(root, 22);
        printButton = new Button(this);
        printButton.setText("Imprimir ticket Volta");
        printButton.setAllCaps(false);
        printButton.setTextSize(17);
        printButton.setTextColor(Color.WHITE);
        printButton.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(91, 38, 154)));
        printButton.setEnabled(false);
        root.addView(printButton, new LinearLayout.LayoutParams(-1, dp(60)));
        printButton.setOnClickListener(v -> printTicket());
        refreshButton = new Button(this);
        refreshButton.setText("Comprobar conexión"); refreshButton.setAllCaps(false);
        root.addView(refreshButton);
        refreshButton.setOnClickListener(v -> { if (printer == null) bindPrinter(); else refreshStatus(); });
        space(root, 14);
        result = text(saved == null ? "Listo para realizar la primera prueba." :
            "Pantalla restaurada. Comprueba el último ticket antes de repetir.", 15, false);
        root.addView(result);
        space(root, 26);
        root.addView(text("LABORATORIO · v0.1.0\nTicket de prueba sin validez comercial.", 12, false));
        setContentView(scroll);
        bindPrinter();
    }

    private void bindPrinter() {
        try {
            status.setText("Conectando impresora…");
            PrinterSdk.getInstance().getPrinter(getApplicationContext(), connection);
            bound = true;
        } catch (Exception e) { status.setText("No se pudo conectar"); Log.e(TAG, "bind", e); }
    }

    private String stateLabel(Status state) {
        if (state == Status.READY) return "Preparada para imprimir";
        if (state == Status.ERR_PAPER_OUT) return "Falta papel";
        if (state == Status.ERR_COVER || state == Status.ERR_COVER_INCOMPLETE) return "Tapa abierta";
        if (state == Status.ERR_PRINTER_HOT) return "Cabezal caliente";
        return "Estado: " + state;
    }

    private void refreshStatus() {
        worker.execute(() -> {
            try {
                PrinterSdk.Printer service = printer;
                if (service == null) return;
                Status state = service.queryApi().getStatus();
                String info = "SUNMI V3 · PrinterX 1.0.20\n" + stateLabel(state);
                Log.i(TAG, "PRINTER_STATUS " + info);
                main.post(() -> { if (!destroyed) detail.setText(info); });
            } catch (Exception e) { Log.e(TAG, "status", e); }
        });
    }

    private void printTicket() {
        if (busy || printer == null) return;
        busy = true;
        printButton.setEnabled(false); refreshButton.setEnabled(false);
        result.setText("Enviando ticket a la impresora…");
        final int job = ++jobSequence;
        main.postDelayed(timeout, 30000);
        worker.execute(() -> {
            try {
                PrinterSdk.Printer service = printer;
                if (service == null) throw new IllegalStateException("Servicio desconectado");
                Status state = service.queryApi().getStatus();
                if (state != Status.READY) throw new IllegalStateException(stateLabel(state));
                LineApi line = service.lineApi();
                String date = new SimpleDateFormat("dd/MM/yyyy HH:mm:ss", Locale.ROOT).format(new Date());
                line.enableTransMode(true);
                line.initLine(BaseStyle.getStyle());
                line.printText("VOLTA", TextStyle.getStyle().setTextSize(40).setAlign(Align.CENTER));
                line.printText("PRUEBA DE IMPRESION", TextStyle.getStyle().setTextSize(24).setAlign(Align.CENTER));
                line.printText("--------------------------------\nSUNMI V3 / Android 13\n" + date +
                    "\n\n1 x Pizza de prueba    10,00 EUR\n1 x Bebida de prueba    2,00 EUR\n--------------------------------\nTOTAL DE PRUEBA        12,00 EUR\n\n" +
                    "Caracteres: á é í ó ú ñ €\n", TextStyle.getStyle().setTextSize(24));
                line.printQrCode("VOLTA-POS-LAB-0.1.0", QrStyle.getStyle().setDot(4).setAlign(Align.CENTER));
                line.printText("SIN VALIDEZ COMERCIAL\nVolta POS Lab 0.1.0\n\n", TextStyle.getStyle().setTextSize(22).setAlign(Align.CENTER));
                line.autoOut();
                line.printTrans(new PrintResult() {
                    @Override public void onResult(int code, String message) {
                        Log.i(TAG, "PRINT_RESULT code=" + code + " message=" + message);
                        main.post(() -> finishJob(job, code == 0 ?
                            "Impresión confirmada por SUNMI. Comprueba el ticket y su código QR." :
                            "Resultado " + code + ": " + message + ". Revisa el ticket antes de repetir."));
                    }
                });
            } catch (Exception e) {
                Log.e(TAG, "PRINT_ERROR", e);
                main.post(() -> finishJob(job, "No se completó: " + e.getMessage()));
            }
        });
    }

    private void finishJob(int job, String message) {
        if (destroyed || !busy || job != jobSequence) return;
        busy = false; main.removeCallbacks(timeout);
        result.setText(message);
        printButton.setEnabled(printer != null); refreshButton.setEnabled(true);
        refreshStatus();
    }

    private TextView text(String value, int size, boolean bold) {
        TextView view = new TextView(this); view.setText(value); view.setTextSize(size);
        view.setTextColor(Color.rgb(42, 32, 57));
        view.setPadding(0, dp(4), 0, dp(6));
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private void space(LinearLayout root, int height) { root.addView(new View(this), new LinearLayout.LayoutParams(1, dp(height))); }
    @Override protected void onDestroy() {
        destroyed = true; main.removeCallbacksAndMessages(null);
        if (bound) PrinterSdk.getInstance().destroy();
        worker.shutdown(); super.onDestroy();
    }
}
