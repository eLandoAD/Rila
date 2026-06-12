import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, from, map, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest } from './auth.models';
import { CryptoService } from '../crypto/crypto.service';

const TOKEN_KEY = 'sv_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly crypto = inject(CryptoService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly baseUrl = `${environment.apiBaseUrl}/auth`;

  private readonly tokenSignal = signal<string | null>(this.readToken());

  readonly token = this.tokenSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.tokenSignal() !== null);
  readonly username = computed(() => {
    const token = this.tokenSignal();
    return token ? this.extractSubject(token) : null;
  });

  /**
   * Generates the envelope keys client-side, then registers. No token is
   * returned: the account must be verified by email first.
   */
  register(username: string, email: string, password: string): Observable<AuthResponse> {
    return from(this.crypto.setupRegistrationKeys(password)).pipe(
      switchMap((env) => {
        const request: RegisterRequest = {
          username,
          email,
          password,
          encryptedDek: env.encryptedDek,
          dekIv: env.iv,
          keySalt: env.salt,
        };
        return this.http.post<AuthResponse>(`${this.baseUrl}/register`, request);
      }),
    );
  }

  /**
   * Logs in, then unwraps the DEK into memory using the password.
   */
  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, request).pipe(
      switchMap((res) => {
        this.persistToken(res.token);
        if (res.token && res.encryptedDek && res.dekIv && res.keySalt) {
          return from(
            this.crypto.setupLoginKeys(request.password, res.encryptedDek, res.dekIv, res.keySalt),
          ).pipe(map(() => res));
        }
        return [res];
      }),
    );
  }

  logout(): void {
    this.persistToken(null);
    this.crypto.clearSession();
  }

  forgotPassword(email: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/forgot-password`, { email }, { responseType: 'text' });
  }

  /**
   * Resets the password. Because the old password (and therefore the old DEK)
   * is unavailable, a fresh DEK is generated under the new password — see
   * SECURITY.md for the password-reset tradeoff.
   */
  resetPassword(token: string, newPassword: string): Observable<unknown> {
    return from(this.crypto.setupRegistrationKeys(newPassword)).pipe(
      switchMap((env) =>
        this.http.post(
          `${this.baseUrl}/reset-password`,
          {
            token,
            newPassword,
            newEncryptedDek: env.encryptedDek,
            newDekIv: env.iv,
            newKeySalt: env.salt,
          },
          { responseType: 'text' },
        ),
      ),
    );
  }

  verifyEmail(token: string): Observable<unknown> {
    return this.http.get(`${this.baseUrl}/verify`, {
      params: { token },
      responseType: 'text',
    });
  }

  resendVerification(email: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/resend-verification`, { email }, { responseType: 'text' });
  }

  getToken(): string | null {
    return this.tokenSignal();
  }

  private persistToken(token: string | null): void {
    this.tokenSignal.set(token);
    if (!this.isBrowser) {
      return;
    }
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  private readToken(): string | null {
    if (!this.isBrowser) {
      return null;
    }
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && this.isExpired(token)) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return token;
  }

  private isExpired(token: string): boolean {
    const payload = this.decodePayload(token);
    if (!payload || typeof payload['exp'] !== 'number') {
      return false;
    }
    return payload['exp'] * 1000 <= Date.now();
  }

  private extractSubject(token: string): string | null {
    const payload = this.decodePayload(token);
    return payload && typeof payload['sub'] === 'string' ? payload['sub'] : null;
  }

  private decodePayload(token: string): Record<string, unknown> | null {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
}
