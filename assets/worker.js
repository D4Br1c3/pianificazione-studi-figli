'use strict';

importScripts('state.js', 'calendar.js', 'engine.js');

self.addEventListener('message', async ({ data }) => {
  try {
    let previous = -1;
    const result = await StudyPlan.simulate(data, {
      onProgress(fraction) {
        const percent = Math.floor(fraction * 100);
        if (percent !== previous) self.postMessage({ type: 'progress', fraction });
        previous = percent;
      }
    });
    self.postMessage({ type: 'result', result });
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message });
  }
});
