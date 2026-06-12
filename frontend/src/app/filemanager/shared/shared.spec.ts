import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { Shared } from './shared';

describe('Shared', () => {
  let component: Shared;
  let fixture: ComponentFixture<Shared>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Shared],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(Shared);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
