import { Routes } from '@angular/router';

export const routes: Routes = [
    // Add your routes here
    {path: '', loadComponent: () => import('./landing-page/landing-page').then(m => m.LandingPage)},
    {path: 'about', loadComponent: () => import('./about/about').then(m => m.About)},
];
