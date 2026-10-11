const {resolveRuntimeConfig} = require('../apps/web/config/runtime.cjs');
resolveRuntimeConfig({...process.env, NODE_ENV: 'production'});
console.log('Production SITE_URL and API_ORIGIN validated.');
