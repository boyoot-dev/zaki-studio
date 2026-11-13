'use strict';

// Tesseract's worker, started with its relaxed-SIMD core turned off (task 156).
//
// tesseract.js 7.0.0 picks its WASM core by what the JavaScript engine supports. On Node 22 the
// engine claims relaxed SIMD, so the worker loads tesseract-core-relaxedsimd, and that build
// cannot read the float models the owner uses (tessdata_best): recognition aborts at once with
// "missing function: tesseract::DotProductSSE" (found 2026-11-13; reported for this exact
// version in naptha/tesseract.js#1080, whose workaround this file is). The plain SIMD core reads
// those models correctly, so this hides relaxed SIMD from the feature test before the worker's
// own code reads it. English's integer model works either way.
//
// The main process and `npm run material-check` pass this file as the worker's path, from the
// Studio's own folder, so the worker, the core and the language files are all local. It must
// stay a plain CommonJS file on disk: worker_threads loads it as it is, not through a bundler.

const path = require('node:path');

const worker = require.resolve('tesseract.js/src/worker-script/node/index.js');
const detect = require.resolve('wasm-feature-detect', {
	paths: [path.dirname(worker)],
});

// The worker's core loader destructures these at require time, so this must happen first.
const features = require(detect);
require.cache[detect].exports = {
	...features,
	relaxedSimd: async () => false,
};

require(worker);
