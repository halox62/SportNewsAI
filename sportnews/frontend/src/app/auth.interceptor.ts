import { Injectable, NgZone } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '@auth0/auth0-angular';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(
    private auth: AuthService,
    private ngZone: NgZone,
    private snackBar: MatSnackBar
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          this.ngZone.run(() => {
            this.snackBar.open(
              '⚠️ Sessione scaduta o non autenticato. Fai login per continuare.',
              'Login',
              {
                duration: 5000,
                horizontalPosition: 'center',
                verticalPosition: 'top',
              }
            ).onAction().subscribe(() => {
              this.auth.loginWithRedirect();
            });
          });
        }
        return throwError(() => error);
      })
    );
  }
}
