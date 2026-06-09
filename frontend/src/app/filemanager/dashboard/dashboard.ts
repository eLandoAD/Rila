import { Component } from '@angular/core';
import { SideNavbar } from '../side-navbar/side-navbar';

@Component({
  selector: 'app-dashboard',
  imports: [SideNavbar],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {}
