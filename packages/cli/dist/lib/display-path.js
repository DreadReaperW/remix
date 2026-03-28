import * as path from 'node:path';
import { getRuntimeCwd } from "./runtime-context.js";
export function getDisplayPath(filePath, cwd = getRuntimeCwd()) {
    let relativePath = path.relative(path.resolve(cwd), path.resolve(filePath));
    if (relativePath.length === 0) {
        return '.';
    }
    if (path.isAbsolute(relativePath)) {
        return filePath;
    }
    return relativePath;
}
