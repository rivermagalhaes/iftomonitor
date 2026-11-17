// Compatibility for restricted Windows sessions where terminal metadata fails.
// Only userInfo's ENOMEM is handled; Capacitor/plugin/filesystem errors propagate.
const os = require('node:os');
const original = os.userInfo;
os.userInfo = function (...args) {
  try { return original.apply(this,args); }
  catch (error) {
    if (error.code !== 'ERR_SYSTEM_ERROR' || error.info?.syscall !== 'uv_os_get_passwd' || error.info?.code !== 'ENOMEM') throw error;
    console.error('[terminal-info] os.userInfo indisponível (ENOMEM); usando variáveis do terminal.');
    return { username:process.env.USERNAME || '', homedir:process.env.USERPROFILE || '', shell:process.env.COMSPEC || 'cmd.exe', uid:-1, gid:-1 };
  }
};
