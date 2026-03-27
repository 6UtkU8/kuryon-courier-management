import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-login-select-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './login-select-page.html',
  styleUrls: ['./login-select-page.css']
})
export class LoginSelectPageComponent {}