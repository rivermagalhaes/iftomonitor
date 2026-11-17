import { readFileSync } from 'node:fs';
﻿import { test, expect } from 'vitest';
// Build helpers are pure; importing does not execute Gradle.
// @ts-expect-error Local JavaScript helper has no declaration file.
import { detectEnvironment, verifyApk } from '../scripts/build-apk.mjs';
// @ts-expect-error Local JavaScript helper has no declaration file.
import { checkManifest } from '../scripts/check-android-manifest.mjs';
test('APK detector usa variáveis e valida ausências',()=> {const env=detectEnvironment({JAVA_HOME:'jdk',ANDROID_HOME:'sdk'},()=>true);expect(env.JAVA_HOME).toBe('jdk');expect(env.ANDROID_SDK_ROOT).toBe('sdk');expect(()=>detectEnvironment({},()=>false)).toThrow('JDK');expect(()=>detectEnvironment({JAVA_HOME:'jdk'},(p:string)=>p.includes('java'))).toThrow('SDK');});
test('APK detector seleciona JDK mais recente e SDK padrão',()=>{const env=detectEnvironment({LOCALAPPDATA:'local'},()=>true,()=>['jdk-21.0.9','jdk-21.0.13']);expect(env.JAVA_HOME).toContain('jdk-21.0.13');expect(env.ANDROID_HOME).toContain('Android');});
test('manifesto exige as duas permissões reais',()=> {expect(()=>checkManifest('<!-- ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION -->')).toThrow();expect(checkManifest(readFileSync('android/app/src/main/AndroidManifest.xml','utf8'))).toBe(true);expect(()=>checkManifest('<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>')).toThrow('COARSE');});
test('APK rejeita conteúdo sem ZIP',()=> expect(()=>verifyApk(Buffer.from('invalid APK'))).toThrow());

test('manifesto comentado não satisfaz permissões',()=> expect(()=>checkManifest('<!-- <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/><uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/> -->')).toThrow());
