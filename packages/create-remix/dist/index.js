#!/usr/bin/env node
import { run } from "./lib/run.js";
if (import.meta.main) {
    void run().then((exitCode) => {
        setExitCode(exitCode);
    }, (error) => {
        console.error(error);
        setExitCode(1);
    });
}
function setExitCode(exitCode) {
    globalThis.process.exitCode = exitCode;
}
export { run };
