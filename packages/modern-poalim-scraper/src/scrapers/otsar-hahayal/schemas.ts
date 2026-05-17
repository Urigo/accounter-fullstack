import { z } from 'zod';

const isoDateTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T00:00:00$/, 'Expected ISO datetime with zero time component');

const whitespaceStringSchema = z.string().regex(/^\s*$/, 'Expected whitespace-only string');

const decimalNumberSchema = z
  .string()
  .regex(/^-?\d{1,3}(,\d{3})*\.\d{2}$/, 'Expected decimal number with 2 digits after the dot');

const ddTimeSchema = z
  .object({
    'T05CHEAD-SH-TADP-HH': z.string().regex(/^\d{2}$/),
    'T05CHEAD-SH-TADP-MM': z.string().regex(/^\d{2}$/),
    'T05CHEAD-SH-TADP-SS': z
      .string()
      .regex(/^\d{2}$/)
      .optional(),
  })
  .strict();

const ddDateSchema = z
  .object({
    'T05CHEAD-TR-TADP-DD': z.string().regex(/^\d{2}$/),
    'T05CHEAD-TR-TADP-MM': z.string().regex(/^\d{2}$/),
    'T05CHEAD-TR-TADP-YYYY': z.string().regex(/^\d{4}$/),
  })
  .strict();

const ddHeadSchema = z
  .object({
    'T05CHEAD-MCH': z.string().regex(/^\d+$/),
    'T05CHEAD-MESSAGE': z
      .object({
        'T05CHEAD-STR-MSG': z
          .object({
            'T05CHEAD-STR-MSG-TYPE': z.literal('NO_DATA'),
            'T05CHEAD-X-MSG-LKP': z.literal('לא נמצאו נתונים בנושא המבוקש'),
          })
          .strict(),
      })
      .strict()
      .optional(),
    'T05CHEAD-PRIMARY-TITLE': z.object({ 'T05CHEAD-TITLE': z.string() }).strict(),
    'T05CHEAD-SH-TADP': ddTimeSchema,
    'T05CHEAD-SNIF': z.string().regex(/^\d+$/),
    'T05CHEAD-TR-TADP': ddDateSchema,
  })
  .strict();

const ddFooterSchema = z
  .object({
    'T05CTLCH-EN': z.string(),
    'T05CTLCH-HE': z.string(),
  })
  .strict();

const dd1523DetailsSchema = z
  .object({
    'WS-BANK': z.string().regex(/^\d+$/),
    'WS-DATA-2': z
      .object({
        'WS-DATA2-MIS-ISKA': z.string(),
        'WS-DATA2-MAKOR': z.string(),
        'WS-DATA2-S-P': z.string(),
        'WS-DATA2-SIBA': z.string(),
        'WS-DATA2-ZIHUY': z.string(),
        'WS-KOD-BANKAI': z.string(),
        'WS-MAKOR-PEULA': z.string(),
        'WS-MOED-BITZUA': z
          .object({
            'WS-DATE-BITZUA': z.string(),
            'WS-SHAA-BITZUA': z.string(),
          })
          .strict(),
        'WS-RTGS-STATUS': z.string(),
        'WS-SHEM-BANK-MAAVIR': z.string(),
        'WS-SHEM-BANK-MUTAV': z.string(),
        'WS-SHEM-MAAVIR': z.string(),
        'WS-SUG-HAAVARA': z.string(),
        'WS-TS-ASM': z.string(),
        'WS-BANK-MAAVIR': z.string().regex(/^\d+$/),
      })
      .strict(),
    'WS-DATE-HVR': z.string(),
    'WS-LINK-SHURA': z.string(),
    'WS-MAKAF': z.literal('-').optional(),
    'WS-MCH': z.string().regex(/^\d+$/).optional(),
    'WS-MCH-ZAR': z.string().regex(/^\d+$/).optional(),
    'WS-MONE-SIDURI-MEZUKE': z.string(),
    'WS-MUTAV': z.string(),
    'WS-SCH': z.literal('105').optional(),
    'WS-SCHUM': z.string(),
    'WS-SHEM-MUTAV': z.string(),
    'WS-SHAA': z.string(),
    'WS-SIBA-MAHUT': z.literal('09').optional(),
    'WS-SNIF': z.string().regex(/^\d+$/),
  })
  .strict();

