FROM python:3.10-slim

# Crea la cartella app
WORKDIR /app

# Copia requirements
COPY requirements.txt .

# Installa dipendenze
RUN pip install --no-cache-dir -r requirements.txt

# Copia il codice
COPY . .

# Comando di avvio con gunicorn
CMD ["gunicorn", "-b", "0.0.0.0:5000", "backend:app"]