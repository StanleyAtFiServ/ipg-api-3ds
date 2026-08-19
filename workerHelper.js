const { Worker } = require('worker_threads');
let paymentInfos = [];

function runWorker(task, payload, key) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./worker.js', {
      workerData: { task, payload, key }
    });

    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', code => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
}

async function workerSave( key, payload)
{
    const svRecord = await runWorker('save', payload, key );
    paymentInfos.push(svRecord);
}

async function workerRead( key )
{
    const paymentInfo = await runWorker('read', paymentInfos, key);
    return paymentInfo;
}

async function workerReadLast()
{
    if (paymentInfos.length === 0) {
        return null;
    }
    return paymentInfos[paymentInfos.length - 1];
}

async function workerUpdate(key, payload) {
  const updatedRecord = await runWorker('update', paymentInfos, key);
  if (updatedRecord) {
    // Update the in-memory array with the new data
    const index = paymentInfos.findIndex(item => item.secure3dTransId === key);
    if (index !== -1) {
      paymentInfos[index] = updatedRecord;
    }
  }
  return updatedRecord;
}



module.exports = { 
      workerSave, 
      workerRead,
      workerReadLast,
      workerUpdate,

};
