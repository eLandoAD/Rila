import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { CryptoService } from '../crypto/crypto.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const crypto = inject(CryptoService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    // The JWT survives a reload, but the in-memory DEK does not. Try to restore it
    // from sessionStorage; if the keys are gone (e.g. the tab was closed) force a
    // fresh login instead of leaving the user unable to decrypt anything.
    if (crypto.hasSession() || (await crypto.restoreSession())) {
      return true;
    }
    auth.logout();
  }

  return router.createUrlTree(['/login'], {
    queryParams: { redirect: state.url },
  });
};
