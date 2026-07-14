import { Injectable, PLATFORM_ID, WritableSignal, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IAuthResponse } from '../interfaces/IAuthResponse';
import { ILoginRequest } from '../interfaces/ILoginRequest';
import { IRegisterRequest } from '../interfaces/IRegisterRequest';
import { IResetPasswordRequest } from '../interfaces/IResetPasswordRequest';
import { IResetInfoResponse } from '../interfaces/IResetInfoResponse';

const TOKEN_KEY = 'sv_token';

@Injectable({ providedIn: 'root' })
export class AuthService {

  // injection dei due servizi necessari
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  // verifico sia browser e prendo l'url base dall'.env
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly baseUrl = `${environment.apiBaseUrl}/auth`;

  private readonly tokenSignal: WritableSignal<string | null> = signal<string | null>(this.readToken());

  // mi salvo il token come readonly
  readonly token = this.tokenSignal.asReadonly();
  // computed per gestire autenticazione, usato poi nel resto del codice
  readonly isAuthenticated = computed(() => this.tokenSignal() !== null);

  // computed per gestire username di utente autenticato
  // usato nel resto del codice
  readonly username = computed(() => {
    const token = this.tokenSignal();
    return token ? this.extractSubject(token) : null;
  });

  // metodo per registrarsi, che punta all'endpoint register dell'api
  register(request: IRegisterRequest): Observable<IAuthResponse> {
    return this.http.post<IAuthResponse>(`${this.baseUrl}/register`, request);
  }

  // metodo per loggarsi, che punta all'endpoint login dell'api
  login(request: ILoginRequest): Observable<IAuthResponse> {
    return this.http
      .post<IAuthResponse>(`${this.baseUrl}/login`, request)
      .pipe(tap((res) => this.persistToken(res.token)));
  }

  // metodo per effettuare il logout
  logout(): void {
    this.persistToken(null);
  }

  // elimina definitivamente l'account dell'utente autenticato
  deleteAccount(): Observable<void> {
    return this.http.delete<void>(`${environment.apiBaseUrl}/users/me`);
  }

  // vari metodi per reset password, verifica, e via dicendo
  forgotPassword(email: string): Observable<string> {
    return this.http.post(`${this.baseUrl}/forgot-password`, { email }, { responseType: 'text' });
  }

  getResetInfo(token: string): Observable<IResetInfoResponse> {
    return this.http.get<IResetInfoResponse>(`${this.baseUrl}/reset-info`, { params: { token } });
  }

  resetPassword(request: IResetPasswordRequest): Observable<string> {
    return this.http.post(`${this.baseUrl}/reset-password`, request, { responseType: 'text' });
  }

  verifyEmail(token: string): Observable<string> {
    return this.http.get(`${this.baseUrl}/verify`, { params: { token }, responseType: 'text' });
  }

  resendVerification(email: string): Observable<string> {
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
