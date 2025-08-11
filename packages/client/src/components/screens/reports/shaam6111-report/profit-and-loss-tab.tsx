'use client';

import { Shaam6111DataContentProfitLossFragmentDoc } from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { TabsContent } from '../../../ui/tabs.js';
import { CodeField } from './code-field.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment Shaam6111DataContentProfitLoss on Shaam6111Data {
    id
    profitAndLoss {
      code
      amount
      label
    }
  }
`;

const codeOrderPar1: Array<{ title: string; color: string; codes: number[]; sumCode: number }> = [
  {
    title: 'הכנסות ממכירות ומתן שירותים',
    color: 'text-blue-700',
    codes: [1010, 1015, 1020, 1025, 1030, 1040, 1051, 1052, 1090],
    sumCode: 1000,
  },
  {
    title: 'עלות המכירות ומתן השירותים וביצוע עבודות',
    color: 'text-purple-700',
    codes: [1306, 1308, 1307, 1310, 1320, 1330, 1340, 1350, 1360, 1371, 1372, 1390, 1400, 1450],
    sumCode: 1300,
  },
  {
    title: 'עלויות ייצור ועלויות אצל קבלן בונה',
    color: 'text-rose-700',
    codes: [
      2005, 2006, 2011, 2012, 2015, 2020, 2025, 2030, 2035, 2040, 2045, 2050, 2060, 2066, 2067,
      2068, 2070, 2075, 2080, 2085, 2090, 2095,
    ],
    sumCode: 2000,
  },
  {
    title: 'הוצאות מחקר ופיתוח',
    color: 'text-amber-700',
    codes: [2510, 2520, 2530, 2540, 2550, 2560, 2570, 2590],
    sumCode: 2500,
  },
  {
    title: 'הוצאות מכירה',
    color: 'text-green-700',
    codes: [
      3011, 3013, 3012, 3015, 3020, 3025, 3030, 3040, 3045, 3050, 3060, 3066, 3067, 3068, 3070,
      3075, 3080, 3085, 3090, 3100, 3120, 3190,
    ],
    sumCode: 3000,
  },
  {
    title: 'הוצאות הנהלה וכלליות',
    color: 'text-cyan-700',
    codes: [
      3511, 3513, 3512, 3515, 3520, 3530, 3535, 3540, 3545, 3550, 3560, 3566, 3567, 3568, 3570,
      3575, 3580, 3590, 3595, 3600, 3610, 3620, 3625, 3631, 3632, 3640, 3650, 3660, 3665, 3680,
      3685, 3690,
    ],
    sumCode: 3500,
  },
  {
    title: 'הוצאות מימון',
    color: 'text-indigo-700',
    codes: [5010, 5020, 5025, 5030, 5040, 5050, 5051, 5090],
    sumCode: 5000,
  },
  {
    title: 'הכנסות מימון',
    color: 'text-fuchsia-700',
    codes: [5110, 5121, 5122, 5130, 5150, 5160, 5190],
    sumCode: 5100,
  },
  {
    title: 'הכנסות אחרות',
    color: 'text-red-700',
    codes: [5210, 5220, 5230, 5236, 5237, 5240, 5250, 5260, 5270, 5290],
    sumCode: 5200,
  },
  {
    title: 'הוצאות אחרות',
    color: 'text-yellow-700',
    codes: [5310, 5320, 5330, 5390],
    sumCode: 5300,
  },
];

const codeOrderPar2: Array<{ title: string; color: string; codes: number[]; sumCode: number }> = [
  { title: 'מסים על הכנסה', color: 'text-sky-700', codes: [5610, 5620, 5630], sumCode: 5600 },
  { title: 'ייעוד הרווחים', color: 'text-violet-700', codes: [5710], sumCode: 5700 },
  { title: 'רווח/הפסד אקויטי', color: 'text-pink-700', codes: [5810], sumCode: 5800 },
];

type ProfitAndLossTab = {
  data: FragmentType<typeof Shaam6111DataContentProfitLossFragmentDoc>;
  referenceData?: FragmentType<typeof Shaam6111DataContentProfitLossFragmentDoc>;
  selectedYear: string;
  referenceYear?: string;
  showEmptyFields?: boolean;
};

export function ProfitAndLossTab({
  selectedYear,
  referenceYear,
  data,
  referenceData,
  showEmptyFields = false,
}: ProfitAndLossTab) {
  const { profitAndLoss } = getFragmentData(Shaam6111DataContentProfitLossFragmentDoc, data);
  const referenceReport = getFragmentData(Shaam6111DataContentProfitLossFragmentDoc, referenceData);
  const referenceProfitAndLoss = referenceReport?.profitAndLoss || [];
  return (
    <TabsContent value="profitLoss" className="border rounded-md p-4">
      <div className="space-y-6" dir="rtl">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold border-b pb-2">נתוני רווח והפסד</h3>
          {referenceYear && selectedYear !== referenceYear && (
            <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
              מציג שינויים לעומת {referenceYear}
            </span>
          )}
        </div>

        {codeOrderPar1.map(section => {
          return (
            <div className="bg-gray-50 p-4 rounded-md" key={section.title}>
              <h4 className={`font-bold mb-4 ${section.color}`}>{section.title}</h4>
              <div className="space-y-2">
                {section.codes.map(code => (
                  <CodeField
                    key={code}
                    codes={profitAndLoss}
                    referenceCodes={referenceProfitAndLoss}
                    code={code}
                    showEmptyFields={showEmptyFields}
                  />
                ))}
                <div className="border-2  rounded-md border-gray-300">
                  <CodeField
                    codes={profitAndLoss}
                    referenceCodes={referenceProfitAndLoss}
                    code={section.sumCode}
                    showEmptyFields={showEmptyFields}
                  />
                </div>
              </div>
            </div>
          );
        })}

        <div className="bg-emerald-50 p-4 rounded-md border-2 border-emerald-200">
          <CodeField
            codes={profitAndLoss}
            referenceCodes={referenceProfitAndLoss}
            code={6666}
            showEmptyFields={showEmptyFields}
          />
        </div>

        {codeOrderPar2.map(section => (
          <div className="bg-gray-50 p-4 rounded-md" key={section.title}>
            <h4 className={`font-bold mb-4 ${section.color}`}>{section.title}</h4>
            <div className="space-y-2">
              {section.codes.map(code => (
                <CodeField
                  key={code}
                  codes={profitAndLoss}
                  referenceCodes={referenceProfitAndLoss}
                  code={code}
                  showEmptyFields={showEmptyFields}
                />
              ))}
              <div className="border-2  rounded-md border-gray-300">
                <CodeField
                  codes={profitAndLoss}
                  referenceCodes={referenceProfitAndLoss}
                  code={section.sumCode}
                  showEmptyFields={showEmptyFields}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </TabsContent>
  );
}
