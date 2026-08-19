// routes/route-payment.js
const config = require('../config');
const express = require('express');
const { initiate3DSPayment, inquireTransaction, transactionCompletion } = require('../services/ipg-api');
const router = express.Router();
const { workerSave, workerRead, workerReadLast } = require('../workerHelper'); 
const stepReqRsp = require('../stepReqRsp');



/**
 * POST /api/payment/initiate
 * 发起 3DS 支付
 */
router.post('/initiate', async (req, res) => {

    try {

 

        const {
            cardNumber, expiryMonth, expiryYear, cvv,
            amount, currency,
            billingAddress, shippingAddress,
            browserParams,
            challengeIndicator,
            challengeWindowSize
        } = req.body;

        if (!cardNumber || !expiryMonth || !expiryYear || !cvv || !amount || !currency) {
            return res.status(400).json({
                error: 'Missing required payment parameters'
            });
        }

        const result = await initiate3DSPayment({                   // ipg-api.js
            cardNumber,
            expiryMonth,
            expiryYear,
            cvv,
            amount,
            currency,
            billingAddress,
            shippingAddress,
            browserParams,
            challengeIndicator,
            challengeWindowSize,
        });

        // reference:21]
        const status = result.transactionStatus;

        // Inside the POST /initiate handler, after getting the result:
        if (result.authenticationResponse?.secure3dMethod?.secure3dTransId) {
            // Store the mapping so the webhook knows which transaction to update
            stepReqRsp.checkOutInp= req.body;
            stepReqRsp.init3DSRsp= result;

            try {
                await workerSave( result.ipgTransactionId, stepReqRsp);         // ipgTransactionId as a key
            } catch (error) {
                console.error('Failed to save request body in worker:', error);
            }
            
            console.log('Mapped secure3dTransId to ipgTransactionId:', {
                secure3dTransId: result.authenticationResponse.secure3dMethod.secure3dTransId,
                ipgTransactionId: result.ipgTransactionId
            });
        }

        if (status === 'WAITING' && result.authenticationResponse?.secure3dMethod?.methodForm) {
            // 3DS Method[reference:22]

            return res.json({
                status: 'WAITING',
                ipgTransactionId: result.ipgTransactionId,
                methodForm: result.authenticationResponse.secure3dMethod.methodForm,
                secure3dTransId: result.authenticationResponse.secure3dMethod.secure3dTransId,
                message: '3DS authentication required. Please render the method form as a hidden iframe.',
                storeId: config.storeId  // Include storeId for frontend use
            });
        }

        if (status === 'APPROVED' || status === 'DECLINED') {
            // 无摩擦流程已完成[reference:23]
            return res.json({
                status: result.transactionStatus,
                ipgTransactionId: result.ipgTransactionId,
                responseCode3dSecure: result.secure3dResponse?.responseCode3dSecure,
                transaction: result
            });
        }

        // 其他状态
        return res.json(result);

    } catch (error) {
        console.error('Payment initiation error:', error);
        res.status(500).json({
            error: 'Payment initiation failed',
            details: error.response?.data || error.message
        });
    }
});


/**
 * GET /api/payment/status/:ipgTransactionId
 * Poll transaction status (used by frontend during 3DS verification)
 */
router.get('/status/:ipgTransactionId', async (req, res) => {
    try {
        const { ipgTransactionId } = req.params;

        if (!ipgTransactionId) {
            return res.status(400).json({ error: 'Transaction ID is required' });
        }

        // Call the Fiserv Gateway to get the current transaction state
        const transactionData = await inquireTransaction(ipgTransactionId);

        let stepData = null;
        let acsURL = null;

        // Poll until stepData contains a valid acsURL
        while (!acsURL) {
            stepData = await workerReadLast();

            // Safely check if acsURL exists in the response object
            acsURL = stepData?.upd3DSRsp?.authenticationResponse?.params?.acsURL;

            if (!acsURL) {
                // Wait 1 second (1000 ms) before retrying
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }

        // return to frontend
        res.json({
            acsURL: acsURL,
            cReq: stepData.upd3DSRsp.authenticationResponse.params.cReq,
            sessionData: stepData?.upd3DSRsp?.authenticationResponse?.params?.sessiondata,
            transactionStatus: transactionData.transactionState,
            raw: transactionData
        });

    } catch (error) {
        console.error('Transaction status inquiry failed:', error);
        // Check if it's a 404 from Fiserv (transaction not found)
        const statusCode = error.response?.status || 500;
        res.status(statusCode).json({
            error: 'Failed to fetch transaction status',
            details: error.response?.data || error.message
        });
    }
});

module.exports = router;
