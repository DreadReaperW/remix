#!/usr/bin/env node
import { run } from "./lib/cli.js";
import { readDevRemixVersion } from "./lib/dev-remix-version.js";
import { renderCliError } from "./lib/errors.js";
if (import.meta.main) {
    void run(undefined, { remixVersion: readDevRemixVersion() }).then((exitCode) => {
        setExitCode(exitCode);
    }, (error) => {
        process.stderr.write(renderCliError(error));
        setExitCode(1);
    });
}
function setExitCode(exitCode) {
    globalThis.process.exitCode = exitCode;
}
export { run };
