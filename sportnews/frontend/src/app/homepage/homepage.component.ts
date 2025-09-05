import { Component, OnInit ,Inject, PLATFORM_ID} from '@angular/core';
import { HttpClient, HttpHeaders} from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';

interface ArticleResult {
  data: string;
  link: string;
  sottotitolo: string;
  titolo: string;
  selected?: boolean;
}

interface SearchResponse {
  results: ArticleResult[];
  success: boolean;
}

@Component({
  selector: 'app-homepage',
  standalone: false,
  templateUrl: './homepage.component.html',
  styleUrls: ['./homepage.component.css']
})
export class HomepageComponent implements OnInit {
  private apiUrl = 'https://sport.event-fit.it/api/v1/search';
  //private baseUrl='https://sport.event-fit.it/api/v1';
  private baseUrl='/api/v1';
  searchTerm: string = '';

  ngOnInit() {
    console.log('Component initialized, searchTerm:', this.searchTerm);
  }

  savedArticle: { title: string; subtitle: string; text: string } | null = null;
  showSavedArticle: boolean = false;

  searchResults: ArticleResult[] = [];
  isLoading: boolean = false;
  selectAll: boolean = false;

  showGeneratedArticle: boolean = false;
  isGenerating: boolean = false;

  isSavingArticle: boolean = false;
  articleSaved: boolean = false;
  saveSuccessMessage: boolean = false;
  saveErrorMessage: string = '';

  selectedLanguage: string = 'en'; // default Inglese

  constructor(private http: HttpClient, private router: Router, public auth: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object) {}

  goToAddNews(): void{
    this.router.navigate(['/addNews']);
  }


  async searchArticles(): Promise<void> {
    if (!this.searchTerm.trim()) return;

    try{
      const token = await this.auth.getAccessTokenSilently().toPromise();
      const headers = new HttpHeaders({
        Authorization: `Bearer ${token}`
      });

      this.isLoading = true;

      this.http.post<SearchResponse>(this.apiUrl, { query: this.searchTerm }, { headers })
        .subscribe({
          next: (response) => {
            this.searchResults = response.results.map(article => ({
              ...article,
              selected: false
            }));
            this.isLoading = false;
            this.selectAll = false;
          },
          error: (error) => {
            console.error('Errore nella ricerca:', error);
            this.isLoading = false;

          }
        });

    }catch(err){
      alert('⚠️ Devi fare login per continuare');
      this.auth.loginWithRedirect();
    }
  }



  toggleSelectAll(): void {
    this.searchResults.forEach(article => {
      article.selected = this.selectAll;
    });
  }

  toggleArticleSelection(index: number): void {
    this.searchResults[index].selected = !this.searchResults[index].selected;
    this.updateSelectAllState();
  }

  private updateSelectAllState(): void {
    const selectedCount = this.searchResults.filter(article => article.selected).length;
    this.selectAll = selectedCount === this.searchResults.length && this.searchResults.length > 0;
  }


  getSelectedArticles(): ArticleResult[] {
    return this.searchResults.filter(article => article.selected);
  }

  generatedArticle: { title: string; subtitle: string; text: string } | null = null;

