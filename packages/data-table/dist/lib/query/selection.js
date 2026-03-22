import { normalizeColumnInput } from "../references.js";
export function isSelectionMap(input) {
    return (input.length === 1 &&
        typeof input[0] === 'object' &&
        input[0] !== null &&
        !Array.isArray(input[0]));
}
export function normalizeSelection(input) {
    if (isSelectionMap(input)) {
        let selection = input[0];
        let aliases = Object.keys(selection);
        return aliases.map((alias) => ({
            column: normalizeColumnInput(selection[alias]),
            alias,
        }));
    }
    return input.map((column) => ({
        column,
        alias: column,
    }));
}
