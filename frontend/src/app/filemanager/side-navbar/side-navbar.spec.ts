import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { SideNavbar } from './side-navbar';

describe('SideNavbar', () => {
  let component: SideNavbar;
  let fixture: ComponentFixture<SideNavbar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SideNavbar],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(SideNavbar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
