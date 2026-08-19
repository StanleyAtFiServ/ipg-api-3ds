// services/payment.js
const axios = require('axios');
const config = require('../config');
const { generateHeaders } = require('./signature');
const PAYMENT_PATH = '/payments';

/**
 * 步骤 1：发起 3DS 支付请求
 * 支持的 requestType: PaymentCardSaleTransaction, PaymentCardPreAuthTransaction 等[reference:2]
 */
async function initiate3DSPayment(paymentData) {
    const {
        cardNumber, expiryMonth, expiryYear, cvv,
        amount, currency,
        billingAddress, shippingAddress,
        browserParams,
        challengeIndicator = '01',
        challengeWindowSize
    } = paymentData;            // extract useful fields from paymentData

    const url = `${config.baseUrl}${PAYMENT_PATH}`;

    const requestBody = {
        requestType: 'PaymentCardSaleTransaction',
        storeId: config.storeId,
        transactionAmount: {
            total: amount,
            currency: currency
        },
        order: {
            billing: {
                address: {}
            }
        },
        paymentMethod: {
            paymentCard: {
                number: cardNumber,
                securityCode: cvv,
                expiryDate: {
                    month: expiryMonth,
                    year: expiryYear
                }
            }
        },
        // 3DS 认证请求[reference:5]
        authenticationRequest: {
            authenticationType: 'Secure3DAuthenticationRequest',
            termURL: config.termURL,                                    // ACS 回调 URL[reference:6]
            methodNotificationURL: config.methodNotificationURL,        // Method 通知 URL[reference:7]
            
        //    challengeIndicator: challengeIndicator,
        //    ...(challengeWindowSize && { challengeWindowSize }),

        //    cardHolderBrowserParams: browserParams || {
        //        browserAcceptHeaders: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
         //       browserIP: '85.117.56.12',
        //        browserLanguage: 'en-US',
        //        browserColorDepth: '24',
        //        browserScreenHeight: '1080',
        //        browserScreenWidth: '1920',
        //        browserTimeZone: '-300',
        //        browserUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        //        browserJavascriptEnabled: 'true',
        //        browserJavaEnabled: 'false'
        //    }
            
        }
    };


    // 强烈推荐同时包含账单和配送地址以降低认证拒绝率[reference:9]
    if (billingAddress) {
        requestBody.order.billing.address = billingAddress;
    }
    if (shippingAddress) {
        requestBody.order.shipping.address = shippingAddress;
    }
    console.log('initiate3DSPayment REQUEST data:', requestBody);
    const body = JSON.stringify(requestBody);
    const headers = generateHeaders('POST', config.apiKey, config.apiSecret, body, PAYMENT_PATH);
   
    try {
        const response = await axios.post(url, requestBody, { headers });
        return response.data;
    } 


     catch (error) {
        console.error('Initiate 3DS payment failed:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * 步骤 2：提交 methodNotificationStatus (PATCH)
 * 在收到或未收到 methodNotification 后调用[reference:11]
 */
async function updateMethodStatus(additionalData={}, methodNotificationStatus) {
   
    const path = `${PAYMENT_PATH}/${additionalData.init3DSRsp.ipgTransactionId}`;
    const url = `${config.baseUrl}${path}`;

    const requestBody = {
        authenticationType: 'Secure3DAuthenticationUpdateRequest',
        storeId: config.storeId,
        billingAddress: additionalData.checkOutInp.billingAddress,  
        securityCode: additionalData.checkOutInp.cvv,  
        methodNotificationStatus: methodNotificationStatus,  // 'RECEIVED' | 'EXPECTED_BUT_NOT_RECEIVED'[reference:12]

    };

    const body = JSON.stringify(requestBody);
    const headers = generateHeaders('PATCH', config.apiKey, config.apiSecret, body, path);

    try {
        const response = await axios.patch(url, requestBody, { headers });

        return response.data;       // cReq and sessionData expected to return, next raises cardholder challegence
    } catch (error) {
        console.error('Update method status failed:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * 步骤 3：提交挑战响应 (cRes)
 * 在 termURL 收到 ACS 的 cRes 后调用[reference:15]
 */
async function transactionCompletion(ipgTransactionId, cRes, additionalData = {}) {
    const path = `${PAYMENT_PATH}/${ipgTransactionId}`;
    const url = `${config.baseUrl}${path}`;

    const requestBody = {
        authenticationType: 'Secure3DAuthenticationUpdateRequest',
        storeId: config.storeId,
        billingAddress: additionalData.billingAddress,  
        securityCode: additionalData.cvv,
        acsResponse: {
            cRes: cRes  // Base64 编码的 cRes[reference:16]
        },
    };

    const body = JSON.stringify(requestBody);
    const headers = generateHeaders('PATCH', config.apiKey, config.apiSecret, body, path);

    try {
        const response = await axios.patch(url, requestBody, { headers });
        return response.data;
    } catch (error) {
        console.error('Submit challenge response failed:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * 查询交易状态
 */

// services/payment.js - ensure this function exists and is exported
async function inquireTransaction(ipgTransactionId) {
  const path = `${PAYMENT_PATH}/${ipgTransactionId}?storeId=${config.storeId}`;
  const url = `${config.baseUrl}${path}`;

  const headers = generateHeaders('GET', config.apiKey, config.apiSecret, '', path);

  try {
    const response = await axios.get(url, { headers });
    return response.data;
  } catch (error) {
    console.error('Transaction inquiry failed:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
    initiate3DSPayment,
    updateMethodStatus,
    inquireTransaction,
    transactionCompletion
};
