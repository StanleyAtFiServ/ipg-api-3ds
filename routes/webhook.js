// routes/route-webhook.js
const express = require('express');
const { updateMethodStatus, submitChallengeResponse, inquireTransaction, transactionCompletion } = require('../services/ipg-api');
const router = express.Router();
const { workerSave, workerRead, workerReadLast, workerUpdate } = require('../workerHelper');
const stepReqRsp = require('../stepReqRsp');


// 用于存储 transactionId 与 secure3dTransId 的映射（生产环境应使用 Redis 或数据库）
const transactionMap = new Map();

/**
 * POST /webhook/method-notification
 * 3DS Method 通知端点[reference:24]
 */
router.post('/method-notification', async (req, res) => {
    try {

        const decoded = Buffer.from(req.body.threeDSMethodData, 'base64').toString('utf-8');
        const threeDSServerTransID = JSON.parse(decoded).threeDSServerTransID; // 验证是否为有效 JSON

        if (!threeDSServerTransID) {
            console.warn('Invalid method notification received');
            return res.status(400).send('Invalid notification data');
        }

        console.log('Received method notification:', { threeDSServerTransID });
        const stepReqRsp = await workerReadLast(); // workerRead(threeDSServerTransID);


        if (!stepReqRsp) {

            console.warn('No transaction found for threeDSServerTransID:', threeDSServerTransID);
            return res.status(200).send('OK');
        }


        // 更新 methodNotificationStatus = RECEIVED[reference:26]
        const updateResult = await updateMethodStatus(stepReqRsp, 'RECEIVED');

        stepReqRsp.upd3DSRsp = updateResult;
        await workerUpdate(stepReqRsp.init3DSRsp.ipgTransactionId, stepReqRsp);

        if (updateResult.transactionStatus === 'WAITING' &&
            updateResult.authenticationResponse?.params?.acsURL) {

            const acsURL = updateResult.authenticationResponse.params.acsURL;
            const creq = updateResult.authenticationResponse.params.cReq;   // adjust key as per your data
            const threeDSSessionData = updateResult.authenticationResponse.params.threeDSSessionData; // adjust


            console.log('Challenge flow required for transaction:', stepReqRsp.init3DSRsp.ipgTransactionId);
            console.log('acsURL: ', acsURL);
            console.log('creq: ', creq);
            console.log('threeDSSessionData', threeDSSessionData);

            res.status(200).send('OK');
        }


    } catch (error) {
        console.error('Method notification error:', error);
        // 返回 200 避免 ACS 重试
        res.status(200).send('OK');
    }
});

/**
 * POST /webhook/term
 * ACS 认证完成回调端点[reference:29]
 */
router.post('/term', async (req, res) => {
    try {

        if ( req.body.cres == null) {
            console.warn('Missing cRes in term callback');
            return res.status(400).send('Missing cres');
        }

        const cRes = req.body.cres
        const jsonString = Buffer.from(cRes, "base64").toString("utf8");
        const jsonObj = JSON.parse(jsonString);
        const threeDSServerTransID = jsonObj.threeDSServerTransID;

        console.log('Received term callback:', { threeDSServerTransID });

        // 查找对应的交易 ID
        const stepReqRsp = await workerReadLast();
        const ipgTransactionId = stepReqRsp?.init3DSRsp?.ipgTransactionId;
        const checkOutInp = stepReqRsp.checkOutInp;

        if (!ipgTransactionId) {
            console.warn('No transaction found for term callback:', threeDSServerTransID);
            // 返回 HTML 让用户知道认证完成
            return sendCompletionPage(res, 'UNKNOWN', 'Transaction not found');
        }

        // 提交 cRes 到 Gateway[reference:30]
        const finalResult = await transactionCompletion(ipgTransactionId, cRes, checkOutInp);

        // 返回完成页面
        sendCompletionPage(
            res,
            finalResult.transactionStatus,
            finalResult.secure3dResponse?.responseCode3dSecure,
            finalResult
        );

    } catch (error) {
        console.error('Term callback error:', error);
        sendCompletionPage(res, 'ERROR', error.message);
    }
});



/**
 * 发送认证完成页面
 */
function sendCompletionPage(res, status, responseCode, data = null) {
    const isSuccess = status === 'APPROVED' && ['1', '4'].includes(responseCode);

    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
    <title>Authentication Complete</title>
    <style>
    body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
    .container { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
    .status { font-size: 48px; margin-bottom: 20px; }
    .success { color: #28a745; }
    .error { color: #dc3545; }
    .detail { color: #666; margin-top: 10px; }
    </style>
    </head>
    <body>
    <div class="container">
    <div class="status ${isSuccess ? 'success' : 'error'}">
    ${isSuccess ? '✅' : '❌'}
    </div>
    <h1>${isSuccess ? 'Authentication Successful' : 'Authentication Failed'}</h1>
    <p>Status: ${status}</p>
    <p class="detail">3DS Response Code: ${responseCode || 'N/A'}</p>
    ${data ? `<pre style="text-align:left;background:#f8f8f8;padding:15px;border-radius:4px;font-size:12px;max-width:500px;overflow:auto;">${JSON.stringify(data, null, 2)}</pre>` : ''}
    <p><a href="/checkout.html">Return to Home</a></p>
    </div>
    <script>
    // 通知父窗口（如在 iframe 中）
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({
            type: '3DS_COMPLETE',
            status: '${status}',
            responseCode: '${responseCode || ''}',
            success: ${isSuccess}
        }, '*');
    }
    </script>
    </body>
    </html>
    `);
}

function parseTermCallback(body) {
    return Buffer.from(base64String, "base64").toString("utf8");
}

module.exports = { router, transactionMap };
