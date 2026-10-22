'use strict';

function csvIds(value = '') {
  return value.split(',').map((item) => item.trim().replace(/\D/g, '')).filter(Boolean);
}

function readConfig(env = process.env) {
  return Object.freeze({
    prefix: env.BOT_PREFIX || '!',
    clientId: (env.WWEBJS_CLIENT_ID || 'ruzbot').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'ruzbot',
    sessionPath: env.WWEBJS_SESSION_PATH || '.wwebjs_auth',
    chromeExecutablePath: env.CHROME_EXECUTABLE_PATH || '',
    dashboardPassword: env.DASHBOARD_PASSWORD || '',
    frontendOrigin: env.FRONTEND_ORIGIN || '',
    port: Number(env.PORT || 3000),
    ownerId: (env.BOT_OWNER_WA_ID || '').replace(/\D/g, ''),
    adminIds: csvIds(env.BOT_ADMIN_WA_IDS || '')
  });
}

module.exports = { readConfig };
