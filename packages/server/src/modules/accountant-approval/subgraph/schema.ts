import { parse } from 'graphql';

export const typeDefsAccountantApproval = parse(/* GraphQL */ `
  extend schema
    @link(
      url: "https://specs.apollo.dev/federation/v2.3"
        import: ["@key", "@shareable"]
    ) {
        type Mutation {
            updateChargeAccountantApproval(
                chargeId: UUID!
                approvalStatus: AccountantStatus!
            ): AccountantStatus! @auth(role: ACCOUNTANT)
            updateBusinessTripAccountantApproval(
                businessTripId: UUID!
                approvalStatus: AccountantStatus!
            ): AccountantStatus! @auth(role: ACCOUNTANT)
        }

        type Charge @key(fields: "id") {
            id: UUID!
            accountantApproval: AccountantStatus!
        }

        type CommonCharge @key(fields: "id") {
            id: UUID!
            accountantApproval: AccountantStatus!
        }

        type FinancialCharge @key(fields: "id") {
            id: UUID!
            accountantApproval: AccountantStatus!
        }

        type ConversionCharge @key(fields: "id") {
            id: UUID!
            accountantApproval: AccountantStatus!
        }

        type SalaryCharge @key(fields: "id") {
            id: UUID!
            accountantApproval: AccountantStatus!
        }

        type InternalTransferCharge @key(fields: "id") {
            id: UUID!
            accountantApproval: AccountantStatus!
        }

        type DividendCharge @key(fields: "id") {
            id: UUID!
            accountantApproval: AccountantStatus!
        }

        type BusinessTripCharge @key(fields: "id") {
            id: UUID!
            accountantApproval: AccountantStatus!
        }

        type MonthlyVatCharge @key(fields: "id") {
            id: UUID!
            accountantApproval: AccountantStatus!
        }

        type BankDepositCharge @key(fields: "id") {
            id: UUID!
            accountantApproval: AccountantStatus!
        }

        type CreditcardBankCharge @key(fields: "id") {
            id: UUID!
            accountantApproval: AccountantStatus!
        }

        input UpdateChargeInput {
            accountantApproval: AccountantStatus
        }

        type BusinessTrip @key(fields: "id") {
            id: UUID!
            accountantApproval: AccountantStatus!
        }

        enum AccountantStatus {
            UNAPPROVED
            APPROVED
            PENDING
        }
        
    }
`);

// // eslint-disable-next-line import/no-default-export
// export default gql`
//   extend type Mutation {
//     updateChargeAccountantApproval(
//       chargeId: UUID!
//       approvalStatus: AccountantStatus!
//     ): AccountantStatus! @auth(role: ACCOUNTANT)
//     updateBusinessTripAccountantApproval(
//       businessTripId: UUID!
//       approvalStatus: AccountantStatus!
//     ): AccountantStatus! @auth(role: ACCOUNTANT)
//   }

//   extend interface Charge {
//     " calculated based on ledger record and transaction approvals "
//     accountantApproval: AccountantStatus!
//   }

//   extend type CommonCharge {
//     accountantApproval: AccountantStatus!
//   }

//   extend type FinancialCharge {
//     accountantApproval: AccountantStatus!
//   }

//   extend type ConversionCharge {
//     accountantApproval: AccountantStatus!
//   }

//   extend type SalaryCharge {
//     accountantApproval: AccountantStatus!
//   }

//   extend type InternalTransferCharge {
//     accountantApproval: AccountantStatus!
//   }

//   extend type DividendCharge {
//     accountantApproval: AccountantStatus!
//   }

//   extend type BusinessTripCharge {
//     accountantApproval: AccountantStatus!
//   }

//   extend type MonthlyVatCharge {
//     accountantApproval: AccountantStatus!
//   }

//   extend type BankDepositCharge {
//     accountantApproval: AccountantStatus!
//   }

//   extend type CreditcardBankCharge {
//     accountantApproval: AccountantStatus!
//   }

//   extend input UpdateChargeInput {
//     accountantApproval: AccountantStatus
//   }

//   extend type BusinessTrip {
//     accountantApproval: AccountantStatus!
//   }

//   " represents accountant approval status "
//   enum AccountantStatus {
//     UNAPPROVED
//     APPROVED
//     PENDING
//   }
// `;
