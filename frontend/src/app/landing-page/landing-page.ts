import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-page',
  imports: [RouterLink, FormsModule],
  templateUrl: './landing-page.html',
})
export class LandingPage {
  newsletterEmail = '';

  readonly subscribed = signal(false);

  // Placeholder until a newsletter endpoint exists on the backend
  subscribe(): void {
    this.subscribed.set(true);
  }
}
