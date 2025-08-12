'use client';

import { Shaam6111DataContentBalanceSheetFragmentDoc } from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { TabsContent } from '../../../ui/tabs.js';
import { CodeField } from './code-field.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment Shaam6111DataContentBalanceSheet on Shaam6111Data {
    id
    balanceSheet {
      code
      amount
      label
    }
  }
`;

type BalanceSheetTab = {
  data: FragmentType<typeof Shaam6111DataContentBalanceSheetFragmentDoc>;
  referenceData?: FragmentType<typeof Shaam6111DataContentBalanceSheetFragmentDoc>;
  showEmptyFields?: boolean;
};

const assets: Array<{ title: string; codes: number[]; sumCode: number }> = [
  {
    title: 'מזומנים ושווי מזומנים',
    codes: [7110, 7120, 7150],
    sumCode: 7100,
  },
  {
    title: 'ניירות ערך',
    codes: [7215, 7225, 7230, 7290, 7295],
    sumCode: 7200,
  },
  {
    title: 'לקוחות',
    codes: [7310, 7320, 7330, 7350, 7360, 7380, 7390],
    sumCode: 7300,
  },
  {
    title: 'חייבים ויתרות חובה',
    codes: [7410, 7420, 7430, 7440, 7450, 7461, 7462, 7470, 7490],
    sumCode: 7400,
  },
  {
    title: 'מסים נדחים לזמן קצר',
    codes: [7610, 7620, 7690],
    sumCode: 7600,
  },
  {
    title: 'הלוואות לזמן קצר',
    codes: [7711, 7712, 7720],
    sumCode: 7700,
  },
  {
    title: 'מלאי',
    codes: [7805, 7810, 7815, 7820, 7825, 7830, 7840, 7850, 7860, 7870, 7890],
    sumCode: 7800,
  },
];
const assets2: Array<{ title: string; codes: number[]; sumCode: number }> = [
  {
    title: 'רכוש קבוע',
    codes: [
      8010, 8020, 8025, 8030, 8040, 8050, 8060, 8080, 8090, 8095, 8100, 8105, 8110, 8120, 8130,
      8140, 8150, 8160, 8170, 8180, 8190,
    ],
    sumCode: 8000,
  },
  {
    title: 'נכסים לא שוטפים מוחזקים למכירה',
    codes: [8710],
    sumCode: 8700,
  },
  {
    title: 'הוצאות מראש לזמן ארוך',
    codes: [8210, 8220, 8290],
    sumCode: 8200,
  },
  {
    title: 'השקעות בחברות מוחזקות כלולות ומאוחדות',
    codes: [8315, 8325, 8335, 8340, 8350],
    sumCode: 8300,
  },
  {
    title: 'השקעות בחברות אחרות כולל ני"ע סחירים מוחזקים לזמן ארוך',
    codes: [8410, 8420, 8440, 8450, 8460, 8490],
    sumCode: 8400,
  },
  {
    title: 'מסים נדחים לזמן ארוך',
    codes: [8510, 8520, 8590],
    sumCode: 8500,
  },
  {
    title: 'הוצאות נדחות ורכוש אחר',
    codes: [8610, 8620, 8630, 8640, 8690],
    sumCode: 8600,
  },
];

const liabilities: Array<{ title: string; codes: number[]; sumCode: number }> = [
  {
    title: 'בנקים והלואות לזמן קצר',
    codes: [9110, 9120, 9130, 9140, 9151, 9152, 9190],
    sumCode: 9100,
  },
  {
    title: 'ספקים ונותני שירותים',
    codes: [9210, 9220, 9230, 9290],
    sumCode: 9200,
  },
  {
    title: 'זכאים ויתרות זכות',
    codes: [
      9310, 9320, 9330, 9340, 9350, 9360, 9370, 9410, 9420, 9431, 9432, 9435, 9440, 9450, 9460,
      9470, 9480, 9490,
    ],
    sumCode: 9400,
  },
  {
    title: 'עתודה למסים נדחים לזמן קצר',
    codes: [9510, 9520, 9530],
    sumCode: 9500,
  },
];

const liabilities2: Array<{ title: string; codes: number[]; sumCode: number }> = [
  {
    title: 'התחייבויות לזמן ארוך',
    codes: [9605, 9610, 9620, 9631, 9632, 9640, 9650, 9660, 9670, 9690],
    sumCode: 9600,
  },
  {
    title: 'התחייבויות בשל סיום יחסי עובד-מעביד',
    codes: [9710, 9720, 9790],
    sumCode: 9700,
  },
  {
    title: 'עתודה למסים נדחים לזמן ארוך',
    codes: [9810, 9820, 9890],
    sumCode: 9800,
  },
];

const currentYearProfitLoss: Array<{ title: string; codes: number[]; sumCode: number }> = [
  {
    title: 'הון עצמי',
    codes: [9910, 9920, 9930, 9940, 9950, 9960, 9980],
    sumCode: 9900,
  },
];

export function BalanceSheetTab({ data, referenceData, showEmptyFields = false }: BalanceSheetTab) {
  const report = getFragmentData(Shaam6111DataContentBalanceSheetFragmentDoc, data);
  const balanceSheet = report.balanceSheet || [];

  const referenceReport = getFragmentData(
    Shaam6111DataContentBalanceSheetFragmentDoc,
    referenceData,
  );
  const referenceBalanceSheet = referenceReport?.balanceSheet || [];

  return (
    <TabsContent value="balanceSheet" className="border rounded-md p-4">
      <div className="space-y-6" dir="rtl">
        <h3 className="text-lg font-bold border-b pb-2">נתוני המאזן</h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assets */}
          <div className="space-y-4">
            <h4 className="text-lg font-bold text-blue-800 border-b pb-2">נכסים</h4>

            <div className="bg-blue-100 p-4 rounded-md border-2 border-blue-300">
              <h5 className="font-bold">רכוש שוטף</h5>
            </div>

            {assets.map(section => (
              <div className="bg-blue-50 p-4 rounded-md" key={section.title}>
                <h6 className="font-bold mb-3">{section.title}</h6>
                <div className="space-y-2">
                  {section.codes.map(code => (
                    <CodeField
                      key={code}
                      codes={balanceSheet}
                      referenceCodes={referenceBalanceSheet}
                      code={code}
                      showEmptyFields={showEmptyFields}
                    />
                  ))}
                  <div className="border-2  rounded-md border-gray-300">
                    <CodeField
                      codes={balanceSheet}
                      referenceCodes={referenceBalanceSheet}
                      code={section.sumCode}
                      showEmptyFields={showEmptyFields}
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-blue-100 p-4 rounded-md border-2 border-blue-300">
              <CodeField codes={balanceSheet} code={7000} showEmptyFields={showEmptyFields} />
            </div>

            {assets2.map(section => (
              <div className="bg-blue-50 p-4 rounded-md" key={section.title}>
                <h6 className="font-bold mb-3">{section.title}</h6>
                <div className="space-y-2">
                  {section.codes.map(code => (
                    <CodeField
                      key={code}
                      codes={balanceSheet}
                      referenceCodes={referenceBalanceSheet}
                      code={code}
                      showEmptyFields={showEmptyFields}
                    />
                  ))}
                  <div className="border-2  rounded-md border-gray-300">
                    <CodeField
                      codes={balanceSheet}
                      referenceCodes={referenceBalanceSheet}
                      code={section.sumCode}
                      showEmptyFields={showEmptyFields}
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-blue-100 p-4 rounded-md border-2 border-blue-300">
              <CodeField codes={balanceSheet} code={8888} showEmptyFields={showEmptyFields} />
            </div>
          </div>

          {/* Liabilities and Equity */}
          <div className="space-y-4">
            <h4 className="text-lg font-bold text-red-800 border-b pb-2">התחייבויות והון</h4>

            <div className="bg-red-100 p-4 rounded-md border-2 border-red-300">
              <h5 className="font-bold">התחייבויות שוטפות</h5>
            </div>

            {liabilities.map(section => (
              <div className="bg-red-50 p-4 rounded-md" key={section.title}>
                <h6 className="font-bold mb-3">{section.title}</h6>
                <div className="space-y-2">
                  {section.codes.map(code => (
                    <CodeField
                      key={code}
                      codes={balanceSheet}
                      referenceCodes={referenceBalanceSheet}
                      code={code}
                      showEmptyFields={showEmptyFields}
                    />
                  ))}
                  <div className="border-2  rounded-md border-gray-300">
                    <CodeField
                      codes={balanceSheet}
                      referenceCodes={referenceBalanceSheet}
                      code={section.sumCode}
                      showEmptyFields={showEmptyFields}
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-red-100 p-4 rounded-md border-2 border-red-300">
              <CodeField codes={balanceSheet} code={9000} showEmptyFields={showEmptyFields} />
            </div>

            {liabilities2.map(section => (
              <div className="bg-red-50 p-4 rounded-md" key={section.title}>
                <h6 className="font-bold mb-3">{section.title}</h6>
                <div className="space-y-2">
                  {section.codes.map(code => (
                    <CodeField
                      key={code}
                      codes={balanceSheet}
                      referenceCodes={referenceBalanceSheet}
                      code={code}
                      showEmptyFields={showEmptyFields}
                    />
                  ))}
                  <div className="border-2  rounded-md border-gray-300">
                    <CodeField
                      codes={balanceSheet}
                      referenceCodes={referenceBalanceSheet}
                      code={section.sumCode}
                      showEmptyFields={showEmptyFields}
                    />
                  </div>
                </div>
              </div>
            ))}

            {currentYearProfitLoss.map(section => (
              <div className="bg-green-50 p-4 rounded-md" key={section.title}>
                <h5 className="font-bold mb-3">{section.title}</h5>
                <div className="space-y-2">
                  {section.codes.map(code => (
                    <CodeField
                      key={code}
                      codes={balanceSheet}
                      referenceCodes={referenceBalanceSheet}
                      code={code}
                      showEmptyFields={showEmptyFields}
                    />
                  ))}
                </div>
              </div>
            ))}

            <div className="bg-red-100 p-4 rounded-md border-2 border-red-300">
              <CodeField codes={balanceSheet} code={9999} showEmptyFields={showEmptyFields} />
            </div>
          </div>
        </div>
      </div>
    </TabsContent>
  );
}
