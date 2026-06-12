import { Routes } from '@angular/router';
import { Login } from './auth/login/login';
import { Register } from './auth/register/register';
import { VerifyEmail } from './auth/verify-email/verify-email';
import { ForgotPassword } from './auth/forgot-password/forgot-password';
import { ResetPassword } from './auth/reset-password/reset-password';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [

  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'verify-email', component: VerifyEmail },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'reset-password', component: ResetPassword },
  { path: '', loadComponent: () => import('./landing-page/landing-page').then(m => m.LandingPage)},
  { path: 'about', loadComponent: () => import('./about/about').then(m => m.About)},
  { path: 'filemanager/dashboard', canActivate: [authGuard], loadComponent: () => import('./filemanager/dashboard/dashboard').then(m => m.Dashboard)},
  { path: 'filemanager/files', canActivate: [authGuard], loadComponent: () => import('./filemanager/files/files').then(m => m.Files)},
  { path: 'filemanager/uploads', canActivate: [authGuard], loadComponent: () => import('./filemanager/upload/upload').then(m => m.Upload)},
  { path: 'filemanager/shared', canActivate: [authGuard], loadComponent: () => import('./filemanager/shared/shared').then(m => m.Shared)},
  { path: 'filemanager', redirectTo: 'filemanager/dashboard', pathMatch: 'full' },
  { path: '**', loadComponent: () => import('./not-found/not-found').then(m => m.NotFound)},
];
