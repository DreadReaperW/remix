import { Worker } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';
import {} from "./playwright.js";
const isInRemixMonorepo = import.meta.url.endsWith('packages/test/src/lib/runner.ts');
const workerUrl = isInRemixMonorepo
    ? new URL('./worker.ts', import.meta.url)
    : new URL('./worker.js', import.meta.url);
const workerE2EUrl = isInRemixMonorepo
    ? new URL('./worker-e2e.ts', import.meta.url)
    : new URL('./worker-e2e.js', import.meta.url);
export async function runServerTests(files, reporter, concurrency, type, options = {}) {
    let counts = { passed: 0, failed: 0, skipped: 0, todo: 0 };
    let envLabel = options.projectName ? `${type}:${options.projectName}` : type;
    function accumulate(results, file) {
        reporter.onResult({ ...results, tests: results.tests.map((t) => ({ ...t, filePath: file })) }, envLabel);
        counts.passed += results.passed;
        counts.failed += results.failed;
        counts.skipped += results.skipped;
        counts.todo += results.todo;
    }
    if (type === 'e2e') {
        await runInConcurrentWorkers(files, concurrency, (file) => runFileInWorker(file, type, (results) => accumulate(results, file), {
            ...options,
            playwrightUseOpts: options.playwrightUseOpts,
        }), () => counts.failed++);
    }
    else {
        await runInConcurrentWorkers(files, concurrency, (file) => runFileInWorker(file, type, (results) => accumulate(results, file)), () => counts.failed++);
    }
    return { ...counts };
}
async function runInConcurrentWorkers(files, concurrency, runFile, onError) {
    let index = 0;
    let active = 0;
    await new Promise((resolve) => {
        function dispatch() {
            while (active < concurrency && index < files.length) {
                let file = files[index];
                index++;
                active++;
                runFile(file).then(() => {
                    active--;
                    if (index < files.length) {
                        dispatch();
                    }
                    else if (active === 0) {
                        resolve();
                    }
                }, (err) => {
                    console.error(`Error running ${file}:`, err.message);
                    console.error(err);
                    onError();
                    active--;
                    if (active === 0 && index >= files.length)
                        resolve();
                    else
                        dispatch();
                });
            }
            if (index >= files.length && active === 0)
                resolve();
        }
        dispatch();
    });
}
function runFileInWorker(file, type, onResults, options = {}) {
    return new Promise((resolve, reject) => {
        let worker = type === 'e2e'
            ? new Worker(workerE2EUrl, {
                workerData: {
                    file: pathToFileURL(file).href,
                    type,
                    open: options.open,
                    playwrightUseOpts: options.playwrightUseOpts,
                },
            })
            : new Worker(workerUrl, {
                workerData: {
                    file: pathToFileURL(file).href,
                    type,
                },
            });
        worker.once('message', (msg) => onResults(msg));
        worker.once('error', reject);
        worker.once('exit', (code) => {
            if (code !== 0)
                reject(new Error(`Worker exited with code ${code}`));
            else
                resolve();
        });
    });
}
