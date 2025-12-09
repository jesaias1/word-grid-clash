import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Share, MoreVertical, Menu, X } from 'lucide-react';

interface InstallInstructionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type BrowserType = 'chrome' | 'samsung' | 'safari' | 'firefox' | 'other';

const detectBrowser = (): BrowserType => {
  const ua = navigator.userAgent.toLowerCase();
  
  if (/iphone|ipad|ipod/.test(ua)) {
    return 'safari';
  }
  if (/samsungbrowser/.test(ua)) {
    return 'samsung';
  }
  if (/firefox/.test(ua)) {
    return 'firefox';
  }
  if (/chrome/.test(ua) && !/edge/.test(ua)) {
    return 'chrome';
  }
  return 'other';
};

const browserInstructions: Record<BrowserType, { name: string; steps: string[]; icon: React.ReactNode }> = {
  chrome: {
    name: 'Chrome',
    steps: [
      'Tap the menu button (⋮) in the top-right corner',
      'Select "Add to Home Screen" or "Install App"',
      'Tap "Add" to confirm',
    ],
    icon: <MoreVertical className="w-6 h-6" />,
  },
  samsung: {
    name: 'Samsung Internet',
    steps: [
      'Tap the menu button (≡) at the bottom',
      'Select "Add page to" → "Home screen"',
      'Tap "Add" to confirm',
    ],
    icon: <Menu className="w-6 h-6" />,
  },
  safari: {
    name: 'Safari',
    steps: [
      'Tap the Share button (box with arrow) at the bottom',
      'Scroll down and tap "Add to Home Screen"',
      'Tap "Add" in the top-right corner',
    ],
    icon: <Share className="w-6 h-6" />,
  },
  firefox: {
    name: 'Firefox',
    steps: [
      'Tap the menu button (⋮) in the top-right corner',
      'Select "Install" or "Add to Home Screen"',
      'Tap "Add" to confirm',
    ],
    icon: <MoreVertical className="w-6 h-6" />,
  },
  other: {
    name: 'Your Browser',
    steps: [
      'Open your browser menu (usually ⋮ or ≡)',
      'Look for "Add to Home Screen" or "Install"',
      'Follow the prompts to add',
    ],
    icon: <Menu className="w-6 h-6" />,
  },
};

const InstallInstructionsDialog = ({ open, onOpenChange }: InstallInstructionsDialogProps) => {
  const browser = detectBrowser();
  const instructions = browserInstructions[browser];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            Install Lettus
          </DialogTitle>
          <DialogDescription>
            Add Lettus to your home screen for the best experience
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="p-2 bg-primary/20 rounded-full text-primary">
              {instructions.icon}
            </div>
            <div>
              <p className="font-medium text-sm">Detected: {instructions.name}</p>
              <p className="text-xs text-muted-foreground">Follow these steps to install</p>
            </div>
          </div>

          <ol className="space-y-3">
            {instructions.steps.map((step, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                  {index + 1}
                </span>
                <span className="text-sm pt-0.5">{step}</span>
              </li>
            ))}
          </ol>

          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Once installed, Lettus will appear on your home screen like any other app!
            </p>
          </div>
        </div>

        <Button onClick={() => onOpenChange(false)} className="w-full">
          <X className="w-4 h-4 mr-2" />
          Got it!
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default InstallInstructionsDialog;
