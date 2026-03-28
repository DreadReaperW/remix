import * as process from 'node:process';
import { run as runCli } from '@remix-run/cli';
export async function run(argv = process.argv.slice(2)) {
    while (argv[0] === '--') {
        argv = argv.slice(1);
    }
    return runCli(['new', ...argv]);
}
