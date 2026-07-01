import { Component, inject, signal, WritableSignal, afterNextRender } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-fake-inbox',
  imports: [RouterLink],
  templateUrl: './fake-inbox.html',
})
export class FakeInbox {
  private readonly queries = inject(ActivatedRoute).snapshot.queryParamMap;

  readonly email: WritableSignal<string | null> = signal(this.queries.get('email'));
  readonly token: WritableSignal<string | null> = signal(this.queries.get('token'));

  // stato UI della finta casella
  readonly arrived: WritableSignal<boolean> = signal(false); 
  readonly opened: WritableSignal<boolean> = signal(false); 

  constructor() {
    afterNextRender(() => {
      setTimeout(() => this.arrived.set(true), 900);
    });
  }

  open(): void {
    this.opened.set(true);
  }
}
