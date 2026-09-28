import fs from 'fs';
import path from 'path';

const BACKEND_URL = 'https://dl-project-agrifusion-backend.onrender.com/api/v1/predict/disease';

// Create a small 100x100 JPEG leaf mock buffer
function createSampleImageBuffer() {
  // Simple JPEG header
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x10,
    0x00, 0x10, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0xbf, 0x00, 0xff, 0xd9
  ]);
}

async function runLiveBenchmark() {
  console.log('--- Starting Live Disease API Reliability Benchmark ---');
  console.log(`Target Endpoint: ${BACKEND_URL}`);

  const sampleBuffer = createSampleImageBuffer();
  const testCrops = ['Rice', 'Rice', 'Chilli', 'Cotton', 'Rice'];
  const results = [];

  for (let i = 0; i < testCrops.length; i++) {
    const crop = testCrops[i];
    const start = Date.now();
    console.log(`\n[Request #${i + 1}/${testCrops.length}] Submitting crop: "${crop}"...`);

    const formData = new FormData();
    formData.append('crop', crop);
    const blob = new Blob([sampleBuffer], { type: 'image/jpeg' });
    formData.append('image', blob, 'sample_leaf.jpg');

    let status = null;
    let ok = false;
    let data = null;
    let duration = 0;

    try {
      const resp = await fetch(BACKEND_URL, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(60000),
      });

      duration = Date.now() - start;
      status = resp.status;
      ok = resp.ok;

      const rawText = await resp.text();
      try {
        data = JSON.parse(rawText);
      } catch {
        data = rawText.slice(0, 200);
      }
    } catch (err) {
      duration = Date.now() - start;
      status = 'TIMEOUT_OR_NET_ERR';
      data = err.message;
    }

    const outcome = data?.result?.inference_outcome || data?.inference_outcome || 'unknown';
    const primaryDiag = data?.result?.primary_diagnosis || data?.primary_diagnosis || null;
    const conf = data?.result?.top_confidence || data?.top_confidence || null;
    const stageTimings = data?.result?.stage_timings_ms || data?.stage_timings_ms || null;

    console.log(`  -> Duration: ${duration}ms | HTTP Status: ${status}`);
    console.log(`  -> Outcome: ${outcome} | Primary: ${primaryDiag} | Conf: ${conf}`);

    results.push({
      reqNum: i + 1,
      crop,
      durationMs: duration,
      status,
      ok,
      outcome,
      primaryDiag,
      conf,
      stageTimings,
    });
  }

  // Latency metrics calculation
  const durations = results.map(r => r.durationMs).sort((a, b) => a - b);
  const p50 = durations[Math.floor(durations.length * 0.5)];
  const p95 = durations[Math.floor(durations.length * 0.95)];
  const timeouts = results.filter(r => r.status === 'TIMEOUT_OR_NET_ERR' || r.status === 504).length;
  const failures = results.filter(r => !r.ok).length;

  console.log('\n========================================');
  console.log('--- LIVE BENCHMARK SUMMARY ---');
  console.log(`Total Requests: ${results.length}`);
  console.log(`p50 Latency: ${p50} ms`);
  console.log(`p95 Latency: ${p95} ms`);
  console.log(`Timeout Count / Rate: ${timeouts} / ${((timeouts / results.length) * 100).toFixed(1)}%`);
  console.log(`Failure Count / Rate: ${failures} / ${((failures / results.length) * 100).toFixed(1)}%`);
  console.log('========================================\n');
}

runLiveBenchmark();
