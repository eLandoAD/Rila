import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { CryptoService } from '../crypto/crypto.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  // injection dei 3 service necessari
  const auth = inject(AuthService);
  const crypto = inject(CryptoService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    if (crypto.hasSession() || (await crypto.restoreSession())) {
      return true;
    }
    auth.logout();
  }

  return router.createUrlTree(['/login'], {
    queryParams: { redirect: state.url },
  });
};
