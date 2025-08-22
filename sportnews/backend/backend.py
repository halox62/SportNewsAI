import json
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
import feedparser
import requests
from newspaper import Article
import mysql.connector
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import Column, String, DateTime
from datetime import datetime
from sqlalchemy import create_engine, Column, String, DateTime, Text, func, Integer
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from datetime import datetime
from dateutil.parser import parse
from azure.storage.blob import BlobServiceClient
import os
from sqlalchemy import Boolean
from sqlalchemy.exc import IntegrityError
from functools import wraps
from flask import request, jsonify
from jose import jwt
import requests
import time
from functools import wraps


DB_FILE = "news.db"

app = Flask(__name__)

CORS(app, origins="https://sport.event-fit.it")

load_dotenv()

llm = ChatOpenAI(model="gpt-4.1-mini", temperature=0)

API_KEY=os.getenv("API_KEY")

DB_CONFIG = {
    "host": os.getenv("AZURE_DB_HOST"),
    "user": os.getenv("DBUSER"),
    "password": os.getenv("AZURE_DB_PASSWORD"),
    "database": os.getenv("DATABASE"),
    #"ssl_ca": "DigiCertGlobalRootCA.crt.pem"
}

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")  # es: "dev-crydqe7sub8m26h7.us.auth0.com"
API_AUDIENCE = os.getenv("API_AUDIENCE")  # es: "https://myapi/"
ALGORITHMS = ["RS256"]


AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
container_name = "articles"


Base = declarative_base()

# Configura la stringa di connessione SQLAlchemy per MySQL Azure
username = os.getenv("DBUSER")
password =os.getenv("AZURE_DB_PASSWORD")
host = os.getenv("AZURE_DB_HOST")
database = os.getenv("DATABASE")

connection_string = f"mysql+mysqlconnector://{username}:{password}@{host}/{database}"

# Crea engine e session
engine = create_engine(connection_string)
SessionLocal = sessionmaker(bind=engine)

def get_connection():
    return mysql.connector.connect(**DB_CONFIG)

class Articolo(Base):
    __tablename__ = 'articles'
    id = Column(Integer, primary_key=True, autoincrement=True)
    titolo = Column(String(200), nullable=False)
    paragrafo = Column(String(500))
    blob_url = Column(Text, nullable=False)
    idUser=Column(String(200), nullable=False)
    data = Column(DateTime, nullable=False, server_default=func.now())

class User(Base):
    __tablename__ = 'users'
    idUser = Column(Integer, primary_key=True, autoincrement=True)
    auth0Id = Column(String(100), unique=True, nullable=False)
    email = Column(String(200))


@app.route("/api/v1/register", methods=["POST"])
def register_user():
    try:
        data = request.get_json()
        auth0Id = data.get("auth0Id")
        name = data.get("name")
        email = data.get("email")

        print(data)

        if not auth0Id or not name or not email:
            return jsonify({"success": False, "error": "Dati mancanti"}), 400

        session = SessionLocal()
        # Verifica se l'utente esiste già
        existing_user = session.query(User).filter_by(auth0Id=auth0Id).first()
        if existing_user:
            session.close()
            return jsonify({"success": True, "message": "Utente già registrato"}), 200

        # Crea nuovo utente
        new_user = User(auth0Id=auth0Id, email=email)
        session.add(new_user)
        session.commit()
        session.close()

        return jsonify({"success": True, "message": "Utente registrato con successo"}), 201

    except IntegrityError as e:
        session.rollback()
        session.close()
        return jsonify({"success": False, "error": "Utente già esistente"}), 400
    except Exception as e:
        session.close()
        return jsonify({"success": False, "error": str(e)}), 500


