// worker.js
const { parentPort, workerData } = require('worker_threads');
const { task, payload, key } = workerData;

if (task === 'save') {
      // simulate processing before saving
      const processed = { secure3dTransId: key, ...payload, savedAt: new Date().toISOString() };
      parentPort.postMessage(processed);
} if (task === 'read') {
      const processed = payload.find(item => item.secure3dTransId === key);
      parentPort.postMessage(processed || null);
} if (task === 'update') {
      const item = payload.find(item => item.secure3dTransId === key);
  if (item) {
    // Merge existing item with updated properties
    const updated = { 
      ...item, 
      ...key, // payload passed as key/updates, or merge fields directly
      updatedAt: new Date().toISOString() 
    };
    parentPort.postMessage(updated);
  } else {
    parentPort.postMessage(null);
  } 


} else {
      parentPort.postMessage({ error: 'Unknown task' });
}
