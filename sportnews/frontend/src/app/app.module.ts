import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { AuthModule } from '@auth0/auth0-angular';
import { FormsModule } from '@angular/forms';
import { AppComponent } from './app.component';
import { HomepageComponent } from './homepage/homepage.component';
import { AddNewsComponent } from './add-news/add-news.component';
import { CommonModule } from '@angular/common';
import { Nl2brPipe } from './nl2br.pipe';

@NgModule({
  declarations: [
    AppComponent,
    HomepageComponent,
    AddNewsComponent,
    Nl2brPipe
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    FormsModule,
    CommonModule,
    RouterModule.forRoot([
        { path: '', component: HomepageComponent },
        { path: 'addNews', component: AddNewsComponent }
    ]),
    AuthModule.forRoot({
        domain: 'dev-crydqe7sub8m26h7.us.auth0.com',
        clientId: 'E9IhhgUvzfmrNVMndW2rlcwGthV8Ke0o',
        cacheLocation: 'localstorage',
        authorizationParams: {
            redirect_uri:https://sport.event-fit.it,
            audience: 'https://backend'
        }
    })
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}