def requires_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", None)
        if not auth_header:
            return jsonify({"message": "Authorization header missing"}), 401


        parts = auth_header.split()
        if parts[0].lower() != "bearer" or len(parts) != 2:
            return jsonify({"message": "Invalid authorization header"}), 401


        token = parts[1]



        try:
            jwks_url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
            jwks = requests.get(jwks_url).json()
            unverified_header = jwt.get_unverified_header(token)
            rsa_key = {}
            for key in jwks["keys"]:
                if key["kid"] == unverified_header["kid"]:
                    rsa_key = {
                        "kty": key["kty"],
                        "kid": key["kid"],
                        "use": key["use"],
                        "n": key["n"],
                        "e": key["e"]
                    }

            if rsa_key:
                payload = jwt.decode(
                    token,
                    rsa_key,
                    algorithms=ALGORITHMS,
                    audience=API_AUDIENCE,
                    issuer=f"https://{AUTH0_DOMAIN}/"
                )
            else:
                return jsonify({"message": "Unable to find appropriate key"}), 401

        except Exception as e:
            return jsonify({"message": "Token invalid: " + str(e)}), 401


        return f(*args, user_payload=payload, **kwargs)

    return decorated


def query_database_articles(keyword: str):
    session = SessionLocal()
    try:
        results = session.query(Articolo).filter(
            Articolo.titolo.ilike(f'%{keyword}%')
        ).all()
        return [
            {
                "titolo": art.titolo,
                "sottotitolo": art.paragrafo,
                "link": art.blob_url,
                "data": art.data.isoformat() if art.data else None
            } for art in results
        ]
    finally:
        session.close()