const dd1526DetailsSchema = z
  .object({
    'WS-ASMACHTA': z.string(),
    'WS-BANK': z.string().regex(/^\d+$/),
    'WS-HEARA': z.string(),
    'WS-MAVIR-SHEM': z.string(),
    'WS-MCH': z.string().regex(/^\d+$/),
    'WS-SCHUM': z.string(),
    'WS-SNIF': z.string().regex(/^\d+$/),
    'WS-SUG-TNUA': z.string(),
    'WS-TR-ERECH': z.string(),
    'WS-TR-RISHUM': z.string(),
  })
  .strict();

// SUGBAKA=211: credit card transaction breakdown
const ddCardDateSchema = z
  .object({
    'OUT-SHKL-TR-DD': z.string().regex(/^\d{2}$/),
    'OUT-SHKL-TR-MM': z.string().regex(/^\d{2}$/),
    'OUT-SHKL-TR-YYYY': z.string().regex(/^\d{4}$/),
  })
  .strict();

const ddCardDetailSchema = z
  .object({
    'OUT-SHKL-ARNAK-SUG': z.string(),
    'OUT-SHKL-ARNAK-TEUR': z.string(),
    'OUT-SHKL-ARNAK-TOKEN': z.string(),
    'OUT-SHKL-ESEK': z.string(),
    'OUT-SHKL-MISPAR-ANAF': z.string(),
    'OUT-SHKL-PIRUT': z.string(),
    'OUT-SHKL-PIRUT-EX': z.string(),
    'OUT-SHKL-PIRUT-NOSAF': z.string(),
    'OUT-SHKL-PIRUT-NOSAF-EX': z.string(),
    'OUT-SHKL-SCHUM-ANAF': z.string(),
    'OUT-SHKL-SCHUM-CHIYUV': z.string(),
    'OUT-SHKL-SCHUM-ISKA': z.string(),
    'OUT-SHKL-SHEM-ANAF': z.string(),
    'OUT-SHKL-TR': ddCardDateSchema,
  })
  .strict();

const ddCardKotSchema = z
  .object({
    'OUT-SHKL-COUNT-ANAF': z.string().regex(/^\d{3}$/),
    'OUT-SHKL-COUNT-PIRUT': z.string().regex(/^\d{3}$/),
    'OUT-SHKL-SACH-ISKA': z.string(),
    'OUT-SHKL-TR-CHIYUV': z.string(),
  })
  .strict();

const ddCardPartnerKotSchema = z
  .object({
    'OUT-SHKL-COUNT-SHTF-ANAF': z.string().regex(/^\d{3}$/),
    'OUT-SHKL-COUNT-SHTF-PIRUT': z.string().regex(/^\d{3}$/),
    'OUT-SHKL-SHTF-SACH': z.string(),
  })
  .strict();

