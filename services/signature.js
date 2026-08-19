// services/signature.js
const crypto = require('crypto');
const CryptoJS = require('crypto-js');
const { v4: uuidv4 } = require('uuid');

/**
 * 生成 Message-Signature
 * @param {string} method - HTTP 方法 (POST, PATCH, GET)
 * @param {string} apiSecret - API Secret
 * @param {string} body - 请求体 JSON 字符串
 * @param {string} contentType - Content-Type
 * @param {string} clientRequestId - 客户端请求 ID
 * @param {string} timestamp - 时间戳 (毫秒)
 * @param {string} path - API 路径
 * @param {string} queryString - 查询字符串 (可选)
 */
function generateSignature(method, apiKey, apiSecret, body, clientRequestId, timestamp,) {

    /*
        const rawSignature = apiKey + clientRequestId + timestamp + body;
        const computedHash = crypto.createHmac('sha256', apiSecret);
        computedHash.update(rawSignature);
        return computedHash.digest('base64');
    */
    var rawSignature = '';
    if (method == 'GET') {
        rawSignature = apiKey + clientRequestId + timestamp;
    } else {
        rawSignature = apiKey + clientRequestId + timestamp + body;
    }

    var computedHash = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, apiSecret.toString());
    computedHash.update(rawSignature);
    computedHash = computedHash.finalize();
    var signature = CryptoJS.enc.Base64.stringify(computedHash);
    return signature;

}

/**
 * 生成请求头
 */
function generateHeaders(method, apiKey, apiSecret, body, path, queryString = '') {
    const clientRequestId = Math.floor((Math.random() * 100000000) + 1).toString(); // 生成随机 Client-Request-Id
    const timestamp = new Date().getTime().toString();

    const signature = generateSignature(
        method,
        apiKey,
        apiSecret,
        body,
        clientRequestId,
        timestamp,
    );

    const contentType = 'application/json';

    return {
        'Content-Type': contentType,
        'Accept': 'application/json',
        'Client-Request-Id': clientRequestId,
        'Api-Key': apiKey,
        'Timestamp': timestamp,
        'Message-Signature': signature
    };
}

module.exports = { generateHeaders };