@app.route('/api/v1/search', methods=['POST'])
@requires_auth
def search_news(user_payload):
    try:
        data = request.get_json()
        keyword = data.get("query", "").strip()

        if not keyword:
            return jsonify({"success": False, "error": "Query mancante"}), 400

        results = []

        # --- NewsAPI ---
        '''try:
            url = 'https://newsapi.org/v2/everything'
            params = {
                'q': f'"{keyword}"',
                'language': 'it',
                'sources': 'ansa,it,la-gazzetta-dello-sport,it-sky-sport',
                'sortBy': 'publishedAt',
                'pageSize': 5,
                'apiKey': API_KEY
            }
            response = requests.get(url, params=params, timeout=5)
            response.raise_for_status()
            news_data = response.json()

            results.extend([
                {
                    "titolo": art.get("title"),
                    "sottotitolo": art.get("description"),
                    "link": art.get("url"),
                    "data": art.get("publishedAt")
                }
                for art in news_data.get('articles', [])
            ])
        except Exception as e:
            print(f"[WARN] Errore NewsAPI: {e}")'''
        try:
          prompt = f"""
          Sei un assistente che trova articoli di notizie italiane sul tema "{keyword}".
          Cerca le 5 notizie più rilevanti e recenti da fonti affidabili (es. ANSA, La Gazzetta dello Sport, Sky Sport).
          Rispondi SOLO in JSON con il formato:
          [
            {{
              "titolo": "...",
              "sottotitolo": "...",
              "link": "...",
              "data": "YYYY-MM-DD"
            }}
          ]
          """

          response = llm.invoke(prompt)
          content = response.choices[0].message.content.strip()

          results = json.loads(content)

          return results

        except Exception as e:
            print(f"[WARN] Errore OpenAI API: {e}")
            return []

        # --- Database ---
        try:
            results.extend(query_database_articles(keyword))
        except Exception as e:
            print(f"[WARN] Errore DB: {e}")

        results.sort(key=lambda x: x["data"] or "", reverse=True)

        return jsonify({"success": True, "results": results}), 200

    except Exception as e:
        print(f"[ERROR] {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/download_articles', methods=['POST'])
def download_articles(user_payload):
    try:
        data = request.get_json()
        urls = data.get("urls", [])
        results = []

        for url in urls:
            try:
                article = Article(url, language='it')
                article.download()
                article.parse()
                results.append({
                    "titolo": article.title,
                    "testo": article.text,
                    "autore": article.authors,
                    "data": article.publish_date.isoformat() if article.publish_date else None,
                    "link": url
                })
            except Exception as e:
                results.append({"errore": str(e), "link": url})

        return jsonify({"success": True, "results": results}), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500




def get_text_from_blob_url(blob_url):
    response = requests.get(blob_url)
    response.raise_for_status()
    return response.text

@app.route('/api/v1/genArticle', methods=['POST'])
@requires_auth
def genera_notizia_da_url(user_payload):
    data = request.get_json()
    urls = data.get("urls", [])

    if not urls:
        return jsonify({"error": "No URLs provided"}), 400

    combined_texts = []

    for url in urls:
        try:
            if url.startswith("https://articlesstorage.blob.core.windows.net"):
                text = get_text_from_blob_url(url)
            else:
                article = Article(url, language='it')
                article.download()
                article.parse()
                text = article.text

            combined_texts.append(text)
        except Exception as e:
            combined_texts.append(f"[Errore nel recupero dell'articolo da {url}: {str(e)}]")


    joined_text = "\n\n---\n\n".join(combined_texts)

    prompt = f"""
    Read the content of the following sports news articles:

    {joined_text}

    Using the information from all these sources, write a single coherent sports news article in the following format:

    Title: (max 80 characters)
    Subtitle: (max 120 characters)
    Text: A concise summary of all the key facts combined from the articles, no longer than 500 characters.

    The article must be factual, concise, and written in a neutral journalistic style. Avoid repetition and merge overlapping information.
    """

    response = llm.invoke(prompt)
    article = response.content.strip()

    return jsonify({"article": article})


@app.route("/api/v1/addNews", methods=["POST"])
@requires_auth
def add_news(user_payload):
    try:
        auth0_id = user_payload.get("sub")
        session = SessionLocal()
        user = session.query(User).filter_by(auth0Id=auth0_id).first()
        if not user:
            session.close()
            return jsonify({"success": False, "error": "Utente non registrato"}), 401

        data = request.get_json()
        titolo = data.get("titolo")
        paragrafo = data.get("paragrafo")
        contenuto = data.get("contenuto")

        if not titolo or not contenuto:
            session.close()
            return jsonify({"success": False, "error": "Titolo e contenuto sono obbligatori"}), 400

        filename = f"{int(time.time())}_{titolo[:30].replace(' ', '_')}.txt"
        blob_url = upload_article_to_blob(contenuto, filename)

        articolo = Articolo(
            titolo=titolo,
            paragrafo=paragrafo,
            blob_url=blob_url,
            idUser=str(user.idUser)
        )
        session.add(articolo)
        session.commit()
        session.close()

        return jsonify({"success": True, "message": "Articolo salvato con successo", "blob_url": blob_url}), 201

    except Exception as e:
        session.close()
        return jsonify({"success": False, "error": str(e)}), 500

def upload_article_to_blob(article_text: str, filename: str) -> str:
    container_client = blob_service_client.get_container_client(container_name)
    try:
        container_client.create_container()
    except Exception:
        pass

    blob_client = container_client.get_blob_client(filename)

    blob_client.upload_blob(article_text, overwrite=True)

    blob_url = blob_client.url
    return blob_url


@app.route("/api/v1/my-articles", methods=["GET"])
@requires_auth
def get_my_articles(user_payload):
    try:
        auth0_id = user_payload.get("sub")
        session = SessionLocal()
        user = session.query(User).filter_by(auth0Id=auth0_id).first()
        if not user:
            session.close()
            return jsonify({"success": False, "error": "Utente non trovato"}), 404

        articles = session.query(Articolo).filter_by(idUser=str(user.idUser)).all()
        results = [
            {
                "id": art.id,
                "titolo": art.titolo,
                "sottotitolo": art.paragrafo,
                "link": art.blob_url,
                "data": art.data.isoformat() if art.data else None
            }
            for art in articles
        ]
        session.close()
        return jsonify({"success": True, "results": results}), 200

    except Exception as e:
        session.close()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/v1/update-article/<int:article_id>", methods=["PUT"])
@requires_auth
def update_article(article_id, user_payload):
    try:
        # Ricava l'Auth0 ID dell'utente dal token
        auth0_id = user_payload.get("sub")
        session = SessionLocal()

        # Trova l'utente nel database
        user = session.query(User).filter_by(auth0Id=auth0_id).first()
        if not user:
            session.close()
            return jsonify({"success": False, "error": "Utente non trovato"}), 404

        # Trova l'articolo da modificare e verifica che appartenga all'utente
        articolo = session.query(Articolo).filter_by(id=article_id, idUser=str(user.idUser)).first()
        if not articolo:
            session.close()
            return jsonify({"success": False, "error": "Articolo non trovato o accesso negato"}), 404

        # Prende i dati dal body
        data = request.get_json()
        titolo = data.get("titolo")
        paragrafo = data.get("paragrafo")
        contenuto = data.get("contenuto")  # opzionale, se vuoi aggiornare il blob

        if titolo:
            articolo.titolo = titolo
        if paragrafo is not None:
            articolo.paragrafo = paragrafo

        # Se il contenuto cambia, aggiorna anche il blob
        if contenuto:
            import time
            filename = f"{int(time.time())}_{titolo[:30].replace(' ', '_')}.txt"
            blob_url = upload_article_to_blob(contenuto, filename)
            articolo.blob_url = blob_url

        session.commit()
        session.close()

        return jsonify({"success": True, "message": "Articolo aggiornato con successo"}), 200

    except Exception as e:
        session.close()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/v1/delete-article/<int:article_id>", methods=["DELETE"])
@requires_auth
def delete_article(article_id, user_payload):
    session = SessionLocal()
    try:
        auth0_id = user_payload.get("sub")
        user = session.query(User).filter_by(auth0Id=auth0_id).first()

        print(user)
        if not user:
            session.close()
            return jsonify({"success": False, "error": "Utente non trovato"}), 404

        articolo = session.query(Articolo).filter_by(id=article_id, idUser=str(user.idUser)).first()
        if not articolo:
            session.close()
            return jsonify({"success": False, "error": "Articolo non trovato o non appartiene all'utente"}), 404

        session.delete(articolo)
        session.commit()
        session.close()

        return jsonify({"success": True, "message": "Articolo eliminato con successo"}), 200

    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/v1/update-blob-content", methods=["POST"])
@requires_auth
def update_blob_content(user_payload):
    """
    Aggiorna il contenuto di un blob esistente e opzionalmente aggiorna
    i dati dell'articolo nel DB.
    """
    try:
        data = request.get_json()
        article_id = data.get("article_id")
        blob_url = data.get("blob_url")
        content = data.get("content")

        if not article_id or not blob_url or not content:
            return jsonify({"success": False, "error": "Dati mancanti"}), 400

        # Recupera l'utente dal token
        auth0_id = user_payload.get("sub")
        session: Session = SessionLocal()
        user = session.query(User).filter_by(auth0Id=auth0_id).first()
        if not user:
            session.close()
            return jsonify({"success": False, "error": "Utente non trovato"}), 404

        # Recupera l'articolo
        articolo = session.query(Articolo).filter_by(id=article_id, idUser=str(user.idUser)).first()
        if not articolo:
            session.close()
            return jsonify({"success": False, "error": "Articolo non trovato"}), 404

        # Aggiorna il contenuto del blob
        blob_client = blob_service_client.get_blob_client(container_name, blob_url.split("/")[-1])
        blob_client.upload_blob(content, overwrite=True)

        # Aggiorna eventualmente altri campi del DB (titolo, paragrafo, ecc.)
        # articolo.titolo = data.get("titolo", articolo.titolo)
        # articolo.paragrafo = data.get("sottotitolo", articolo.paragrafo)
        session.commit()
        session.close()

        return jsonify({"success": True, "message": "Blob aggiornato con successo", "blob_url": blob_url}), 200

    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    Base.metadata.create_all(engine)
    app.run(host = 'localhost', port = 8080, debug = True)




