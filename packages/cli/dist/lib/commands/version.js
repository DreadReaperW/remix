import * as process from 'node:process';
import { readRemixVersion } from "../remix-version.js";
import { renderCliError, toCliError } from "../errors.js";
import { parseArgs } from "../parse-args.js";
export async function runVersionCommand(argv) {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(getVersionCommandHelpText());
        return 0;
    }
    try {
        parseArgs(argv, {}, { maxPositionals: 0 });
        process.stdout.write(`${readRemixVersion()}\n`);
        return 0;
    }
    catch (error) {
        process.stderr.write(renderCliError(toCliError(error), { helpText: getVersionCommandHelpText() }));
        return 1;
    }
}
export function getVersionCommandHelpText() {
    return `Usage:
  remix version

Show the current Remix version.

Examples:
  remix version
  remix --version
`;
}