const ddCardPartnerDetailSchema = z
  .object({
    'OUT-SHKL-SHTF-ARNAK-SUG': z.enum(['000', '003', '005', '999']),
    'OUT-SHKL-SHTF-ARNAK-TEUR': z.enum(['', 'UNKNOWN', 'טנרטניא', 'GOOGLE MC']),
    'OUT-SHKL-SHTF-ARNAK-TOKEN': z.string().regex(/^\d{20}$/),
    // 'OUT-SHKL-SHTF-MATBEA-CHIYUV': z.literal('דולר ארה"ב'),
    // 'OUT-SHKL-SHTF-MATBEA-MAKOR': z.enum(['דולר ארה"ב', 'אירו', 'UAH', 'ש"ח']),
    'OUT-SHKL-SHTF-MISPAR-ANAF': z.string().regex(/^\d{4}$/),
    'OUT-SHKL-SHTF-PIRUT': z.literal(''),
    'OUT-SHKL-SHTF-PIRUT-EX': z.literal(''),
    'OUT-SHKL-SHTF-PIRUT-NOSAF': z.string(),
    'OUT-SHKL-SHTF-PIRUT-NOSAF-EX': z.string(),
    'OUT-SHKL-SHTF-H-TR': z
      .object({
        'OUT-SHKL-SHTF-CHIYUV-DD': z.string().regex(/^\d{2}$/),
        'OUT-SHKL-SHTF-CHIYUV-MM': z.string().regex(/^\d{2}$/),
        'OUT-SHKL-SHTF-CHIYUV-YYYY': z.string().regex(/^\d{4}$/),
      })
      .strict(),
    'OUT-SHKL-SHTF-ISKA-TR': z
      .object({
        'OUT-SHKL-SHTF-ISKA-DD': z.string().regex(/^\d{2}$/),
        'OUT-SHKL-SHTF-ISKA-MM': z.string().regex(/^\d{2}$/),
        'OUT-SHKL-SHTF-ISKA-YYYY': z.string().regex(/^\d{4}$/),
      })
      .strict(),
    'OUT-SHTF-SCHUM-ANAF': decimalNumberSchema,
    'OUT-SHKL-SHTF-SCHUM-CHIYUV': decimalNumberSchema,
    'OUT-SHKL-SHTF-SCHUM-ISKA': decimalNumberSchema,
    'OUT-SHKL-SHTF-SHEM-ANAF': z.string(),
    'OUT-SHKL-SHTF-ESEK': z.string(),
  })
  .strict();

const ddCardFxKotSchema = z
  .object({
    'OUT-MTH-COUNT-PIRUT': z.string().regex(/^\d{3}$/),
    'OUT-MTH-SCHUM-D': z.string(),
    'OUT-MTH-SCHUM-E': z.string(),
    'OUT-MTH-SCHUM-S': z.string(),
    'OUT-MTH-TR-CHIYUV': z.string(),
    'OUT-MTH-VIZA-DINERS': z.literal('Y').optional(),
    'OUT-MTH-SCHUM-ED-D': z.string().optional(),
  })
  .strict();

const ddCardFxDetailsSchema = z
  .object({
    'OUT-MTH-ARNAK-SUG': z.enum(['000', '003', '999']),
    'OUT-MTH-ARNAK-TEUR': z.enum(['', 'UNKNOWN', 'טנרטניא']),
    'OUT-MTH-ARNAK-TOKEN': z.string().regex(/^\d{20}$/),
    'OUT-MTH-MATBEA-CHIYUV': z.literal('דולר ארה"ב'),
    'OUT-MTH-MATBEA-MAKOR': z.enum(['דולר ארה"ב', 'אירו', 'UAH', 'ש"ח']),
    'OUT-MTH-PIRUT': z.enum(['', 'דבלב העידיל']),
    'OUT-MTH-PIRUT-EX': z.enum(['', 'לידיעה בלבד']),
    'OUT-MTH-PIRUT-NOSAF': z.string(),
    'OUT-MTH-PIRUT-NOSAF-EX': z.string(),
    'OUT-MTH-TR': z
      .object({
        'OUT-MTH-TR-DD': z.string().regex(/^\d{2}$/),
        'OUT-MTH-TR-MM': z.string().regex(/^\d{2}$/),
        'OUT-MTH-TR-YYYY': z.string().regex(/^\d{4}$/),
      })
      .strict(),
    'OUT-MTH-SCHUM-CHIYUV': decimalNumberSchema,
    'OUT-MTH-SCHUM-ISKA': decimalNumberSchema,
    'OUT-MTH-SHEM-ESEK': z.string(),
  })
  .strict();

