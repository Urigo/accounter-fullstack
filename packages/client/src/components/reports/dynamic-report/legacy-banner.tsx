import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button.js';

interface LegacyBannerProps {
  onDismiss: () => void;
}

export function LegacyBanner({ onDismiss }: LegacyBannerProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-200">
      <div className="flex items-center gap-3">
        <AlertTriangle className="size-5 text-amber-600" />
        <p className="text-sm text-amber-800">
          This template was saved in a legacy format. Please review and resave to upgrade.
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDismiss}
        className="text-amber-700 hover:text-amber-900 hover:bg-amber-100"
      >
        <X className="size-4 mr-1" />
        Dismiss
      </Button>
    </div>
  );
}
