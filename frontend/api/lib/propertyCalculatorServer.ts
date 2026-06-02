/**
 * Report PDF calculator surface — runtime from prebuild bundle; types from entry module.
 */
export type { IrrByYearEntry } from "./propertyCalculator/irrCalculator.js";

// @ts-expect-error prebuild ESM bundle (scripts/bundle-property-calculator-server.mjs)
import * as bundled from "./propertyCalculator.server.mjs";
import type * as Entry from "./propertyCalculatorServer.entry.js";

const api = bundled as typeof Entry;

export const computeMetricsFromMonthlySnapshot = api.computeMetricsFromMonthlySnapshot;
export const calculateIRR = api.calculateIRR;
export const calculateIRRByProjectionYear = api.calculateIRRByProjectionYear;
export const irrPercent = api.irrPercent;
export const resolveDefaultIrr = api.resolveDefaultIrr;
export const projectLoanBalanceAfterYears = api.projectLoanBalanceAfterYears;
export const projectValue = api.projectValue;
