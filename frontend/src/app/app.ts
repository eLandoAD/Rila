import { Component, inject, signal } from '@angular/core';
import { Navbar } from './navbar/navbar';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Footer } from "./footer/footer";
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [Navbar, RouterOutlet, Footer],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('frontend');

  private readonly router = inject(Router);

  protected readonly isFilemanager = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.startsWith('/filemanager')),
      startWith(this.router.url.startsWith('/filemanager')),
    ),
    { initialValue: this.router.url.startsWith('/filemanager') },
  );
}
