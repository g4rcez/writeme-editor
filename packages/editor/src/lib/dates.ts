import { Dates as SolverDates } from "solver/dates";

const EDITOR_DAYS_UNTIL_PATTERN = /^days?\s+(?:until|till|before|since|after)\s+(.+)$/i;

function evaluateDaysUntil(expression: string): string | null {
    if (!EDITOR_DAYS_UNTIL_PATTERN.test(expression.trim())) return null;
    return SolverDates.evaluateDaysUntil(expression);
}

function evaluateNatural(expression: string): string | null {
    return (
        evaluateDaysUntil(expression) ??
        SolverDates.evaluateDateArithmetic(expression) ??
        SolverDates.evaluateEpoch(expression) ??
        SolverDates.evaluateTimezone(expression)
    );
}

export const Dates = {
    ...SolverDates,
    evaluateDaysUntil,
    evaluateNatural,
};