const ddCardFxPartnerKotSchema = z
  .object({
    'OUT-MTH-COUNT-SHTF-PIRUT': z.string().regex(/^\d{3}$/),
    'OUT-MTH-SHTF-SCHUM-D': decimalNumberSchema,
    'OUT-MTH-SHTF-SCHUM-E': decimalNumberSchema,
    'OUT-MTH-SHTF-SCHUM-ED-D': decimalNumberSchema.optional(),
    'OUT-MTH-SHTF-SCHUM-S': decimalNumberSchema,
    'OUT-MTH-SHTF-TR-CHIYUV': z.string(),
    'OUT-MTH-SHFT-VIZA-DINERS': z.literal('Y').optional(),
  })
  .strict();

const ddCardFxPartnerDetailSchema = z
  .object({
    'OUT-MTH-SHTF-ARNAK-SUG': z.enum(['000', '003', '999']),
    'OUT-MTH-SHTF-ARNAK-TEUR': z.enum(['', 'UNKNOWN', 'טנרטניא']),
    'OUT-MTH-SHTF-ARNAK-TOKEN': z.string().regex(/^\d{20}$/),
    'OUT-MTH-SHTF-MATBEA-CHIYUV': z.literal('דולר ארה"ב'),
    'OUT-MTH-SHTF-MATBEA-MAKOR': z.enum(['דולר ארה"ב', 'אירו', 'UAH', 'ש"ח']),
    'OUT-MTH-SHTF-PIRUT': z.union([z.literal(''), z.literal('דבלב העידיל')]),
    'OUT-MTH-SHTF-PIRUT-EX': z.union([z.literal(''), z.literal('לידיעה בלבד')]),
    'OUT-MTH-SHTF-PIRUT-NOSAF': z.string(),
    'OUT-MTH-SHTF-PIRUT-NOSAF-EX': z.string(),
    'OUT-MTH-SHTF-H-TR': z
      .object({
        'OUT-MTH-SHTF-CHIYUV-DD': z.string().regex(/^\d{2}$/),
        'OUT-MTH-SHTF-CHIYUV-MM': z.string().regex(/^\d{2}$/),
        'OUT-MTH-SHTF-CHIYUV-YYYY': z.string().regex(/^\d{4}$/),
      })
      .strict(),
    'OUT-MTH-SHTF-TR': z
      .object({
        'OUT-MTH-SHTF-TR-DD': z.string().regex(/^\d{2}$/),
        'OUT-MTH-SHTF-TR-MM': z.string().regex(/^\d{2}$/),
        'OUT-MTH-SHTF-TR-YYYY': z.string().regex(/^\d{4}$/),
      })
      .strict(),
    'OUT-MTH-SHTF-SCHUM-CHIYUV': decimalNumberSchema,
    'OUT-MTH-SHTF-SCHUM-ISKA': decimalNumberSchema,
    'OUT-MTH-SHTF-ESEK': z.string(),
  })
  .strict();