  async processSelectedArticles(): Promise<void> {
    try {
      this.resetSaveState();
      const selected = this.getSelectedArticles();

      if (selected.length === 0) {
        alert('Seleziona almeno un articolo');
        return;
      }

      const selectedUrls = selected.map(a => a.link);
      this.isGenerating = true;
      const token = await this.auth.getAccessTokenSilently().toPromise();

      fetch('https://sport.event-fit.it/api/v1/genArticle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ urls: selectedUrls })
      })
        .then(res => res.json())
        .then(data => {
          console.log("Articolo generato:", data);

          const parsedArticle = this.parseArticleContent(data.article);

          this.generatedArticle = {
            title: parsedArticle.title || 'Titolo non disponibile',
            subtitle: parsedArticle.subtitle || '',
            text: parsedArticle.text || ''
          };

          this.showGeneratedArticle = true;
          this.isGenerating = false;
        })
        .catch(err => {
          console.error("Errore nella generazione dell'articolo:", err);
          this.isGenerating = false;
          alert('Errore nella generazione dell\'articolo. Riprova.');
        });
    } catch (err) {
      alert('⚠️ Devi fare login per continuare');
      this.auth.loginWithRedirect();
    }
  }


  parseArticleContent(articleText: string): { title: string; subtitle: string; text: string } {
    const titleMatch = articleText.match(/(?:Titolo|Title):\s*([\s\S]*?)(?=\n(?:Sottotitolo|Subtitle):|$)/);
    const subtitleMatch = articleText.match(/(?:Sottotitolo|Subtitle):\s*([\s\S]*?)(?=\n(?:Testo|Text):|$)/);
    const textMatch = articleText.match(/(?:Testo|Text):\s*([\s\S]*)/);

    return {
      title: titleMatch ? titleMatch[1].trim() : '',
      subtitle: subtitleMatch ? subtitleMatch[1].trim() : '',
      text: textMatch ? textMatch[1].trim() : ''
    };
  }

  async translateGeneratedArticle(targetLanguage: string): Promise<void> {
    if (!this.generatedArticle) {
      alert('⚠️ Prima devi generare un articolo.');
      return;
    }

    try {
      this.isGenerating = true;
      const token = await this.auth.getAccessTokenSilently().toPromise();

      const fullText = `
        Titolo: ${this.generatedArticle.title}
        Sottotitolo: ${this.generatedArticle.subtitle}
        Testo: ${this.generatedArticle.text}
      `;

      const response = await fetch('https://sport.event-fit.it/api/v1/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          text: fullText,
          language: targetLanguage
        })
      });


      const data = await response.json();

      if (!data.article) {
        throw new Error("⚠️ Nessun testo tradotto ricevuto dall'API");
      }


      const parsedArticle = this.parseArticleContent(data.article);



      this.generatedArticle = {
        title: parsedArticle.title || 'Titolo non disponibile',
        subtitle: parsedArticle.subtitle || '',
        text: parsedArticle.text || ''
      };

      this.isGenerating = false;
    } catch (err) {
      console.error("Errore nella traduzione:", err);
      this.isGenerating = false;
      alert("Errore nella traduzione del testo. Riprova.");
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  openArticle(article: any): void {
    const link = article.link;

    if (link && link.includes('blob.core.windows.net') && link.endsWith('.txt')) {
      fetch(link)
        .then(res => {
          if (!res.ok) throw new Error('Errore HTTP ' + res.status);
          return res.text();
        })
        .then(text => {
          const titleMatch = text.match(/Title:\s*([\s\S]*?)(?=\nSubtitle:|\nText:|$)/);
          const subtitleMatch = text.match(/Subtitle:\s*([\s\S]*?)(?=\nText:|$)/);
          const textMatch = text.match(/Text:\s*([\s\S]*)/);

          const articleContent = {
            title: titleMatch ? titleMatch[1].trim() : article.titolo || 'Articolo',
            subtitle: subtitleMatch ? subtitleMatch[1].trim() : article.sottotitolo || '',
            text: textMatch ? textMatch[1].trim() : article.contenuto || text
          };

          this.displayArticleInNewWindow(articleContent);
        })
        .catch(err => {
          console.error('Errore nel caricamento dal blob:', err);
        });
    } else if (link) {
      window.open(link, '_blank');
    } else {
      const articleContent = {
        title: article.titolo || 'Articolo',
        subtitle: article.sottotitolo || '',
        text: article.contenuto || 'Contenuto non disponibile'
      };
      this.displayArticleInNewWindow(articleContent);
    }
  }

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


  onInputChange(event: any): void {
    this.searchTerm = event.target.value;
    console.log('Input changed:', this.searchTerm);
  }

  testButton(): void {
    console.log('Button clicked, searchTerm:', this.searchTerm);
    alert(`Valore corrente: "${this.searchTerm}"`);
  }


   async saveGeneratedArticle(): Promise<void> {
    if (!this.generatedArticle || this.isSavingArticle || this.articleSaved) {
      return;
    }

    // Valida che l'articolo abbia almeno un titolo
    if (!this.generatedArticle.title || this.generatedArticle.title.trim().length === 0) {
      this.saveErrorMessage = 'L\'articolo deve avere almeno un titolo per essere salvato';
      setTimeout(() => this.saveErrorMessage = '', 5000);
      return;
    }

    this.isSavingArticle = true;
    this.saveSuccessMessage = false;
    this.saveErrorMessage = '';

    try {
      const token = await this.auth.getAccessTokenSilently().toPromise();
      if (!token) {
        throw new Error('Login required');
      }

      const cleanTitle = this.generatedArticle.title.trim();
      const cleanSubtitle = this.generatedArticle.subtitle?.trim() || '';
      const cleanText = this.stripHtmlTags(this.generatedArticle.text);


      let blobContent = `Title: ${cleanTitle}\n`;
      if (cleanSubtitle) {
        blobContent += `Subtitle: ${cleanSubtitle}\n`;
      }
      blobContent += `Text: ${cleanText}`;

      const articleData = {
        titolo: cleanTitle,
        paragrafo: cleanSubtitle || null,
        contenuto: blobContent
      };
      console.log(`${this.baseUrl}/save`)

      const response = await fetch(`${this.baseUrl}/save`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(articleData)
      });

      const result = await response.json();
      console.log(result)

      if (response.ok && result.success) {
        this.articleSaved = true;
        this.saveSuccessMessage = true;
        setTimeout(() => {
          this.saveSuccessMessage = false;
        }, 4000);

        console.log('Articolo generato salvato con successo:', result);
        console.log('URL Blob:', result.blob_url);


      } else {
        throw new Error(result.error || 'Errore durante il salvataggio dell\'articolo');
      }

    } catch (error) {
      console.error('Errore durante il salvataggio dell\'articolo generato:', error);
      this.saveErrorMessage = error instanceof Error ? error.message : 'Errore sconosciuto durante il salvataggio';

      setTimeout(() => {
        this.saveErrorMessage = '';
      }, 6000);
      alert('⚠️ Devi fare login per continuare');
      this.auth.loginWithRedirect();
    } finally {
      this.isSavingArticle = false;
    }
  }

  /**
   * Rimuove i tag HTML dal testo mantenendo solo il contenuto
   */
  private stripHtmlTags(html: string): string {
    if (!html) return '';

    // Crea un elemento temporaneo per estrarre solo il testo
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  }


  /**
   * Reset dello stato quando si torna alla ricerca
   */
  backToSearch(): void {
    // Reset dell'articolo generato
    this.showGeneratedArticle = false;
    this.showSavedArticle = false;
    this.generatedArticle = null;
    this.savedArticle = null;

    // Reset dello stato di salvataggio
    this.articleSaved = false;
    this.isSavingArticle = false;
    this.saveSuccessMessage = false;
    this.saveErrorMessage = '';

    // Mostra di nuovo i risultati della ricerca se esistono
    if (this.searchResults.length > 0) {
      // Mantieni i risultati della ricerca
    } else {
      // Se non ci sono risultati, potresti voler resettare anche il termine di ricerca
      // this.searchTerm = '';
    }
  }

  /**
   * Verifica se l'articolo corrente può essere salvato
   */
  canSaveArticle(): boolean {
    return !!(this.generatedArticle &&
              this.generatedArticle.title &&
              this.generatedArticle.title.trim().length > 0 &&
              !this.isSavingArticle &&
              !this.articleSaved);
  }

  /**
   * Metodo opzionale per salvare automaticamente gli articoli generati
   */
  enableAutoSave(): void {
    // Se vuoi implementare il salvataggio automatico,
    // puoi chiamare questo metodo dopo la generazione dell'articolo
    if (this.generatedArticle && !this.articleSaved) {
      // Attendi un po' prima del salvataggio automatico
      setTimeout(() => {
        if (this.generatedArticle && !this.articleSaved) {
          this.saveGeneratedArticle();
        }
      }, 2000);
    }
  }

  /**
   * Gestisce il reset quando si genera un nuovo articolo
   */
  private resetSaveState(): void {
    this.articleSaved = false;
    this.isSavingArticle = false;
    this.saveSuccessMessage = false;
    this.saveErrorMessage = '';
  }


}