import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { Files } from './files';

describe('Files', () => {
  let component: Files;
  let fixture: ComponentFixture<Files>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Files],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(Files);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