const ddCardDetailsSchema = z
  .object({
    'KARTIS-DETAILS': z
      .object({
        'OUT-ISHUV': z.string(),
        'OUT-KARTIS-TOKEF': z.string().regex(/^\d{2}\/\d{4}$/),
        'OUT-KNISA': z.string(),
        'OUT-KOD-CHEVRA': z.string().regex(/^\d{3}$/),
        'OUT-MIS-BAIT': z.string(),
        'OUT-MISGERET-ASHRAY-CAL': z.string().optional(),
        'OUT-MISGERET-KREDIT-ISR': z.string().optional(),
        'OUT-MIKUD1': z.string(),
        'OUT-MOED-CHIYUV': z.string(),
        'OUT-MSKART': z.string().regex(/^\d{4}$/),
        'OUT-RECHOV': z.string(),
        'OUT-SHEM-MANPIK': z.string(),
        'OUT-SHEM-MISHP': z.string(),
        'OUT-SHEM-MOADON1': z.string(),
        'OUT-SHEM-MOADON2': z.string().optional(),
        'OUT-SHEM-MOADON3': z.string().optional(),
        'OUT-SHEM-MOADON4': z.string().optional(),
        'OUT-SHEM-PRATI': z.string(),
        'OUT-SNIF-DOAR': z.string(),
        'OUT-SUG-KARTIS': z.string(),
        'OUT-TA-DOAR': z.string(),
        'OUT-TA-SNIF': z.string(),
      })
      .strict(),
    'OUT-HAZAGA-GRAF': z.object({ 'OUT-SW-HAZAGA-GRAF': z.string() }).strict(),
    'OUT-MTH-SHTF-TAB': z
      .object({
        'OUT-MTH-SHTF-KOT': ddCardFxPartnerKotSchema,
        'OUT-MTH-SHTF-DTLS': z.array(ddCardFxPartnerDetailSchema).optional(),
      })
      .strict(),
    'OUT-MTH-TAB': z
      .object({
        'OUT-MTH-KOT': ddCardFxKotSchema,
        'OUT-MTH-DTLS': z.array(ddCardFxDetailsSchema).optional(),
      })
      .strict(),
    'OUT-SHKL-SHTF-TAB': z
      .object({
        'OUT-SHKL-SHTF-KOT': ddCardPartnerKotSchema,
        'OUT-SHKL-SHTF-DTLS': z
          .union([z.array(ddCardPartnerDetailSchema), ddCardPartnerDetailSchema])
          .optional(),
      })
      .strict(),
    'OUT-SHKL-TAB': z
      .object({
        'OUT-SHKL-DTLS': z.array(ddCardDetailSchema).optional(),
        'OUT-SHKL-KOT': ddCardKotSchema,
      })
      .strict(),
  })
  .strict();

const drillDownData211Schema = z
  .object({
    T20C2211: z
      .object({
        'OUT-CNP': z.string().optional(),
        'OUT-DATA': z
          .object({
            'ALL-CARDS': ddCardDetailsSchema,
            'OUT-CNP': z.string(),
            'OUT-HD': z.object({ 'OUT-HD-VAL-HODESH': z.string() }).strict(),
            'OUT-HEARA-MTH-1': z.string(),
            'OUT-HEARA-MTH-2': z.string(),
            'OUT-HEARA-SHKL-1': z.string(),
            'OUT-HEARA-SHKL-2': z.string(),
            'OUT-HEARA-SHKL-3': z.string(),
            'OUT-HEARA-SHKL-4': z.string(),
            'OUT-HESDER-ASHRAI-SHKL-1': z.string(),
            'OUT-HESDER-ASHRAI-SHKL-2': z.string(),
            'OUT-KAMUT-KARTISIM2': z.string(),
            'OUT-KT-HEARA-1-SHKL': z.string(),
            'OUT-KT-HEARA-2-SHKL': z.string(),
            'OUT-KT-HEARA-3-SHKL': z.string(),
            'OUT-KT-HEARA-SHKL': z.string(),
            'OUT-KT-HEARA-SHKL-1': z.string(),
            'OUT-KT-SUBT2': z.string(),
            'OUT-RESPONSIB': z.string(),
            'OUT-RESPONSIB-1': z.string(),
            'OUT-RESPONSIB-2': z.string(),
            'OUT-RESPONSIB-3': z.string(),
            'OUT-SHUTAF-1': z.string(),
            'OUT-SHUTAF-2': z.string(),
            'OUT-SHUTAF-3': z.string(),
            'OUT-SHUTAF-4': z.string(),
            'OUT-SHUTAF-5': z.string(),
            'OUT-SHUTAF-6': z.string(),
            'OUT-TR-NECHONUT2': z.string(),
          })
          .strict(),
        'OUT-LIABILITIES': z
          .object({
            'DAF-NEHITA': z.object({ 'OUT-MISGERET-TOTAL': z.string() }).strict(),
          })
          .strict()
          .optional(),
        T05CHEAD: ddHeadSchema,
        T05CTLCH: ddFooterSchema,
      })
      .strict(),
  })
  .strict();

