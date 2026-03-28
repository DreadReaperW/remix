import * as process from 'node:process';
import { runCompletionCommand } from "./commands/completion.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { getCliHelpText, runHelpCommand } from "./commands/help.js";
import { runNewCommand } from "./commands/new.js";
import { runRoutesCommand } from "./commands/routes.js";
import { runSkillsCommand } from "./commands/skills.js";
import { runVersionCommand } from "./commands/version.js";
import { renderCliError, unknownCommand } from "./errors.js";
import { setCliRuntimeContext } from "./runtime-context.js";
import { configureColors, restoreTerminalFormatting } from "./terminal.js";
export async function run(argv = process.argv.slice(2), context = {}) {
    let previousContext = setCliRuntimeContext({
        cwd: process.cwd(),
        ...context,
    });
    try {
        while (argv[0] === '--') {
            argv = argv.slice(1);
        }
        let globalOptions = extractGlobalOptions(argv);
        argv = globalOptions.argv;
        configureColors({ disabled: globalOptions.noColor });
        if (argv.length === 0) {
            process.stdout.write(getCliHelpText());
            return 0;
        }
        let [command, ...rest] = argv;
        if (command === '-h' || command === '--help') {
            process.stdout.write(getCliHelpText());
            return 0;
        }
        return await runCommand(command, rest);
    }
    finally {
        setCliRuntimeContext(previousContext);
        restoreTerminalFormatting();
    }
}
async function runCommand(command, argv) {
    if (command === 'help') {
        return runHelpCommand(argv);
    }
    if (command === '-v' || command === '--version') {
        return runVersionCommand([]);
    }
    if (command === 'new') {
        return runNewCommand(argv);
    }
    if (command === 'completion') {
        return runCompletionCommand(argv);
    }
    if (command === 'doctor') {
        return runDoctorCommand(argv);
    }
    if (command === 'skills') {
        return runSkillsCommand(argv);
    }
    if (command === 'routes') {
        return runRoutesCommand(argv);
    }
    if (command === 'version') {
        return runVersionCommand(argv);
    }
    process.stderr.write(renderCliError(unknownCommand(command), { helpText: getCliHelpText() }));
    return 1;
}
function extractGlobalOptions(argv) {
    let filteredArgv = [];
    let noColor = false;
    for (let index = 0; index < argv.length; index++) {
        let arg = argv[index];
        if (arg === '--') {
            filteredArgv.push(...argv.slice(index));
            break;
        }
        if (arg === '--no-color') {
            noColor = true;
            continue;
        }
        filteredArgv.push(arg);
    }
    return {
        argv: filteredArgv,
        noColor,
    };
}
