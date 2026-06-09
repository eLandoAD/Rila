import { Routes } from '@angular/router';

export const routes: Routes = [
    // Add your routes here
    {path: '', loadComponent: () => import('./landing-page/landing-page').then(m => m.LandingPage)},
    {path: 'about', loadComponent: () => import('./about/about').then(m => m.About)},
    {path: 'filemanager/dashboard', loadComponent: () => import('./filemanager/dashboard/dashboard').then(m => m.Dashboard)},
    {path: 'filemanager/files', loadComponent: () => import('./filemanager/files/files').then(m => m.Files)},
    {path: 'filemanager/uploads', loadComponent: () => import('./filemanager/upload/upload').then(m => m.Upload)},
    {path: 'filemanager/shared', loadComponent: () => import('./filemanager/shared/shared').then(m => m.Shared)},
];
