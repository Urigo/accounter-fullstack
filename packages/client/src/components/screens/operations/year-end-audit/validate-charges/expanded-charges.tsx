import { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { Badge } from '../../../../ui/badge.jsx';
import { Button } from '../../../../ui/button.jsx';
import { CardContent } from '../../../../ui/card.jsx';
import { Collapsible, CollapsibleContent } from '../../../../ui/collapsible.js';
import { ChargeValidationData } from './validate-charges.js';

export function ExpandedCharges({ chargeData }: { chargeData: ChargeValidationData }) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  return (
    <Collapsible open={isExpanded}>
      <CardContent className="pt-0 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(i => !i)}
          className="w-full justify-between p-2 h-auto"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Charge Validation Details</span>
            <Badge variant="outline" className="text-xs">
              {chargeData.pendingCount + chargeData.unapprovedCount} need attention
            </Badge>
          </div>
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </CardContent>
      <CollapsibleContent>
        <CardContent className="pt-0">
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium">Charge Review Progress</span>
                <span className="text-muted-foreground">
                  {chargeData.totalCharges.toLocaleString()} total charges
                </span>
              </div>

              {/* Combined Progress Bar */}
              <div className="relative h-6 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${chargeData.approvedPercentage}%` }}
                />
                <div
                  className="absolute top-0 h-full bg-orange-500 transition-all duration-300"
                  style={{
                    left: `${chargeData.approvedPercentage}%`,
                    width: `${chargeData.pendingPercentage}%`,
                  }}
                />
                <div
                  className="absolute top-0 h-full bg-red-500 transition-all duration-300"
                  style={{
                    left: `${chargeData.approvedPercentage + chargeData.pendingPercentage}%`,
                    width: `${chargeData.unapprovedPercentage}%`,
                  }}
                />
              </div>

              {/* Legend */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                  <div>
                    <div className="font-medium text-green-700">
                      Approved ({chargeData.approvedPercentage}%)
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {chargeData.approvedCount.toLocaleString()} charges
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full" />
                  <div>
                    <div className="font-medium text-orange-700">
                      Pending ({chargeData.pendingPercentage}%)
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {chargeData.pendingCount.toLocaleString()} charges
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <div>
                    <div className="font-medium text-red-700">
                      Unapproved ({chargeData.unapprovedPercentage}%)
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {chargeData.unapprovedCount.toLocaleString()} charges
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {(chargeData.pendingPercentage > 0 || chargeData.unapprovedPercentage > 0) && (
              <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <span className="text-sm text-orange-800">
                  {chargeData.pendingCount + chargeData.unapprovedCount} charges need review before
                  proceeding
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </CollapsibleContent>
    </Collapsible>
  );
}
