// app.component.ts
import { Component, Inject, PLATFORM_ID, OnInit, HostListener } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  standalone: false,
  template: `
    <!-- Header con design moderno -->
    <header class="header">
      <div class="container">
        <div class="header-content">
          <!-- Logo/Brand -->
          <div class="brand">
            <h1 class="brand-title">SportNews
            </h1>
          </div>

          <!-- Area autenticazione -->
          <div class="auth-section" *ngIf="isBrowser">
            <div *ngIf="auth.isAuthenticated$ | async; else loggedOut" class="user-area">
              <!-- Avatar e info utente -->
              <div class="user-info">
                <div class="avatar">
                  <span class="avatar-text">{{ getInitials((auth.user$ | async)?.name) }}</span>
                </div>
                <div class="user-details">
                  <p class="welcome-text">Benvenuto</p>
                  <p class="user-name">{{ (auth.user$ | async)?.name }}</p>
                </div>
              </div>

              <!-- Menu dropdown utente -->
              <div class="user-menu" [class.active]="isMenuOpen">
                <button class="menu-toggle" (click)="toggleMenu()">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>

                <div class="dropdown-menu" *ngIf="isMenuOpen">
                  <button class="menu-item logout-item" (click)="logout()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M9 21H5C4.44772 21 4 20.5523 4 20V4C4 3.44772 4.44772 3 5 3H9" stroke="currentColor" stroke-width="2"/>
                      <path d="M16 17L21 12L16 7" stroke="currentColor" stroke-width="2"/>
                      <path d="M21 12H9" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    Logout
                  </button>
                </div>
              </div>
            </div>

            <!-- Template per utente non autenticato -->
            <ng-template #loggedOut>
              <div class="login-section">
                <button class="login-btn" (click)="login()">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M15 3H19C19.5523 3 20 3.44772 20 4V20C20 20.5523 19.5523 21 19 21H15" stroke="currentColor" stroke-width="2"/>
                    <path d="M10 17L15 12L10 7" stroke="currentColor" stroke-width="2"/>
                    <path d="M15 12H3" stroke="currentColor" stroke-width="2"/>
                  </svg>
                  Accedi
                </button>
              </div>
            </ng-template>
          </div>
        </div>
      </div>
    </header>

    <!-- Contenuto principale -->
    <main class="main-content">
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [`
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      position: sticky;
      top: 0;
      z-index: 1000;
      backdrop-filter: blur(10px);
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 2rem;
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 0;
    }

    .brand-title {
      color: white;
      font-size: 2rem;
      font-weight: 700;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .auth-section {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .user-area {
      display: flex;
      align-items: center;
      gap: 1rem;
      position: relative;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: white;
    }

    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #ffeaa7, #fab1a0);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 1.1rem;
      color: #2d3436;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: transform 0.2s ease;
    }

    .avatar:hover {
      transform: scale(1.05);
    }

    .avatar-text {
      text-transform: uppercase;
    }

    .user-details {
      display: flex;
      flex-direction: column;
    }

    .welcome-text {
      font-size: 0.875rem;
      opacity: 0.9;
      margin-bottom: 2px;
    }

    .user-name {
      font-size: 1.1rem;
      font-weight: 600;
    }

    .user-menu {
      position: relative;
    }

    .menu-toggle {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      padding: 0.5rem;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .menu-toggle:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: translateY(-1px);
    }

    .menu-toggle.active {
      background: rgba(255, 255, 255, 0.3);
    }

    .dropdown-menu {
      position: absolute;
      top: calc(100% + 0.5rem);
      right: 0;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
      padding: 0.5rem;
      min-width: 200px;
      animation: slideDown 0.2s ease;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .menu-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      color: #2d3436;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
      border: none;
      background: none;
      width: 100%;
      font-size: 0.95rem;
    }

    .menu-item:hover {
      background: #f8f9ff;
      transform: translateX(4px);
    }

    .logout-item {
      color: #e74c3c;
    }

    .logout-item:hover {
      background: #ffe8e8;
    }

    .menu-divider {
      border: none;
      height: 1px;
      background: #e9ecef;
      margin: 0.5rem 0;
    }

    .login-section {
      display: flex;
      align-items: center;
    }

    .login-btn {
      background: rgba(255, 255, 255, 0.2);
      border: 2px solid rgba(255, 255, 255, 0.3);
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 50px;
      cursor: pointer;
      font-weight: 600;
      font-size: 1rem;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      backdrop-filter: blur(10px);
    }

    .login-btn:hover {
      background: white;
      color: #667eea;
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    }

    .main-content {
      min-height: calc(100vh - 80px);
      background: linear-gradient(to bottom, #f8f9ff, #ffffff);
    }

    /* Responsive design */
    @media (max-width: 768px) {
      .container {
        padding: 0 1rem;
      }

      .user-details {
        display: none;
      }

      .brand-title {
        font-size: 1.5rem;
      }

      .dropdown-menu {
        right: -1rem;
      }
    }

    @media (max-width: 480px) {
      .header-content {
        padding: 0.75rem 0;
      }

      .avatar {
        width: 40px;
        height: 40px;
        font-size: 1rem;
      }

      .login-btn {
        padding: 0.6rem 1.2rem;
        font-size: 0.9rem;
      }
    }
  `]
})
export class AppComponent implements OnInit {
  isBrowser = false;

  constructor(
    public auth: AuthService,
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.isBrowser = isPlatformBrowser(this.platformId);

    if (!this.isBrowser) return;


    this.auth.user$.subscribe(user => {
      if (user) {
        this.http.post('http://localhost:8080/register', {
          auth0Id: user.sub,
          name: user.name,
          email: user.email
        }).subscribe({
          next: () => console.log('Utente salvato'),
          error: err => console.error('Errore nel salvataggio utente', err)
        });
      }
    });


  }

  login() {
    if (this.isBrowser) {
      this.auth.loginWithRedirect();
    }
  }

  logout() {
    if (this.isBrowser) {
      this.auth.logout({ logoutParams: { returnTo: window.location.origin } });
    }
  }

  isMenuOpen = false;


  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  getInitials(name: string | undefined): string {
    if (!name) return 'U';

    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .substring(0, 2);
  }


  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const menuElement = target.closest('.user-menu');

    if (!menuElement && this.isMenuOpen) {
      this.isMenuOpen = false;
    }
  }
}