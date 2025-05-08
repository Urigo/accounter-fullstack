import { IfrsReportingOption } from '../types/index.js';

export function validateCode104(
  amounts: {
    100: number;
    103: number;
    104: number;
  },
  ifrsReportingOption: IfrsReportingOption = IfrsReportingOption.NONE,
): boolean {
  // Rule 2.6: Validate code 104
  if (ifrsReportingOption === IfrsReportingOption.OPTION_2_ADJUSTMENTS) {
    return amounts[100] + amounts[103] === amounts[104];
  }
  return amounts[100] === amounts[104];
}

export function code104Description(
  ifrsReportingOption: IfrsReportingOption = IfrsReportingOption.NONE,
): string {
  // Rule 2.6: Validate code 104
  if (ifrsReportingOption === IfrsReportingOption.OPTION_2_ADJUSTMENTS) {
    return 'Code 104 must equal the sum of codes 100 and 103';
  }
  return 'Code 104 must equal code 100';
}

export function validateCode400(
  amounts: {
    100: number;
    103: number;
    370: number;
    383: number;
    400: number;
  },
  ifrsReportingOption: IfrsReportingOption = IfrsReportingOption.NONE,
): boolean {
  // Rule 2.7: Validate code 400
  if (ifrsReportingOption === IfrsReportingOption.OPTION_1) {
    return amounts[100] + amounts[370] === amounts[400];
  }
  if (ifrsReportingOption === IfrsReportingOption.OPTION_2_ADJUSTMENTS) {
    return amounts[100] + amounts[370] + amounts[103] === amounts[400];
  }
  if (ifrsReportingOption === IfrsReportingOption.OPTION_3_ADJUSTMENTS) {
    return amounts[100] + amounts[370] + amounts[383] === amounts[400];
  }
  return true;
}

export function code400Description(
  ifrsReportingOption: IfrsReportingOption = IfrsReportingOption.NONE,
): string {
  // Rule 2.7: Validate code 400
  if (ifrsReportingOption === IfrsReportingOption.OPTION_1) {
    return 'Code 400 must equal the sum of codes 100 and 370';
  }
  if (ifrsReportingOption === IfrsReportingOption.OPTION_2_ADJUSTMENTS) {
    return 'Code 400 must equal the sum of codes 100, 370, and 103';
  }
  if (ifrsReportingOption === IfrsReportingOption.OPTION_3_ADJUSTMENTS) {
    return 'Code 400 must equal the sum of codes 100, 370, and 383';
  }
  return '';
}
