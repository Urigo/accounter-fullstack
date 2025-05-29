'use client';

import { Fragment } from 'react/jsx-runtime';
import { Shaam6111DataContentTaxAdjustmentFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { TabsContent } from '../../../ui/tabs.js';
import { CodeField } from './code-field.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment Shaam6111DataContentTaxAdjustment on Shaam6111Data {
    id
    taxAdjustment {
      code
      amount
      label
    }
  }
`;

const codeOrder: Array<{ title: string; color: string; codes: number[]; sumCode?: number }> = [
  {
    title: 'התאמות חשבונאיות למי שיישם את חלופה 2 בהוראת ביצוע 7/2010 בנושא IFRS',
    color: 'red',
    codes: [103, 104],
  },
  {
    title: 'התאמות נדרשות לצרכי מס (הוסף/הפחת)',
    color: 'yellow',
    codes: [
      110, 120, 130, 135, 140, 150, 160, 170, 180, 181, 182, 183, 184, 190, 200, 300, 310, 320, 330,
      350, 360,
    ],
    sumCode: 370,
  },
  {
    title:
      'התאמות חשבונאיות למי שיישם את חלופה 3 בהוראת ביצוע 7/2010 בנושא IFRS שלא מצאו את ביטויין בהתאמות הנדרשות לצרכי מס',
    color: 'emerald',
    codes: [383],
    sumCode: 400,
  },
  {
    title: 'יישום הוראות חוקי מס נוספים',
    color: 'sky',
    codes: [430, 480, 490],
    sumCode: 500,
  },
  {
    title: 'נתונים נוספים',
    color: 'violet',
    codes: [510, 520, 530, 540, 550, 570, 575, 580, 585, 590],
  },
  {
    title: 'בשותפות',
    color: 'pink',
    codes: [600],
  },
];

type TaxAdjustmentTab = {
  data: FragmentType<typeof Shaam6111DataContentTaxAdjustmentFragmentDoc>;
  referenceData?: FragmentType<typeof Shaam6111DataContentTaxAdjustmentFragmentDoc>;
  showEmptyFields?: boolean;
};

export function TaxAdjustmentTab({
  data,
  referenceData,
  showEmptyFields = false,
}: TaxAdjustmentTab) {
  const { taxAdjustment } = getFragmentData(Shaam6111DataContentTaxAdjustmentFragmentDoc, data);
  const referenceReport = getFragmentData(
    Shaam6111DataContentTaxAdjustmentFragmentDoc,
    referenceData,
  );
  const referenceTaxAdjustment = referenceReport?.taxAdjustment || [];

  return (
    <TabsContent value="taxAdjustment" className="border rounded-md p-4">
      <div className="space-y-6" dir="rtl">
        <h3 className="text-lg font-bold border-b pb-2">נתוני דו"ח התאמה למס</h3>

        <div className="bg-emerald-50 p-4 rounded-md border-2 border-emerald-200">
          <CodeField
            codes={taxAdjustment}
            referenceCodes={referenceTaxAdjustment}
            code={100}
            showEmptyFields={showEmptyFields}
          />
        </div>

        {codeOrder.map(section => {
          const headerClasses = `text-${section.color}-700`;
          const sumClasses = `bg-${section.color}-50 border-${section.color}-200`;
          return (
            <Fragment key={section.title}>
              <div className="bg-gray-50 p-4 rounded-md">
                <h4 className={'font-bold mb-4 ' + headerClasses}>{section.title}</h4>
                <div className="space-y-2">
                  {section.codes.map(code => (
                    <CodeField
                      key={code}
                      codes={taxAdjustment}
                      referenceCodes={referenceTaxAdjustment}
                      code={code}
                      showEmptyFields={showEmptyFields}
                    />
                  ))}
                </div>
              </div>
              {section.sumCode && (
                <div className={'p-4 rounded-md border-2 ' + sumClasses}>
                  <CodeField
                    codes={taxAdjustment}
                    referenceCodes={referenceTaxAdjustment}
                    code={section.sumCode}
                    showEmptyFields={showEmptyFields}
                  />
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    </TabsContent>
  );
}
