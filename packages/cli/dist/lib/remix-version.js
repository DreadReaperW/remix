import { remixVersionUnavailable } from "./errors.js";
import { getRuntimeRemixVersion } from "./runtime-context.js";
export function readRemixVersion() {
    let remixVersion = getRuntimeRemixVersion();
    if (remixVersion == null) {
        throw remixVersionUnavailable();
    }
    return remixVersion;
}
