package br.edu.ifto.monitor;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import androidx.activity.result.ActivityResult;
import com.getcapacitor.annotation.ActivityCallback;

/** Plugin mínimo: pede ao Android a isenção da otimização de bateria (diálogo oficial). */
@CapacitorPlugin(name = "BatteryOptimization")
public class BatteryOptimizationPlugin extends Plugin {

    private boolean ignoring() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        PowerManager pm = (PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
    }

    private JSObject result() {
        JSObject r = new JSObject();
        r.put("value", ignoring());
        return r;
    }

    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        call.resolve(result());
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        if (ignoring()) {
            call.resolve(result());
            return;
        }
        Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        try {
            startActivityForResult(call, intent, "afterRequest");
        } catch (Exception e) {
            try {
                // Fallback: tela geral de otimização de bateria.
                startActivityForResult(call, new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS), "afterRequest");
            } catch (Exception e2) {
                call.resolve(result());
            }
        }
    }

    @ActivityCallback
    private void afterRequest(PluginCall call, ActivityResult activityResult) {
        if (call == null) return;
        call.resolve(result());
    }
}
