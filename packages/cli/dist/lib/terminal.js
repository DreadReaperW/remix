import * as process from 'node:process';
const ANSI_RESET = '\u001B[0m';
const ANSI_BOLD = '\u001B[1m';
const ANSI_CLEAR_LINE = '\u001B[2K';
const ANSI_CURSOR_TO_START = '\r';
const ANSI_LIGHT_BLUE = '\u001B[94m';
const ANSI_LIGHT_GREEN = '\u001B[92m';
const ANSI_LIGHT_GRAY = '\u001B[90m';
const ANSI_LIGHT_MAGENTA = '\u001B[95m';
const ANSI_LIGHT_RED = '\u001B[91m';
const ANSI_LIGHT_YELLOW = '\u001B[93m';
let colorDisabledByFlag = false;
export function configureColors(options) {
    colorDisabledByFlag = options.disabled;
}
export function bold(text, target = process.stdout) {
    return paint(text, ANSI_BOLD, target);
}
export function lightGreen(text, target = process.stdout) {
    return paint(text, ANSI_LIGHT_GREEN, target);
}
export function lightBlue(text, target = process.stdout) {
    return paint(text, ANSI_LIGHT_BLUE, target);
}
export function lightGray(text, target = process.stdout) {
    return paint(text, ANSI_LIGHT_GRAY, target);
}
export function lightMagenta(text, target = process.stdout) {
    return paint(text, ANSI_LIGHT_MAGENTA, target);
}
export function lightRed(text, target = process.stdout) {
    return paint(text, ANSI_LIGHT_RED, target);
}
export function lightYellow(text, target = process.stdout) {
    return paint(text, ANSI_LIGHT_YELLOW, target);
}
export function reset(target) {
    return isColorDisabled(target) ? '' : ANSI_RESET;
}
export function remixWordmark(target = process.stdout) {
    if (isColorDisabled(target)) {
        return 'REMIX';
    }
    return [
        paint('R', ANSI_LIGHT_BLUE, target),
        paint('E', ANSI_LIGHT_GREEN, target),
        paint('M', ANSI_LIGHT_YELLOW, target),
        paint('I', ANSI_LIGHT_MAGENTA, target),
        paint('X', ANSI_LIGHT_RED, target),
    ].join('');
}
export function clearCurrentLine() {
    return `${ANSI_CURSOR_TO_START}${ANSI_CLEAR_LINE}`;
}
export function restoreTerminalFormatting() {
    if (canUseAnsi(process.stdout)) {
        process.stdout.write(ANSI_RESET);
        return;
    }
    if (canUseAnsi(process.stderr)) {
        process.stderr.write(ANSI_RESET);
    }
}
function paint(text, colorCode, target) {
    return isColorDisabled(target) ? text : `${colorCode}${text}${ANSI_RESET}`;
}
function isColorDisabled(target) {
    return colorDisabledByFlag || process.env.NO_COLOR != null || !canUseAnsi(target);
}
export function canUseAnsi(target) {
    return process.env.TERM !== 'dumb' && target.isTTY;
}