// SUGBAKA=221: direct debit authorization detail
const drillDownData221Schema = z
  .object({
    T10C1221: z
      .object({
        'OUT-HIDDEN-PARAMS': z.object({ 'OUT-SHLVIBUD': z.string() }).strict(),
        'OUT-PIRUT-CHIUVIM': z
          .object({
            'OUT-CHIUV-CLALI': z
              .object({
                'OUT-CHIUV-FROM-DATE': z.string().regex(/^\d{8}$/),
                'OUT-CHIUV-KOD-MOSAD': z.string().regex(/^\d{5}$/),
                'OUT-CHIUV-SHEM-MOSAD': z.string(),
              })
              .strict(),
            'OUT-CHIYUV': z.array(
              z
                .object({
                  'OUT-CHIUV-HARSHAA': z.string(),
                  'OUT-CHIYUV-DATE': z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
                  'OUT-CHIYUV-SCHUM': z.string(),
                })
                .strict(),
            ),
          })
          .strict(),
        T05CHEAD: ddHeadSchema,
      })
      .strict(),
  })
  .strict();

// SUGBAKA=523: outgoing transfer detail
const drillDownData523Schema = z
  .object({
    T10C1523: z
      .object({
        'OUT-DATA': z
          .object({
            'H-FIELDS': z
              .object({
                'H-SCHUM-FROM': z.string(),
                'H-SCHUM-TILL': z.string(),
                'H-SHLVIBUD': z.string(),
                'H-SRIKA-MONE-MEZUKE': z.string(),
                'H-SRIKA-TIMESTAMP': z.string(),
                'H-TR-FROM': z.string(),
                'H-TR-TILL': z.string(),
              })
              .strict(),
            'OUT-DETAILS': z.union([dd1523DetailsSchema, z.array(dd1523DetailsSchema)]),
            'OUT-SCHUM-FROM': z.string(),
            'OUT-SCHUM-TILL': z.string(),
            'OUT-TR-FROM': z.string(),
            'OUT-TR-TILL': z.string(),
          })
          .strict(),
        T05CHEAD: ddHeadSchema,
        T05CTLCH: ddFooterSchema,
      })
      .strict(),
  })
  .strict();

// SUGBAKA=526: incoming transfer detail
const drillDownData526Schema = z
  .object({
    T10C1526: z
      .object({
        'OUT-DATA': z
          .object({
            HATACH: z
              .object({
                'OUT-SCHUM-FROM': z.string(),
                'OUT-SCHUM-TILL': z.string(),
                'OUT-TR-FROM': z.string(),
                'OUT-TR-TILL': z.string(),
              })
              .strict(),
            'OUT-DETAILS': z.union([z.array(dd1526DetailsSchema), dd1526DetailsSchema]).optional(),
          })
          .strict(),
        T05CHEAD: ddHeadSchema,
        T05CTLCH: ddFooterSchema,
      })
      .strict(),
  })
  .strict();

export const drillDownDataSchema = z
  .union([
    // z.null(), // no drillDownUrl
    z.string(), // PaperNameServiceServlet — returns fund/stock name
    drillDownData211Schema, // credit card breakdown
    drillDownData221Schema, // direct debit authorization
    drillDownData523Schema, // outgoing transfer
    drillDownData526Schema, // incoming transfer
  ])
  .optional();

