import { Component } from '@angular/core';
import { SideNavbar } from '../side-navbar/side-navbar';

@Component({
  selector: 'app-shared',
  imports: [SideNavbar],
  templateUrl: './shared.html',
  styleUrl: './shared.css',
})
export class Shared {}
