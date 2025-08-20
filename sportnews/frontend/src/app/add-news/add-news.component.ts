import { Component, OnInit, Inject, PLATFORM_ID} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';

interface NewsArticle {
  titolo: string;
  paragrafo: string;
  contenuto: string;
  dataCreazione?: Date;
  expanded?: boolean;
}

interface SavedArticle {
  id?: number;
  titolo: string;
  sottotitolo: string;
  contenuto?: string;
  link: string;
  data: string;
  editing?: boolean;
  expanded?: boolean;
  originalTitolo?: string;
  originalSottotitolo?: string;
  originalContenuto?: string;
}

@Component({
  selector: 'app-add-news',
  standalone: false,
  template: `
    <div class="container">
      <!-- Header -->
      <div class="page-header">
        <h1 class="page-title">📝 Gestione Notizie</h1>
        <p class="page-subtitle">Aggiungi nuove notizie e gestisci quelle esistenti</p>
      </div>

      <button (click)="goToHome()" class="btn btn-primary">
        ← Indietro
      </button>

      <!-- Tabs Navigation -->
      <div class="tabs-container">
        <div class="tabs-header">
          <button
            class="tab-button"
            [class.active]="activeTab === 'add'"
            (click)="setActiveTab('add')"
          >
            ➕ Aggiungi Notizia
          </button>
          <button
            class="tab-button"
            [class.active]="activeTab === 'manage'"
            (click)="setActiveTab('manage')"
          >
            📚 I Miei Articoli ({{ savedArticles.length }})
          </button>
        </div>

        <!-- Tab Content: Aggiungi Notizia -->
        <div class="tab-content" *ngIf="activeTab === 'add'">
          <!-- Messaggi di stato -->
          <div class="status-messages">
            <div class="success-message" *ngIf="showSuccessMessage">
              <div class="message-icon">✅</div>
              <div class="message-content">
                <h3>Notizia aggiunta con successo!</h3>
                <p>La notizia è stata salvata nel database.</p>
              </div>
            </div>

            <div class="error-message" *ngIf="errorMessage">
              <div class="message-icon">❌</div>
              <div class="message-content">
                <h3>Errore</h3>
                <p>{{ errorMessage }}</p>
              </div>
            </div>
          </div>

          <!-- Form per aggiungere notizia -->
          <div class="form-container">
            <form class="news-form" (ngSubmit)="onSubmit()" #newsForm="ngForm" novalidate>
              <!-- Titolo -->
              <div class="form-group">
                <label for="titolo" class="form-label required">
                  📰 Titolo
                </label>
                <input
                  type="text"
                  id="titolo"
                  name="titolo"
                  [(ngModel)]="newsArticle.titolo"
                  class="form-input"
                  placeholder="Inserisci il titolo della notizia..."
                  #titoloRef="ngModel"
                  required
                  maxlength="200"
                  (input)="onInputChange()"
                />
                <div class="field-info">
                  <small>Caratteri: {{ getTitoloLength() }}/200</small>
                </div>
                <div class="validation-error" *ngIf="titoloRef.invalid && titoloRef.touched">
                  <small>⚠️ Il titolo è obbligatorio</small>
                </div>
              </div>

              <div class="form-group">
                <label for="paragrafo" class="form-label">
                  📝 Paragrafo
                </label>
                <textarea
                  id="paragrafo"
                  name="paragrafo"
                  [(ngModel)]="newsArticle.paragrafo"
                  class="form-textarea"
                  placeholder="Inserisci un breve paragrafo introduttivo..."
                  rows="3"
                  maxlength="500"
                  (input)="onInputChange()"
                ></textarea>
                <div class="field-info">
                  <small>Caratteri: {{ newsArticle.paragrafo?.length || 0 }}/500</small>
                </div>
              </div>

              <!-- Contenuto -->
              <div class="form-group">
                <label for="contenuto" class="form-label required">
                  📝 Contenuto
                </label>
                <textarea
                  id="contenuto"
                  name="contenuto"
                  [(ngModel)]="newsArticle.contenuto"
                  class="form-textarea"
                  placeholder="Inserisci il contenuto della notizia..."
                  rows="6"
                  #contenutoRef="ngModel"
                  required
                  maxlength="1000"
                  (input)="onInputChange()"
                ></textarea>
                <div class="field-info">
                  <small>Caratteri: {{ getContenutoLength() }}/1000</small>
                </div>
                <div class="validation-error" *ngIf="contenutoRef.invalid && contenutoRef.touched">
                  <small>⚠️ Il contenuto è obbligatorio</small>
                </div>
              </div>

              <!-- Pulsanti -->
              <div class="form-actions">
                <button
                  type="button"
                  class="btn btn-secondary"
                  (click)="resetForm()"
                  [disabled]="isSubmitting"
                >
                  🔄 Reset
                </button>

                <button
                  type="submit"
                  class="btn btn-primary"
                  [disabled]="isSubmitting || !isFormValid()"
                >
                  <span *ngIf="!isSubmitting">💾 Salva Notizia</span>
                  <span *ngIf="isSubmitting">⏳ Salvando...</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Tab Content: Gestione Articoli -->
        <div class="tab-content" *ngIf="activeTab === 'manage'">
          <!-- Loading state -->
          <div class="loading-container" *ngIf="loadingArticles">
            <div class="loading-spinner">⏳</div>
            <p>Caricamento articoli...</p>
          </div>

          <!-- Empty state -->
          <div class="empty-state" *ngIf="!loadingArticles && savedArticles.length === 0">
            <div class="empty-icon">📰</div>
            <h3>Nessun articolo trovato</h3>
            <p>Non hai ancora creato nessun articolo. Inizia creando il tuo primo articolo!</p>
            <button class="btn btn-primary" (click)="setActiveTab('add')">
              ➕ Crea il tuo primo articolo
            </button>
          </div>

          <!-- Articles list -->
          <div class="articles-container" *ngIf="!loadingArticles && savedArticles.length > 0">
            <div class="articles-header">
              <h2>📚 I Tuoi Articoli</h2>
              <button class="btn btn-secondary" (click)="loadMyArticles()">
                🔄 Ricarica
              </button>
            </div>

            <div class="articles-list">
              <div class="article-item" *ngFor="let article of savedArticles; let i = index">
                <!-- Modalità visualizzazione -->
                <div class="article-content" *ngIf="!article.editing">
                  <div class="article-header">
                    <div class="article-info">
                      <span class="article-number">#{{ i + 1 }}</span>
                      <span class="article-date">{{ formatArticleDate(article.data) }}</span>
                    </div>
                    <div class="article-actions">
                      <button class="btn-icon" (click)="startEditing(article)" title="Modifica">
                        ✏️
                      </button>
                      <button class="btn-icon" (click)="openArticleContent(article)" title="Visualizza">
                        👁️
                      </button>
                      <button
                        class="btn-icon"
                        (click)="toggleArticleExpansion(article)"
                        title="Espandi/Comprimi"
                        *ngIf="article.contenuto && article.contenuto.length > 150"
                      >
                        {{ article.expanded ? '📖' : '📑' }}
                      </button>
                      <button
                        class="btn-icon"
                        (click)="downloadArticle(article)"
                        title="Scarica"
                        [disabled]="downloadingArticle === article.id"
                      >
                        <span *ngIf="downloadingArticle !== article.id">💾</span>
                        <span *ngIf="downloadingArticle === article.id">⏳</span>
                      </button>
                      <button
                        class="btn-icon btn-delete"
                        (click)="confirmDeleteArticle(article)"
                        title="Elimina"
                        [disabled]="deletingArticle === article.id"
                      >
                        <span *ngIf="deletingArticle !== article.id">🗑️</span>
                        <span *ngIf="deletingArticle === article.id">⏳</span>
                      </button>
                    </div>
                  </div>
                  <h3 class="article-title">{{ article.titolo }}</h3>
                  <p class="article-subtitle" *ngIf="article.sottotitolo">{{ article.sottotitolo }}</p>

                  <!-- Contenuto dell'articolo -->
                  <div class="article-content-section" *ngIf="article.contenuto">
                    <div class="article-content-display" [class.article-content-preview]="!article.expanded">
                      {{ article.contenuto }}
                    </div>
                    <button
                      class="expand-content-btn"
                      (click)="toggleArticleExpansion(article)"
                      *ngIf="article.contenuto.length > 150"
                    >
                      {{ article.expanded ? '▲ Mostra meno' : '▼ Mostra tutto' }}
                    </button>
                  </div>
                </div>

                <!-- Modalità modifica -->
                <div class="article-edit-content" *ngIf="article.editing">
                  <div class="edit-form">
                    <div class="form-group">
                      <label class="form-label">📰 Titolo</label>
                      <input
                        type="text"
                        class="form-input"
                        [(ngModel)]="article.titolo"
                        maxlength="200"
                        placeholder="Titolo dell'articolo..."
                      />
                      <div class="field-info">
                        <small>Caratteri: {{ article.titolo?.length || 0 }}/200</small>
                      </div>
                    </div>

                    <div class="form-group">
                      <label class="form-label">📝 Sottotitolo</label>
                      <textarea
                        class="form-textarea"
                        [(ngModel)]="article.sottotitolo"
                        rows="3"
                        maxlength="500"
                        placeholder="Breve descrizione o sottotitolo..."
                      ></textarea>
                      <div class="field-info">
                        <small>Caratteri: {{ article.sottotitolo?.length || 0 }}/500</small>
                      </div>
                    </div>

                    <div class="form-group">
                      <label class="form-label">📄 Contenuto</label>
                      <textarea
                        class="form-textarea content-textarea"
                        [(ngModel)]="article.contenuto"
                        rows="8"
                        maxlength="2000"
                        placeholder="Contenuto completo dell'articolo..."
                      ></textarea>
                      <div class="field-info">
                        <small>Caratteri: {{ article.contenuto?.length || 0 }}/2000</small>
                      </div>
                    </div>

                    <div class="edit-actions">
                      <button class="btn btn-secondary" (click)="cancelEditing(article)">
                        ❌ Annulla
                      </button>
                      <button
                        class="btn btn-primary"
                        (click)="saveArticle(article)"
                        [disabled]="updatingArticle || !isArticleValid(article)"
                      >
                        <span *ngIf="!updatingArticle">💾 Salva Modifiche</span>
                        <span *ngIf="updatingArticle">⏳ Salvando...</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Update status messages -->
          <div class="status-messages" *ngIf="updateSuccessMessage || updateErrorMessage">
            <div class="success-message" *ngIf="updateSuccessMessage">
              <div class="message-icon">✅</div>
              <div class="message-content">
                <h3>Articolo aggiornato!</h3>
                <p>Le modifiche sono state salvate con successo.</p>
              </div>
            </div>

            <div class="error-message" *ngIf="updateErrorMessage">
              <div class="message-icon">❌</div>
              <div class="message-content">
                <h3>Errore nell'aggiornamento</h3>
                <p>{{ updateErrorMessage }}</p>
              </div>
            </div>
          </div>

          <!-- Download status messages -->
          <div class="status-messages" *ngIf="downloadSuccessMessage || downloadErrorMessage">
            <div class="success-message" *ngIf="downloadSuccessMessage">
              <div class="message-icon">✅</div>
              <div class="message-content">
                <h3>Download completato!</h3>
                <p>L'articolo è stato scaricato con successo.</p>
              </div>
            </div>

            <div class="error-message" *ngIf="downloadErrorMessage">
              <div class="message-icon">❌</div>
              <div class="message-content">
                <h3>Errore nel download</h3>
                <p>{{ downloadErrorMessage }}</p>
              </div>
            </div>
          </div>

          <!-- Delete status messages -->
          <div class="status-messages" *ngIf="deleteSuccessMessage || deleteErrorMessage">
            <div class="success-message" *ngIf="deleteSuccessMessage">
              <div class="message-icon">✅</div>
              <div class="message-content">
                <h3>Articolo eliminato!</h3>
                <p>L'articolo è stato eliminato con successo.</p>
              </div>
            </div>

            <div class="error-message" *ngIf="deleteErrorMessage">
              <div class="message-icon">❌</div>
              <div class="message-content">
                <h3>Errore nell'eliminazione</h3>
                <p>{{ deleteErrorMessage }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Lista notizie aggiunte -->
      <div class="recent-news-section" *ngIf="addedNews.length > 0 && activeTab === 'add'">
        <div class="section-header">
          <h2 class="section-title">📚 Notizie Aggiunte ({{ addedNews.length }})</h2>
          <button class="toggle-button" (click)="toggleAddedNews()">
            {{ showAddedNews ? '▲ Nascondi' : '▼ Mostra' }}
          </button>
        </div>

        <div class="recent-news-list" *ngIf="showAddedNews">
          <div class="recent-news-item" *ngFor="let news of addedNews; let i = index">
            <div class="news-item-header">
              <span class="news-number">#{{ i + 1 }}</span>
              <span class="news-date">{{ formatDate(news.dataCreazione!) }}</span>
            </div>
            <h3 class="news-title">{{ news.titolo }}</h3>
            <p class="news-subtitle">{{ news.contenuto }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal di conferma eliminazione -->
    <div class="modal-overlay" *ngIf="showDeleteModal" (click)="cancelDelete()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>🗑️ Conferma Eliminazione</h3>
        </div>
        <div class="modal-body">
          <p>Sei sicuro di voler eliminare questo articolo?</p>
          <div class="article-to-delete" *ngIf="articleToDelete">
            <strong>{{ articleToDelete.titolo }}</strong>
            <small class="text-muted">{{ formatArticleDate(articleToDelete.data) }}</small>
          </div>
          <p class="warning-text">⚠️ Questa azione non può essere annullata.</p>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" (click)="cancelDelete()" [disabled]="deletingArticle">
            ❌ Annulla
          </button>
          <button
            class="btn btn-danger"
            (click)="deleteArticle()"
            [disabled]="deletingArticle"
          >
            <span *ngIf="!deletingArticle">🗑️ Elimina</span>
            <span *ngIf="deletingArticle">⏳ Eliminando...</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .page-header {
      text-align: center;
      margin-bottom: 30px;
      padding: 30px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 12px;
    }

    .page-title {
      margin: 0 0 10px 0;
      font-size: 2.5rem;
      font-weight: 600;
    }

    .page-subtitle {
      margin: 0;
      font-size: 1.1rem;
      opacity: 0.9;
    }

    /* Tabs */
    .tabs-container {
      margin-top: 30px;
    }

    .tabs-header {
      display: flex;
      gap: 10px;
      margin-bottom: 30px;
      border-bottom: 2px solid #e9ecef;
    }

    .tab-button {
      padding: 12px 24px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 500;
      color: #6c757d;
      border-bottom: 2px solid transparent;
      transition: all 0.2s ease;
    }

    .tab-button:hover {
      color: #495057;
      background: #f8f9fa;
    }

    .tab-button.active {
      color: #667eea;
      border-bottom-color: #667eea;
      background: #f8f9ff;
    }

    .tab-content {
      min-height: 400px;
    }

    /* Articles Management */
    .loading-container {
      text-align: center;
      padding: 60px 20px;
      color: #6c757d;
    }

    .loading-spinner {
      font-size: 2rem;
      margin-bottom: 15px;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #6c757d;
    }

    .empty-icon {
      font-size: 4rem;
      margin-bottom: 20px;
    }

    .empty-state h3 {
      margin-bottom: 10px;
      color: #495057;
    }

    .articles-container {
      background: white;
      border: 1px solid #e9ecef;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }

    .articles-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 25px;
      background: #f8f9fa;
      border-bottom: 1px solid #e9ecef;
    }

    .articles-header h2 {
      margin: 0;
      color: #495057;
      font-size: 1.3rem;
    }

    .articles-list {
      padding: 0;
    }

    .article-item {
      padding: 20px 25px;
      border-bottom: 1px solid #f1f3f4;
    }

    .article-item:last-child {
      border-bottom: none;
    }

    .article-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .article-info {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .article-number {
      background: #667eea;
      color: white;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 500;
    }

    .article-date {
      color: #6c757d;
      font-size: 0.9rem;
    }

    .article-actions {
      display: flex;
      gap: 8px;
    }

    .btn-icon {
      background: none;
      border: none;
      font-size: 1.1rem;
      cursor: pointer;
      padding: 6px;
      border-radius: 4px;
      transition: background-color 0.2s ease;
    }

    .btn-icon:hover {
      background: #f8f9fa;
    }

    .btn-icon:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-delete:hover:not(:disabled) {
      background: #ffe6e6;
      color: #dc3545;
    }

    .article-title {
      margin: 0 0 8px 0;
      color: #2c3e50;
      font-size: 1.1rem;
      font-weight: 600;
    }

    .article-subtitle {
      margin: 0 0 10px 0;
      color: #666;
      line-height: 1.4;
    }

    /* Contenuto articolo */
    .article-content-section {
      margin-top: 10px;
    }

    .article-content-display {
      color: #666;
      line-height: 1.6;
      white-space: pre-line;
      margin-top: 8px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }

    .article-content-preview {
      max-height: 100px;
      overflow: hidden;
      position: relative;
    }

    .article-content-preview::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 30px;
      background: linear-gradient(transparent, #f8f9fa);
    }

    .expand-content-btn {
      background: none;
      border: none;
      color: #667eea;
      cursor: pointer;
      font-size: 0.9rem;
      margin-top: 10px;
      padding: 5px 0;
      text-decoration: underline;
      transition: color 0.2s ease;
    }

    .expand-content-btn:hover {
      color: #5a6fd8;
    }

    /* Edit Form */
    .article-edit-content {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin-top: 10px;
    }

    .edit-form .form-group {
      margin-bottom: 15px;
    }

    .content-textarea {
      min-height: 200px;
      font-family: 'Courier New', monospace;
      line-height: 1.5;
    }

    .edit-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      margin-top: 20px;
    }

    /* Status Messages */
    .status-messages {
      margin-bottom: 30px;
    }

    .success-message,
    .error-message {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 15px 20px;
      border-radius: 8px;
      margin-bottom: 15px;
    }

    .success-message {
      background: #d1edff;
      border: 1px solid #9fdbff;
      color: #0056b3;
    }

    .error-message {
      background: #ffe6e6;
      border: 1px solid #ffb3b3;
      color: #d63384;
    }

    .message-icon {
      font-size: 1.5rem;
    }

    .message-content h3 {
      margin: 0 0 5px 0;
      font-size: 1.1rem;
    }

    .message-content p {
      margin: 0;
      font-size: 0.95rem;
    }

    /* Form Styles */
    .form-container {
      background: white;
      border: 1px solid #e9ecef;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      margin-bottom: 30px;
    }

    .form-group {
      margin-bottom: 25px;
    }

    .form-label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
      color: #495057;
      font-size: 1rem;
    }

    .form-label.required::after {
      content: " *";
      color: #dc3545;
    }

    .form-input,
    .form-textarea {
      width: 100%;
      padding: 12px 15px;
      border: 2px solid #e9ecef;
      border-radius: 8px;
      font-size: 1rem;
      font-family: inherit;
      transition: border-color 0.2s ease;
      box-sizing: border-box;
    }

    .form-input:focus,
    .form-textarea:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .form-textarea {
      resize: vertical;
      min-height: 120px;
    }

    .field-info {
      margin-top: 5px;
      text-align: right;
    }

    .field-info small {
      color: #6c757d;
      font-size: 0.85rem;
    }

    .validation-error {
      margin-top: 5px;
    }

    .validation-error small {
      color: #dc3545;
      font-size: 0.85rem;
    }

    .form-actions {
      display: flex;
      gap: 15px;
      justify-content: flex-end;
      flex-wrap: wrap;
      margin-top: 30px;
    }

    .btn {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    }

    .btn-secondary {
      background: #6c757d;
      color: white;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #5a6268;
    }

    .btn-danger {
      background: #dc3545;
      color: white;
    }

    .btn-danger:hover:not(:disabled) {
      background: #c82333;
      transform: translateY(-1px);
    }

    /* Modal Styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }

    .modal-content {
      background: white;
      border-radius: 12px;
      max-width: 500px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    }

    .modal-header {
      padding: 20px 25px 15px;
      border-bottom: 1px solid #e9ecef;
    }

    .modal-header h3 {
      margin: 0;
      color: #495057;
      font-size: 1.2rem;
    }

    .modal-body {
      padding: 20px 25px;
    }

    .modal-body p {
      margin: 0 0 15px 0;
      color: #666;
      line-height: 1.5;
    }

    .article-to-delete {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
      margin: 15px 0;
    }

    .article-to-delete strong {
      display: block;
      color: #2c3e50;
      margin-bottom: 5px;
    }

    .text-muted {
      color: #6c757d;
      font-size: 0.9rem;
    }

    .warning-text {
      color: #dc3545;
      font-weight: 500;
      margin-top: 15px;
    }

    .modal-actions {
      padding: 15px 25px 20px;
      border-top: 1px solid #e9ecef;
      display: flex;
      gap: 15px;
      justify-content: flex-end;
    }

    /* Recent News Section */
    .recent-news-section {
      background: white;
      border: 1px solid #e9ecef;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 25px;
      background: #f8f9fa;
      border-bottom: 1px solid #e9ecef;
    }

    .section-title {
      margin: 0;
      color: #495057;
      font-size: 1.3rem;
    }

    .toggle-button {
      background: #667eea;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: background-color 0.2s ease;
    }

    .toggle-button:hover {
      background: #5a6fd8;
    }

    .recent-news-list {
      padding: 0;
    }

    .recent-news-item {
      padding: 20px 25px;
      border-bottom: 1px solid #f1f3f4;
    }

    .recent-news-item:last-child {
      border-bottom: none;
    }

    .news-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .news-number {
      background: #667eea;
      color: white;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 500;
    }

    .news-date {
      color: #6c757d;
      font-size: 0.9rem;
    }

    .news-title {
      margin: 0 0 8px 0;
      color: #2c3e50;
      font-size: 1.1rem;
      font-weight: 600;
    }

    .news-subtitle {
      margin: 0;
      color: #666;
      line-height: 1.4;
    }

    @media (max-width: 768px) {
      .container {
        padding: 15px;
      }

      .tabs-header {
        flex-direction: column;
        gap: 5px;
      }

      .tab-button {
        width: 100%;
        text-align: left;
      }

      .form-container {
        padding: 20px;
      }

      .form-actions,
      .edit-actions {
        flex-direction: column;
      }

      .btn {
        width: 100%;
        justify-content: center;
      }

      .articles-header {
        flex-direction: column;
        gap: 15px;
        align-items: stretch;
      }

      .article-header {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }

      .article-actions {
        justify-content: flex-end;
      }

      .modal-overlay {
        padding: 10px;
      }

      .modal-actions {
        flex-direction: column;
      }

      .modal-actions .btn {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})


export class AddNewsComponent implements OnInit {
  private readonly addNewsUrl = 'https://sport.event-fit.it/api/v1/addNews';
  private readonly myArticlesUrl = 'https://sport.event-fit.it/api/v1/my-articles';
  private readonly updateArticleUrl = 'https://sport.event-fit.it/api/v1/update-article';
  private readonly deleteArticleUrl = 'https://sport.event-fit.it/api/v1/delete-article';
  private readonly updateBlob = 'https://sport.event-fit.it/api/v1/update-blob-content';

  // Tab management
  activeTab: 'add' | 'manage' = 'add';

  // Model per il form
  newsArticle: NewsArticle = {
    titolo: '',
    paragrafo: '',
    contenuto: ''
  };

  // Stati del componente per aggiunta
  isSubmitting: boolean = false;
  showSuccessMessage: boolean = false;
  errorMessage: string = '';

  showDeleteModal: boolean = false;
  articleToDelete: any = null;
  deletingArticle: number | null = null;
  deleteSuccessMessage: boolean = false;
  deleteErrorMessage: string = '';

  // Lista delle notizie aggiunte
  addedNews: (NewsArticle & { dataCreazione: Date })[] = [];
  showAddedNews: boolean = false;

  // Gestione articoli salvati
  savedArticles: SavedArticle[] = [];
  loadingArticles: boolean = false;
  updatingArticle: boolean = false;
  updateSuccessMessage: boolean = false;
  updateErrorMessage: string = '';



  // Nuove proprietà per la funzionalità di download
  downloadingArticle: number | null = null;
  downloadSuccessMessage: boolean = false;
  downloadErrorMessage: string = '';

  constructor(private http: HttpClient, private router: Router, public auth: AuthService,          // <-- inietti AuthService
    @Inject(PLATFORM_ID) private platformId: Object) {
    console.log('AddNewsComponent constructor called');
  }

  ngOnInit(): void {
    // Carica gli articoli all'avvio se siamo nella tab manage
    if (this.activeTab === 'manage') {
      this.loadMyArticles();
    }
  }

  // Tab Management
  setActiveTab(tab: 'add' | 'manage'): void {
    this.activeTab = tab;
    if (tab === 'manage' && this.savedArticles.length === 0) {
      this.loadMyArticles();
    }
    // Reset messages when switching tabs
    this.clearMessages();
  }

  // Clear all messages
  clearMessages(): void {
    this.errorMessage = '';
    this.showSuccessMessage = false;
    this.updateSuccessMessage = false;
    this.updateErrorMessage = '';
  }

  // Load user's articles
  async loadMyArticles(): Promise<void> {
    this.loadingArticles = true;
    this.clearMessages();

    const token = await this.auth.getAccessTokenSilently().toPromise();
    const headers = { Authorization: `Bearer ${token}` };

    this.http.get<{success: boolean, results: SavedArticle[]}>(this.myArticlesUrl, { headers }).subscribe({
      next: (response) => {
        console.log('✅ Articoli caricati:', response);
        if (response.success) {
          this.savedArticles = response.results.map(article => ({
            ...article,
            editing: false
          }));
        }
        this.loadingArticles = false;
      },
      error: (error) => {
        console.error('❌ Errore nell\'aggiornamento articolo:', error);
        this.updateErrorMessage = 'Errore nell\'aggiornamento: ' + (error.error?.error || error.message || 'Errore sconosciuto');
        this.updatingArticle = false;
      }
    });
  }

  confirmDeleteArticle(article: any): void {
    this.articleToDelete = article;
    this.showDeleteModal = true;
    // Reset dei messaggi precedenti
    this.deleteSuccessMessage = false;
    this.deleteErrorMessage = '';
  }

  /**
   * Annulla l'eliminazione e chiude il modal
   */
  cancelDelete(): void {
    this.showDeleteModal = false;
    this.articleToDelete = null;
  }

  /**
   * Elimina l'articolo chiamando l'API
   */
  async deleteArticle(): Promise<void> {
    if (!this.articleToDelete) return;

    this.deletingArticle = this.articleToDelete.id;

    try {
      const token = await this.auth.getAccessTokenSilently().toPromise();
      if (!token) {
        this.errorMessage = 'Token di autenticazione mancante. Effettua il login.';
        this.isSubmitting = false;
        return;
      }

      const response = await fetch(`${this.deleteArticleUrl}/${this.articleToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Rimuovi l'articolo dalla lista locale
        this.savedArticles = this.savedArticles.filter(
          article => article.id !== this.articleToDelete.id
        );

        // Mostra messaggio di successo
        this.deleteSuccessMessage = true;
        this.deleteErrorMessage = '';

        // Chiudi il modal
        this.showDeleteModal = false;
        this.articleToDelete = null;

        // Nascondi il messaggio di successo dopo 3 secondi
        setTimeout(() => {
          this.deleteSuccessMessage = false;
        }, 3000);

        console.log('Articolo eliminato con successo');
      } else {
        throw new Error(result.error || 'Errore durante l\'eliminazione dell\'articolo');
      }
    } catch (error) {
      console.error('Errore durante l\'eliminazione:', error);
      this.deleteErrorMessage = error instanceof Error ? error.message : 'Errore sconosciuto durante l\'eliminazione';
      this.deleteSuccessMessage = false;

      // Nascondi il messaggio di errore dopo 5 secondi
      setTimeout(() => {
        this.deleteErrorMessage = '';
      }, 5000);
    } finally {
      this.deletingArticle = null;
    }
  }

  toggleArticleExpansion(article: SavedArticle): void {
    article.expanded = !article.expanded;
  }




  private handleSuccess(): void {
    this.showSuccessMessage = true;
    this.addToAddedNewsList();
    this.resetForm();
    this.isSubmitting = false;

    // Reload articles if we're in manage tab
    if (this.activeTab === 'manage') {
      setTimeout(() => {
        this.loadMyArticles();
      }, 1000);
    }

    // Hide success message after 3 seconds
    setTimeout(() => {
      this.showSuccessMessage = false;
    }, 3000);
  }


  addToAddedNewsList(): void {
    const newsWithDate = {
      ...this.newsArticle,
      dataCreazione: new Date(),
      expanded: false
    };

    this.addedNews.unshift(newsWithDate);

    // Keep only last 5 news
    if (this.addedNews.length > 5) {
      this.addedNews = this.addedNews.slice(0, 5);
    }

    console.log('📰 Notizia aggiunta alla lista:', newsWithDate);
    console.log('📚 Lista completa notizie:', this.addedNews);
  }



  openArticleLink(link: string): void {
    if (link) {
      window.open(link, '_blank');
    }
  }

  // Format article date
  formatArticleDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  }



  // Add News Form Methods
  onInputChange(): void {
    // Reset error messages when user starts typing
    if (this.errorMessage) {
      this.errorMessage = '';
    }
  }

  getTitoloLength(): number {
    return this.newsArticle.titolo?.length || 0;
  }

  getContenutoLength(): number {
    return this.newsArticle.contenuto?.length || 0;
  }

  isFormValid(): boolean {
    return !!(this.newsArticle.titolo?.trim() && this.newsArticle.contenuto?.trim());
  }

  resetForm(): void {
    this.newsArticle = {
      titolo: '',
      paragrafo: '',
      contenuto: ''
    };
    this.clearMessages();
  }

  async onSubmit(): Promise<void> {
    if (!this.isFormValid()) {
      this.errorMessage = 'Compila tutti i campi obbligatori';
      return;
    }

    this.isSubmitting = true;
    this.clearMessages();

    const token = await this.auth.getAccessTokenSilently().toPromise();
    if (!token) {
      this.errorMessage = 'Token di autenticazione mancante. Effettua il login.';
      this.isSubmitting = false;
      return;
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Prepare the news data
    const newsData = {
      titolo: this.newsArticle.titolo.trim(),
      paragrafo: this.newsArticle.paragrafo?.trim() || '',
      contenuto: this.newsArticle.contenuto.trim()
    };

    this.http.post<{success: boolean, message: string}>(this.addNewsUrl, newsData, { headers }).subscribe({
      next: (response) => {
        console.log('✅ Notizia aggiunta con successo:', response);

        if (response.success) {
          // Show success message
          this.showSuccessMessage = true;

          // Add to recent news list
          this.addedNews.unshift({
            ...this.newsArticle,
            dataCreazione: new Date()
          });

          // Reset form
          this.resetForm();

          // Hide success message after 5 seconds
          setTimeout(() => {
            this.showSuccessMessage = false;
          }, 5000);

        } else {
          this.errorMessage = response.message || 'Errore durante il salvataggio della notizia';
        }

        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('❌ Errore nell\'aggiunta della notizia:', error);

        if (error.status === 401) {
          this.errorMessage = 'Sessione scaduta. Effettua nuovamente il login.';
          // Optionally redirect to login
          // this.router.navigate(['/login']);
        } else if (error.status === 403) {
          this.errorMessage = 'Non hai i permessi per aggiungere notizie.';
        } else if (error.status === 400) {
          this.errorMessage = 'Dati non validi: ' + (error.error?.message || 'Controlla i campi inseriti');
        } else {
          this.errorMessage = 'Errore durante il salvataggio: ' + (error.error?.message || error.message || 'Errore sconosciuto');
        }

        this.isSubmitting = false;
      }
    });
  }

  // Recent News Management
  toggleAddedNews(): void {
    this.showAddedNews = !this.showAddedNews;
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Navigation
  goToHome(): void {
    this.router.navigate(['/']);
  }



  async startEditing(article: any): Promise<void> {
    // Prima carica il contenuto completo dal blob se disponibile
    await this.loadArticleContentFromBlob(article);

    // Poi avvia la modalità modifica
    article.editing = true;
    article.originalData = { ...article }; // Backup per il cancel
  }

  /**
   * Carica il contenuto dell'articolo dal blob storage
   */
  async loadArticleContentFromBlob(article: any): Promise<void> {
    if (!article.link || !article.link.includes("blob.core.windows.net") || !article.link.endsWith(".txt")) {
      return;
    }

    try {
      const response = await fetch(article.link);
      if (!response.ok) {
        throw new Error(`Errore HTTP ${response.status}`);
      }

      const text = await response.text();

      // Parsing formato Title/Subtitle/Text
      const titleMatch = text.match(/Title:\s*(.+?)(?:\n|$)/);
      const subtitleMatch = text.match(/Subtitle:\s*(.+?)(?:\n|$)/);


      // Aggiorna l'articolo con il contenuto completo dal blob
      if (titleMatch) {
        article.titolo = titleMatch[1].trim();
      }
      if (subtitleMatch) {
        article.sottotitolo = subtitleMatch[1].trim();
      }
      if (text) {
        article.contenuto = text;
      }

    } catch (error) {
      console.error("Errore nel caricamento dal blob:", error);
      // In caso di errore, usa il contenuto esistente
    }
  }


  openArticleContent(article: any): void {
    const link = article.link;

    if (link && link.includes("blob.core.windows.net") && link.endsWith(".txt")) {
      fetch(link)
        .then(res => {
          if (!res.ok) throw new Error("Errore HTTP " + res.status);
          return res.text();
        })
        .then(text => {
          // Parsing formato Title/Subtitle/Text
          const titleMatch = text.match(/Title:\s*(.+?)(?:\n|$)/);
          const subtitleMatch = text.match(/Subtitle:\s*(.+?)(?:\n|$)/);
          const textMatch = text.match(/Text:\s*([\s\S]+)/);

          const articleContent = {
            title: titleMatch ? titleMatch[1].trim() : article.titolo || "Articolo",
            subtitle: subtitleMatch ? subtitleMatch[1].trim() : article.sottotitolo || "",
            text: textMatch ? textMatch[1].trim() : article.contenuto || text
          };

          // Crea una nuova finestra/tab per mostrare l'articolo
          this.displayArticleInNewWindow(articleContent);
        })
        .catch(err => {
          console.error("Errore nel caricamento dal blob:", err);
          alert("Impossibile caricare l'articolo dal blob.");
        });
    } else if (link) {
      // Se non è un blob, apri il link direttamente
      window.open(link, '_blank');
    } else {
      // Se non c'è link, mostra il contenuto locale
      const articleContent = {
        title: article.titolo || "Articolo",
        subtitle: article.sottotitolo || "",
        text: article.contenuto || "Contenuto non disponibile"
      };
      this.displayArticleInNewWindow(articleContent);
    }
  }

  /**
   * Mostra l'articolo in una nuova finestra
   */
  private displayArticleInNewWindow(articleContent: any): void {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${articleContent.title}</title>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 800px;
              margin: 40px auto;
              padding: 20px;
              line-height: 1.6;
              color: #333;
            }
            h1 {
              color: #2c3e50;
              border-bottom: 3px solid #667eea;
              padding-bottom: 10px;
            }
            h2 {
              color: #666;
              font-style: italic;
              margin-bottom: 20px;
            }
            .content {
              white-space: pre-line;
              text-align: justify;
            }
          </style>
        </head>
        <body>
          <h1>${articleContent.title}</h1>
          ${articleContent.subtitle ? `<h2>${articleContent.subtitle}</h2>` : ''}
          <div class="content">${articleContent.text}</div>
        </body>
        </html>
      `);
      newWindow.document.close();
    }
  }

  /**
   * Scarica l'articolo come file di testo
   */
  async downloadArticle(article: any): Promise<void> {
    this.downloadingArticle = article.id;
    this.downloadSuccessMessage = false;
    this.downloadErrorMessage = '';

    try {
      let contentToDownload = '';

      // Se l'articolo ha un link blob, scarica il contenuto completo
      if (article.link && article.link.includes("blob.core.windows.net") && article.link.endsWith(".txt")) {
        try {
          const response = await fetch(article.link);
          if (response.ok) {
            contentToDownload = await response.text();
          } else {
            throw new Error(`Errore HTTP ${response.status}`);
          }
        } catch (blobError) {
          console.warn("Errore nel caricamento dal blob, uso contenuto locale:", blobError);
          // Fallback al contenuto locale
          contentToDownload = this.formatArticleForDownload(article);
        }
      } else {
        // Usa il contenuto locale
        contentToDownload = this.formatArticleForDownload(article);
      }

      // Crea il file e avvia il download
      const blob = new Blob([contentToDownload], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      // Nome file sicuro
      const fileName = this.sanitizeFileName(article.titolo || 'articolo') + '.txt';

      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Mostra messaggio di successo
      this.downloadSuccessMessage = true;
      setTimeout(() => {
        this.downloadSuccessMessage = false;
      }, 3000);

    } catch (error) {
      console.error('Errore durante il download:', error);
      this.downloadErrorMessage = error instanceof Error ? error.message : 'Errore sconosciuto durante il download';
      setTimeout(() => {
        this.downloadErrorMessage = '';
      }, 5000);
    } finally {
      this.downloadingArticle = null;
    }
  }

  /**
   * Formatta l'articolo per il download usando il contenuto locale
   */
  private formatArticleForDownload(article: any): string {
    let content = '';

    if (article.titolo) {
      content += `Title: ${article.titolo}\n\n`;
    }

    if (article.sottotitolo) {
      content += `Subtitle: ${article.sottotitolo}\n\n`;
    }

    if (article.contenuto) {
      content += `Text: ${article.contenuto}`;
    }

    return content || 'Contenuto non disponibile';
  }

  /**
   * Sanifica il nome del file per il download
   */
  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[<>:"/\\|?*]/g, '') // Rimuove caratteri non validi per i nomi file
      .replace(/\s+/g, '_') // Sostituisce spazi con underscore
      .substring(0, 100); // Limita la lunghezza
  }

  async saveArticle(article: any): Promise<void> {
    if (!this.isArticleValid(article)) {
      return;
    }

    this.updatingArticle = true;
    this.updateSuccessMessage = false;
    this.updateErrorMessage = '';

    try {
      const token = await this.auth.getAccessTokenSilently().toPromise();
      if (!token) {
        this.errorMessage = 'Token di autenticazione mancante. Effettua il login.';
        this.isSubmitting = false;
        return;
      }

      // Prepara i dati per l'aggiornamento
      const updateData = {
        titolo: article.titolo?.trim(),
        sottotitolo: article.sottotitolo?.trim() || null,
        contenuto: article.contenuto?.trim(),
        link: article.link // Mantieni il link esistente inizialmente
      };

      // Se l'articolo ha un blob, aggiorna il contenuto del blob
      if (article.link && article.link.includes("blob.core.windows.net") && article.link.endsWith(".txt")) {
        try {
          const updatedBlobUrl = await this.updateBlobContent(article, token);
          if (updatedBlobUrl) {
            updateData.link = updatedBlobUrl;
          }
        } catch (blobError) {
          console.warn('Errore nell\'aggiornamento del blob, continuo con l\'aggiornamento del database:', blobError);
          // Continua comunque con l'aggiornamento del database anche se il blob fallisce
        }
      }

      // Aggiorna l'articolo nel database
      const response = await fetch(`${this.updateArticleUrl}/${article.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Aggiorna l'articolo nella lista locale
        const index = this.savedArticles.findIndex(a => a.id === article.id);
        if (index !== -1) {
          this.savedArticles[index] = {
            ...this.savedArticles[index],
            ...updateData,
            editing: false
          };
          delete this.savedArticles[index];
        }

        this.updateSuccessMessage = true;
        setTimeout(() => {
          this.updateSuccessMessage = false;
        }, 3000);

        console.log('Articolo aggiornato con successo');
      } else {
        throw new Error(result.error || 'Errore durante l\'aggiornamento dell\'articolo');
      }
    } catch (error) {
      console.error('Errore durante l\'aggiornamento:', error);
      this.updateErrorMessage = error instanceof Error ? error.message : 'Errore sconosciuto durante l\'aggiornamento';
      setTimeout(() => {
        this.updateErrorMessage = '';
      }, 5000);
    } finally {
      this.updatingArticle = false;
    }
  }

  /**
   * Aggiorna il contenuto del blob con i nuovi dati dell'articolo
   */
  private async updateBlobContent(article: any, token:string): Promise<string | null> {
    try {
      // Prepara il contenuto nel formato corretto per il blob
      let blobContent = '';

      if (article.titolo) {
        blobContent += `Title: ${article.titolo}\n`;
      }

      if (article.sottotitolo) {
        blobContent += `Subtitle: ${article.sottotitolo}\n`;
      }

      if (article.contenuto) {
        blobContent += `Text: ${article.contenuto}`;
      }

      // Chiamata API per aggiornare il blob
      const response = await fetch(`${this.updateBlob}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          article_id: article.id,
          blob_url: article.link,
          content: blobContent
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return result.blob_url || article.link; // Ritorna il nuovo URL o quello esistente
      } else {
        throw new Error(result.error || 'Errore durante l\'aggiornamento del blob');
      }
    } catch (error) {
      console.error('Errore nell\'aggiornamento del blob:', error);
      throw error; // Rilancia l'errore per essere gestito dal chiamante
    }
  }

  /**
   * Annulla le modifiche e ripristina i dati originali
   */
  cancelEditing(article: any): void {
    if (article.originalData) {
      // Ripristina i dati originali
      Object.assign(article, article.originalData);
      delete article.originalData;
    }
    article.editing = false;
  }

  /**
   * Verifica se l'articolo è valido per il salvataggio
   */
  isArticleValid(article: any): boolean {
    return article.titolo && article.titolo.trim().length > 0;
  }




}
