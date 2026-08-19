// config/index.js
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');

const myEnv = dotenv.config();
const expandedEnv = dotenvExpand.expand(myEnv);     // expaned myEnv, the .env can support variable reference like TERM_URL=${BASE_URL}/webhook/term

module.exports = {
    apiKey: process.env.FISERV_API_KEY,
    apiSecret: process.env.FISERV_API_SECRET,
    storeId: process.env.FISERV_STORE_ID,
    baseUrl: process.env.FISERV_BASE_URL,
    termURL: process.env.TERM_URL,
    methodNotificationURL: process.env.METHOD_NOTIFICATION_URL,
    port: process.env.PORT || 3000
};

