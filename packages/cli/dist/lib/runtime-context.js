import * as process from 'node:process';
let currentContext = {};
export function getCliRuntimeContext() {
    return currentContext;
}
export function getRuntimeRemixVersion() {
    let remixVersion = currentContext.remixVersion?.trim();
    return remixVersion && remixVersion.length > 0 ? remixVersion : undefined;
}
export function getRuntimeCwd() {
    let cwd = currentContext.cwd?.trim();
    return cwd && cwd.length > 0 ? cwd : process.cwd();
}
export function setCliRuntimeContext(context) {
    let previousContext = currentContext;
    currentContext = { ...context };
    return previousContext;
}
