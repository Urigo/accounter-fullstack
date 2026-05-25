import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth0 } from '@auth0/auth0-react';
import { clearStoredAuth0Session } from '../lib/auth0-session.js';
import { setReauthHandler, type ReauthOutcome } from '../lib/reauth-coordinator.js';
import { Button } from './ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog.js';

export function SessionExpiryDialog(): ReactElement {
  const { loginWithPopup } = useAuth0();
  const [open, setOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const resolveRef = useRef<((outcome: ReauthOutcome) => void) | null>(null);

  const settle = useCallback((outcome: ReauthOutcome) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setSigningIn(false);
    setOpen(false);
    resolve?.(outcome);
  }, []);

  useEffect(() => {
    setReauthHandler(
      () =>
        new Promise<ReauthOutcome>(resolve => {
          resolveRef.current = resolve;
          setOpen(true);
        }),
    );
    return () => {
      setReauthHandler(null);
    };
  }, []);

  const handleSignIn = useCallback(async () => {
    setSigningIn(true);
    try {
      // Drop the stale/rotated refresh token so the popup mints a fresh session.
      clearStoredAuth0Session();
      await loginWithPopup({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: 'openid profile email offline_access',
          prompt: 'login',
        },
      });
      settle('authenticated');
    } catch {
      // Popup blocked, closed, or failed — fall back to the full-page login flow.
      settle('redirect');
    }
  }, [loginWithPopup, settle]);

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        // Any dismissal without signing in falls back to the login page.
        if (!next && !signingIn) {
          settle('redirect');
        }
      }}
    >
      <DialogContent showCloseButton={false} onInteractOutside={event => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Session expired</DialogTitle>
          <DialogDescription>
            Your session expired. Sign in to continue where you left off.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => settle('redirect')} disabled={signingIn}>
            Go to login page
          </Button>
          <Button onClick={handleSignIn} disabled={signingIn}>
            {signingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