export const ilsTransactionSchema = z
  .object({
    ActionCode: z.literal(0),
    bfbSource: z.literal('77'),
    closingBalance: z.number(),
    comments: z.null(),
    CorrespondentAccount: z.number().int().nonnegative(),
    CorrespondentAccountType: z.union([
      z.literal(0), //
      z.literal(5), //
      z.literal(16), //
      z.literal(64), //
      z.literal(105), //
      z.literal(106), //
      z.literal(330), //
      z.literal(409), // חח"ד עיסקי
      z.literal(960), //
    ]),
    CorrespondentBank: z.number().int().min(0).max(99),
    CorrespondentBranch: z.number().int().min(0).max(999),
    creditAmount: z.number().nonnegative(),
    CustomerName: whitespaceStringSchema,
    dateOfBusinessDay: isoDateTimeSchema,
    dateOfRegistration: isoDateTimeSchema,
    debitAmount: z.number().nonnegative(),
    DepositorId: z.literal(0),
    description: z.string().min(1),
    drillDownUrl: z.string(),
    drillDownData: drillDownDataSchema.optional(),
    firstTransactionOfDay: z.boolean(),
    lastTransactionOfDay: z.boolean(),
    Name: whitespaceStringSchema,
    openingBalance: z.number(),
    OprationSource: whitespaceStringSchema,
    reference: z.number().int().nonnegative(),
    SalaryInd: z.literal(0),
    transactionSource: whitespaceStringSchema,
    TransactionReason: whitespaceStringSchema,
  })
  .strict();

export const ilsTransactionsResponseSchema = z
  .object({
    // accountNumber: z.null(),
    accountType: z.literal(409),
    // bank: z.null(),
    // branch: z.null(),
    // currentDate: z.null(),
    errorMessage: z.null(),
    // messages: z.null(),
    // pagingContext: z.string(),
    returncode: z.null(),
    // subtitle: z.null(),
    // title: z.null(),
    transactions: z.array(ilsTransactionSchema),
  })
  .strict();

export type IlsTransaction = z.infer<typeof ilsTransactionSchema>;
export type IlsTransactionsResponse = z.infer<typeof ilsTransactionsResponseSchema>;

const accountSchema = z
  .object({
    account: z.string().regex(/^\d{6}$/, 'Expected 6-digit account number'),
    bank: z.string().regex(/^\d{3}$/, 'Expected 3-digit bank code'),
    branch: z.string().regex(/^\d{3}$/, 'Expected 3-digit branch code'),
    kinuy: z.string(),
    name: z.string(),
    selected: z.boolean(),
  })
  .strict();

export const userDataSchema = z
  .object({
    accounts: z.array(accountSchema).min(1),
    applicationID: z.literal('OTSARPRTAL'),
    bankMesharet: z.literal('014'),
    currentBankId: z.literal('OTSARPRTAL'),
    device: z.literal('IEX'),
    ip: z.string().regex(/^(\d{1,3}\.){3}\d{1,3}$/, 'Expected IPv4 address'),
    kodAtar: z.literal(''),
    kodMishtamesh: z.literal('INT'),
    lastLogonDate: z.string().regex(/^\d{2}\/\d{2}\/\d{2}$/, 'Expected DD/MM/YY date format'),
    lastLogonHour: z.string().regex(/^\d{2}:\d{2}$/, 'Expected HH:MM time format'),
    maxInactiveTime: z.string().regex(/^\d+$/, 'Expected numeric milliseconds string'),
    sessionToken: z.string().min(1),
    sugMishtamesh: z.literal(''),
    sugTafrit: z.string().regex(/^\d+$/, 'Expected numeric plan code'),
    teudatZehut: z.string().regex(/^\d{9}$/, 'Expected 9-digit Israeli ID number'),
    userAgent: z.string().min(1),
    zihuyKontzern: z.literal(''),
    zihuyMishtamesh: z.string().regex(/^[A-Z0-9]+$/, 'Expected alphanumeric user ID'),
  })
  .strict();

export type UserData = z.infer<typeof userDataSchema>;
export type Account = z.infer<typeof accountSchema>;
