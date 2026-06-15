import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // le rotte di autenticazione sono pubbliche: non allegare il token
  // (un token stale farebbe fallire la richiesta sul filtro lato server)
  if (req.url.includes('/api/auth/')) {
    return next(req);
  }

  const token = inject(AuthService).getToken();
  if (!token) {
    return next(req);
  }
  return next(
    req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }),
  );
};
