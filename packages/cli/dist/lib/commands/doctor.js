import * as path from 'node:path';
import * as process from 'node:process';
import { checkControllerConventions } from "../doctor/controllers.js";
import { checkEnvironment, getEnvironmentFixPlans } from "../doctor/environment.js";
import { applyDoctorFixPlans } from "../doctor/fixes.js";
import { checkProject, getProjectFixPlans } from "../doctor/project.js";
import { createDoctorSuite, createSkippedDoctorSuite, } from "../doctor/types.js";
import { renderCliError, toCliError } from "../errors.js";
import { parseArgs } from "../parse-args.js";
import { createCommandReporter, createStepProgressReporter, } from "../reporter.js";
import { lightRed } from "../terminal.js";
const DOCTOR_SUITE_LABELS = {
    controllers: {
        complete: 'controllers',
        running: 'Checking controllers',
    },
    environment: {
        complete: 'environment',
        running: 'Checking environment',
    },
    project: {
        complete: 'project',
        running: 'Checking project',
    },
};
export async function runDoctorCommand(argv) {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(getDoctorCommandHelpText());
        return 0;
    }
    let options = parseDoctorCommandArgs(argv);
    let reporter = options.json
        ? createCommandReporter()
        : createCommandReporter({ stderr: process.stdout, stdout: process.stdout });
    let progress = null;
    try {
        progress = options.json ? null : createDoctorProgressReporter(reporter);
        if (!options.json) {
            await reporter.status.commandHeader('doctor');
        }
        let report = await collectDoctorReport(progress, options, options.json ? null : reporter);
        if (options.json) {
            process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        }
        else {
            writeDoctorReport(reporter, report);
            reporter.finish();
        }
        if ((options.fix || options.strict) && hasWarningFindings(report.findings)) {
            return 1;
        }
        return 0;
    }
    catch (error) {
        let cliError = toCliError(error);
        progress?.writeSummaryGap();
        process.stderr.write(lightRed(renderCliError(cliError, { helpText: getDoctorCommandHelpText() }), process.stderr));
        if (!options.json) {
            reporter.finish();
        }
        return 1;
    }
}
export function getDoctorCommandHelpText() {
    return `Usage:
  remix doctor [--json] [--strict] [--fix] [--no-color]

Check project environment and Remix app conventions for the current project.

Options:
  --json       Print doctor findings as JSON
  --strict     Exit with status 1 when warning-level findings are present
  --fix        Apply low-risk project and controller fixes

Examples:
  remix doctor
  remix doctor --json
  remix doctor --strict
  remix doctor --fix
`;
}
function parseDoctorCommandArgs(argv) {
    let parsed = parseArgs(argv, {
        fix: { flag: '--fix', type: 'boolean' },
        json: { flag: '--json', type: 'boolean' },
        strict: { flag: '--strict', type: 'boolean' },
    }, { maxPositionals: 0 });
    return {
        fix: parsed.options.fix,
        json: parsed.options.json,
        strict: parsed.options.strict,
    };
}
async function collectDoctorReport(progress, options, reporter) {
    let appliedFixes = [];
    let environment = await runDoctorSuite(progress, 'environment', async () => {
        let result = await checkEnvironment();
        let suiteAppliedFixes = [];
        let finalResult = result;
        if (options.fix && result.projectRoot != null) {
            let fixPlans = getEnvironmentFixPlans(result);
            if (fixPlans.length > 0) {
                suiteAppliedFixes = await applyDoctorFixPlans(result.projectRoot, fixPlans);
                finalResult = await checkEnvironment(result.projectRoot);
            }
        }
        let suite = finalResult.suite;
        if (suiteAppliedFixes.length > 0) {
            suite = {
                ...suite,
                appliedFixes: suiteAppliedFixes,
            };
        }
        return {
            appliedFixes: suiteAppliedFixes,
            projectRoot: finalResult.projectRoot ?? result.projectRoot,
            suite,
        };
    });
    let findings = [...environment.suite.findings];
    appliedFixes.push(...(environment.appliedFixes ?? []));
    let suites = [environment.suite];
    let routesFile = environment.projectRoot == null
        ? undefined
        : path.join(environment.projectRoot, 'app', 'routes.ts');
    writeDoctorSuiteDetails(reporter, environment.suite);
    progress?.writeSummaryGap();
    if (hasWarningFindings(environment.suite.findings)) {
        let projectSuite = createSkippedDoctorSuite('project', 'Blocked by environment warnings.');
        let controllersSuite = createSkippedDoctorSuite('controllers', 'Blocked by environment warnings.');
        suites.push(projectSuite, controllersSuite);
        progress?.skip(projectSuite.name, projectSuite.reason);
        writeDoctorSuiteDetails(reporter, projectSuite);
        progress?.writeSummaryGap();
        progress?.skip(controllersSuite.name, controllersSuite.reason);
        writeDoctorSuiteDetails(reporter, controllersSuite);
        progress?.writeSummaryGap();
        return {
            appRoot: environment.projectRoot,
            appliedFixes,
            findings,
            remainingFindings: findings,
            routesFile,
            suites,
        };
    }
    let project = await runDoctorSuite(progress, 'project', async () => {
        let result = await checkProject(environment.projectRoot);
        let suiteAppliedFixes = [];
        let finalResult = result;
        if (options.fix) {
            let fixPlans = await getProjectFixPlans(environment.projectRoot);
            if (fixPlans.length > 0) {
                suiteAppliedFixes = await applyDoctorFixPlans(environment.projectRoot, fixPlans);
                finalResult = await checkProject(environment.projectRoot);
            }
        }
        let suite = finalResult.suite;
        if (suiteAppliedFixes.length > 0) {
            suite = {
                ...suite,
                appliedFixes: suiteAppliedFixes,
            };
        }
        return {
            appliedFixes: suiteAppliedFixes,
            routeManifest: finalResult.routeManifest,
            routesFile: finalResult.routesFile,
            suite,
        };
    });
    findings.push(...project.suite.findings);
    appliedFixes.push(...(project.appliedFixes ?? []));
    routesFile = project.routesFile;
    suites.push(project.suite);
    writeDoctorSuiteDetails(reporter, project.suite);
    progress?.writeSummaryGap();
    if (hasWarningFindings(project.suite.findings)) {
        let controllersSuite = createSkippedDoctorSuite('controllers', 'Blocked by project warnings.');
        suites.push(controllersSuite);
        progress?.skip(controllersSuite.name, controllersSuite.reason);
        writeDoctorSuiteDetails(reporter, controllersSuite);
        progress?.writeSummaryGap();
        return {
            appRoot: environment.projectRoot,
            appliedFixes,
            findings,
            remainingFindings: findings,
            routesFile,
            suites,
        };
    }
    let controllers = await runDoctorSuite(progress, 'controllers', async () => {
        let controllerResult = await checkControllerConventions(project.routeManifest.appRoot, project.routeManifest.tree);
        let remainingFindings = controllerResult.suite.findings;
        let suiteAppliedFixes = [];
        if (options.fix && controllerResult.fixPlans.length > 0) {
            suiteAppliedFixes = await applyDoctorFixPlans(project.routeManifest.appRoot, controllerResult.fixPlans);
            remainingFindings = getRemainingFindings(controllerResult.suite.findings, suiteAppliedFixes);
        }
        let suite = createDoctorSuite('controllers', remainingFindings);
        if (suiteAppliedFixes.length > 0) {
            suite.appliedFixes = suiteAppliedFixes;
        }
        return { appliedFixes: suiteAppliedFixes, suite };
    });
    findings.push(...controllers.suite.findings);
    appliedFixes.push(...(controllers.appliedFixes ?? []));
    suites.push(controllers.suite);
    writeDoctorSuiteDetails(reporter, controllers.suite);
    progress?.writeSummaryGap();
    let report = {
        appRoot: environment.projectRoot,
        findings,
        routesFile,
        suites,
    };
    if (options.fix) {
        report.appliedFixes = appliedFixes;
        report.remainingFindings = findings;
    }
    return report;
}
function getRemainingFindings(findings, appliedFixes) {
    let appliedFindingKeys = new Set(appliedFixes.map((appliedFix) => `${appliedFix.code}:${appliedFix.routeName ?? ''}`));
    return findings.filter((finding) => !appliedFindingKeys.has(`${finding.code}:${finding.routeName ?? ''}`));
}
function hasWarningFindings(findings) {
    return findings.some((finding) => finding.severity === 'warn');
}
function formatAppliedFix(appliedFix) {
    if (appliedFix.kind === 'update-file') {
        return `Updated ${appliedFix.path}`;
    }
    return `Created ${appliedFix.path}`;
}
async function runDoctorSuite(progress, label, callback) {
    progress?.start(label);
    try {
        let result = await callback();
        if (result.suite.status === 'ok') {
            progress?.succeed(label);
        }
        else if (result.suite.status === 'issues') {
            progress?.fail(label);
        }
        else {
            progress?.skip(label, result.suite.reason);
        }
        return result;
    }
    catch (error) {
        progress?.fail(label);
        throw error;
    }
}
function createDoctorProgressReporter(reporter) {
    return createStepProgressReporter(reporter.status, DOCTOR_SUITE_LABELS);
}
function writeDoctorReport(reporter, report) {
    let warningCount = report.findings.filter((finding) => finding.severity === 'warn').length;
    let adviceCount = report.findings.length - warningCount;
    if ((report.appliedFixes?.length ?? 0) > 0) {
        let fixCount = report.appliedFixes.length;
        reporter.out.line(`Applied ${fixCount} ${fixCount === 1 ? 'fix' : 'fixes'}.`);
    }
    if (report.findings.length === 0) {
        reporter.out.line('Doctor found no issues.');
    }
    reporter.out.line(`Summary: ${warningCount} warnings, ${adviceCount} advice.`);
}
function writeDoctorSuiteDetails(reporter, suite) {
    if (reporter == null) {
        return;
    }
    if (suite.findings.length === 0 && (suite.appliedFixes?.length ?? 0) === 0) {
        return;
    }
    reporter.out.withIndent(() => {
        for (let finding of suite.findings) {
            reporter.out.bullet(reporter.out.label(finding.severity.toUpperCase(), finding.message, {
                tone: finding.severity === 'warn' ? 'warn' : undefined,
            }));
        }
        if ((suite.appliedFixes?.length ?? 0) > 0) {
            reporter.out.section('Applied fixes:', () => {
                reporter.out.bullets((suite.appliedFixes ?? []).map(formatAppliedFix));
            });
        }
    });
}
