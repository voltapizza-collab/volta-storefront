package com.volta.poslab;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.ECGenParameterSpec;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;

/** USB pilot uses loopback only. Production builds must use HTTPS with platform validation. */
public final class PosClient {
    public static final String BASE_URL = ConnectionConfig.SERVER_URL;
    private static final String SIGN_KEY = "volta.pos.device.v1";
    private static final String SESSION_KEY = "volta.pos.session.v1";
    private final SharedPreferences prefs;
    private final KeyStore keys;
    public PosClient(Context context) throws Exception {
        prefs = context.getSharedPreferences("volta-pos-identity-usb-pilot", Context.MODE_PRIVATE);
        keys = KeyStore.getInstance("AndroidKeyStore"); keys.load(null);
        if (!keys.containsAlias(SIGN_KEY)) {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("EC", "AndroidKeyStore");
            generator.initialize(new KeyGenParameterSpec.Builder(SIGN_KEY, KeyProperties.PURPOSE_SIGN | KeyProperties.PURPOSE_VERIFY)
                .setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1")).setDigests(KeyProperties.DIGEST_SHA256).build());
            generator.generateKeyPair();
        }
        if (!keys.containsAlias(SESSION_KEY)) {
            KeyGenerator generator = KeyGenerator.getInstance("AES", "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(SESSION_KEY, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            generator.generateKey();
        }
    }
    public String deviceId() { return prefs.getString("deviceId", ""); }
    public boolean hasSession() { return prefs.contains("session"); }
    public boolean logoutPending() { return prefs.getBoolean("logoutPending", false); }
    private static byte[] bytes(String value) { return value.getBytes(StandardCharsets.UTF_8); }
    private static String b64(byte[] value) { return Base64.encodeToString(value, Base64.NO_WRAP); }
    private static String hash(String value) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes(value));
        StringBuilder result = new StringBuilder();
        for (byte b : digest) result.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
        return result.toString();
    }
    public static class ApiException extends Exception {
        public final int status;
        public final String code;
        ApiException(int status, String code) { super(code); this.status = status; this.code = code; }
    }
    private String token() throws Exception {
        String stored = prefs.getString("session", "");
        if (stored.isEmpty()) return "";
        String[] parts = stored.split(":");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, keys.getKey(SESSION_KEY, null), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.DEFAULT)));
        return new String(cipher.doFinal(Base64.decode(parts[1], Base64.DEFAULT)), StandardCharsets.UTF_8);
    }
    private void saveToken(String token) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, keys.getKey(SESSION_KEY, null));
        String value = b64(cipher.getIV()) + ":" + b64(cipher.doFinal(bytes(token)));
        if (!prefs.edit().putString("session", value).commit()) throw new IOException("No se pudo guardar la sesión");
    }
    private JSONObject request(String method, String suffix, JSONObject payload, boolean withSession, boolean enrollment) throws Exception {
        return (JSONObject) requestValue(method,suffix,payload,withSession,enrollment);
    }
    private Object requestValue(String method, String suffix, JSONObject payload, boolean withSession, boolean enrollment) throws Exception {
        String path = "/api/pos" + suffix;
        String body = payload == null ? "" : payload.toString();
        String authorization = withSession ? "Bearer " + token() : "";
        String id = enrollment ? "enroll" : deviceId();
        String timestamp = Long.toString(System.currentTimeMillis() / 1000);
        byte[] random = new byte[24]; new SecureRandom().nextBytes(random);
        String nonce = Base64.encodeToString(random, Base64.NO_WRAP | Base64.NO_PADDING | Base64.URL_SAFE);
        String canonical = id + "\n" + timestamp + "\n" + nonce + "\n" + method + "\n" + path + "\n" + hash(body) + "\n" + hash(authorization);
        Signature signer = Signature.getInstance("SHA256withECDSA");
        signer.initSign((PrivateKey) keys.getKey(SIGN_KEY, null)); signer.update(bytes(canonical));
        HttpURLConnection connection = (HttpURLConnection) new URL(BASE_URL + path).openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(10000); connection.setReadTimeout(60000);
        connection.setRequestMethod(method);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("X-Volta-Device", id);
        connection.setRequestProperty("X-Volta-Time", timestamp);
        connection.setRequestProperty("X-Volta-Nonce", nonce);
        connection.setRequestProperty("X-Volta-Signature", b64(signer.sign()));
        if (!authorization.isEmpty()) connection.setRequestProperty("Authorization", authorization);
        try {
            if (payload != null) {
                connection.setDoOutput(true);
                try (OutputStream out = connection.getOutputStream()) { out.write(bytes(body)); }
            }
            int status = connection.getResponseCode();
            InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            ByteArrayOutputStream content = new ByteArrayOutputStream();
            if (stream != null) try (InputStream in = stream) {
                byte[] buffer = new byte[4096]; int size;
                while ((size = in.read(buffer)) != -1) {
                    if (content.size() + size > 4_000_000) throw new IOException("Respuesta demasiado grande");
                    content.write(buffer, 0, size);
                }
            }
            String raw = new String(content.toByteArray(), StandardCharsets.UTF_8);
            Object result = raw.isEmpty() ? new JSONObject() : new org.json.JSONTokener(raw).nextValue();
            if (status < 200 || status >= 300) throw new ApiException(status, result instanceof JSONObject ? ((JSONObject)result).optString("error", "server_error") : "server_error");
            return result;
        } finally { connection.disconnect(); }
    }
    public JSONObject enroll(String code) throws Exception {
        JSONObject body = new JSONObject().put("code", code).put("model", android.os.Build.MODEL)
            .put("publicKey", b64(keys.getCertificate(SIGN_KEY).getPublicKey().getEncoded()));
        JSONObject result = request("POST", "/devices/enroll", body, false, true);
        prefs.edit().putString("deviceId", result.getJSONObject("device").getString("id")).commit();
        return result;
    }
    public JSONObject device() throws Exception { return request("GET", "/device", null, false, false); }
    public void login(String username, String pin) throws Exception {
        if (logoutPending()) throw new IOException("Primero debe completarse el cierre de sesión");
        JSONObject result = request("POST", "/session", new JSONObject().put("username", username).put("pin", pin), false, false);
        saveToken(result.getString("token"));
    }
    public JSONObject bootstrap() throws Exception { return request("GET", "/bootstrap", null, true, false); }
    public JSONObject orders() throws Exception { return request("GET", "/orders", null, true, false); }
    public Object uiRequest(String method, String path, JSONObject body) throws Exception {
        if (!path.startsWith("/") || path.contains("..") || path.contains("#") || path.contains("\\")) throw new IOException("Invalid path");
        return requestValue(method, "/ui" + path, body, true, false);
    }
    public void logout() throws Exception {
        prefs.edit().remove("session").putBoolean("logoutPending", true).commit();
        try { request("DELETE", "/session", null, false, false); }
        catch (ApiException e) { if (e.status != 403) throw e; }
        prefs.edit().putBoolean("logoutPending", false).commit();
    }
}
