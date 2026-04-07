import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Zap, X } from 'lucide-react';

interface UpgradePromptProps {
  usageCount: number;
  freeLimit: number;
  onDismiss?: () => void;
}

export default function UpgradePrompt({ usageCount, freeLimit, onDismiss }: UpgradePromptProps) {
  return (
    <div className="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/30 rounded-xl p-5 relative">
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] shrink-0">
          <Zap className="w-5 h-5" />
        </div>
        <div className="space-y-2 flex-1 min-w-0">
          <div className="font-semibold">
            {usageCount >= freeLimit
              ? "You've reached your free limit"
              : `${freeLimit - usageCount} evaluation${freeLimit - usageCount === 1 ? '' : 's'} remaining this month`}
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">
            {usageCount >= freeLimit
              ? 'Upgrade to Pro for unlimited AI evaluations + PDF generation.'
              : `You've used ${usageCount} of ${freeLimit} free evaluations. Upgrade to Pro for unlimited access.`}
          </p>
          <Link to="/pricing">
            <Button size="sm" className="gap-2 font-mono mt-1">
              <Zap className="w-3 h-3" />
              UPGRADE TO PRO — $19/MONTH
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
