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
  private apiUrl = 'http://localhost:8080/api/v1/search';
  private baseUrl='http://localhost:8080/api/v1';
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

  constructor(private http: HttpClient, private router: Router, public auth: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object) {}

  goToAddNews(): void{
    this.router.navigate(['/addNews']);
  }



  async searchArticles(): Promise<void> {
  if (!this.searchTerm.trim()) return;
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
    this.resetSaveState();
    const selected = this.getSelectedArticles();

    if (selected.length === 0) {
      alert('Seleziona almeno un articolo');
      return;
    }

    const selectedUrls = selected.map(a => a.link);
    this.isGenerating = true;
    const token = await this.auth.getAccessTokenSilently().toPromise();

    fetch('http://localhost:8080/genArticle', {
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

      let parsedArticle = this.parseArticleContent(data.article);

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
  }


  private parseArticleContent(articleString: string): { title: string; subtitle: string; text: string } {
    if (!articleString) {
      return { title: '', subtitle: '', text: '' };
    }


    const titleMatch = articleString.match(/Title:\s*(.+?)(?:\n|$)/);
    const subtitleMatch = articleString.match(/Subtitle:\s*(.+?)(?:\n|$)/);
    const textMatch = articleString.match(/Text:\s*(.+)/s);

    return {
      title: titleMatch ? titleMatch[1].trim() : '',
      subtitle: subtitleMatch ? subtitleMatch[1].trim() : '',
      text: textMatch ? textMatch[1].trim() : ''
    };
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
  openArticle(link: string): void {
    if (link.includes("blob.core.windows.net") && link.endsWith(".txt")) {
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

          this.savedArticle = {
            title: titleMatch ? titleMatch[1].trim() : "Articolo salvato",
            subtitle: subtitleMatch ? subtitleMatch[1].trim() : "",
            text: textMatch ? textMatch[1].trim() : text
          };

          // Chiudo risultati e mostro solo l'articolo salvato
          this.showSavedArticle = true;
          this.showGeneratedArticle = false;
          this.searchResults = [];
        })
        .catch(err => {
          console.error("Errore nel caricamento dal blob:", err);
          alert("Impossibile caricare l'articolo dal blob.");
        });
    } else {
      window.open(link, '_blank');
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


   /**
   * Salva l'articolo generato nel database utilizzando l'endpoint /addNews
   */
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
        return;
      }


      // Prepara il contenuto nel formato per il blob (Title/Subtitle/Text)
      const cleanTitle = this.generatedArticle.title.trim();
      const cleanSubtitle = this.generatedArticle.subtitle?.trim() || '';
      const cleanText = this.stripHtmlTags(this.generatedArticle.text);

      // Costruisce il contenuto formattato per il blob
      let blobContent = `Title: ${cleanTitle}\n`;
      if (cleanSubtitle) {
        blobContent += `Subtitle: ${cleanSubtitle}\n`;
      }
      blobContent += `Text: ${cleanText}`;

      // Prepara i dati dell'articolo per l'API /addNews
      const articleData = {
        titolo: cleanTitle,
        paragrafo: cleanSubtitle || null, // Usa sottotitolo come paragrafo
        contenuto: blobContent // Contenuto formattato per il blob
      };

      const response = await fetch(`${this.baseUrl}/addNews`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(articleData)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Salvataggio riuscito
        this.articleSaved = true;
        this.saveSuccessMessage = true;


        // Nascondi il messaggio di successo dopo 4 secondi
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

      // Nascondi il messaggio di errore dopo 6 secondi
      setTimeout(() => {
        this.saveErrorMessage = '';
      }, 6000);

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