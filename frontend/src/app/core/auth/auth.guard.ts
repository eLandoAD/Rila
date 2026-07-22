import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { CryptoService } from '../crypto/crypto.service';

export const authGuard: CanActivateFn = (_route, state) => {
  // inject the 3 required services
  const auth = inject(AuthService);
  const crypto = inject(CryptoService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    // no crypto session in memory (e.g. after a reload): the DEK lives only there,
    // so go back to login instead of staying authenticated without being able to decrypt anything
    if (crypto.hasSession()) {
      return true;
    }
    auth.logout();
  }

  return router.createUrlTree(['/login'], {
    queryParams: { redirect: state.url },
  });
};
