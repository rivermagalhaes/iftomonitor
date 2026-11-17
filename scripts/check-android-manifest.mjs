import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export function checkManifest(text) {
 text = text.replace(/<!--[\s\S]*?-->/g, '');
 for (const permission of ['ACCESS_FINE_LOCATION','ACCESS_COARSE_LOCATION','ACCESS_BACKGROUND_LOCATION','FOREGROUND_SERVICE','FOREGROUND_SERVICE_LOCATION','POST_NOTIFICATIONS']) {
  if (!new RegExp(`<uses-permission\\b[^>]*android:name=["']android\\.permission\\.${permission}["']`).test(text)) throw new Error(`Manifesto sem ${permission}. APK não pode ser gerado.`);
 }
 return true;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { checkManifest(readFileSync('android/app/src/main/AndroidManifest.xml','utf8')); console.log('Manifesto: permissões de localização e segundo plano presentes'); }
