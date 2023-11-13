import type { IGetChargesByIdsResult } from "@modules/charges/types";
import type { IGetAllSalaryRecordsResult } from "../types.js";
import { isBatchedCharge } from "./batched-salary.helper.js";

export function filterSalaryRecordsByCharge(charge: IGetChargesByIdsResult, salaryRecords: IGetAllSalaryRecordsResult[]) {
    if (salaryRecords.length === 0) {
        return [];
    }

    const isBatched = isBatchedCharge(charge);

    return salaryRecords.filter(
        record =>
            isBatched ||
            charge.transactions_event_amount?.replace('-', '') ===
            record.direct_payment_amount?.replace('-', ''),
    )
}