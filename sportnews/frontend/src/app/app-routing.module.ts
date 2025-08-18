import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomepageComponent } from './homepage/homepage.component';
import { AddNewsComponent } from './add-news/add-news.component';

const routes: Routes = [
  { path: '', component: HomepageComponent },
  { path: 'addNews', component: AddNewsComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}