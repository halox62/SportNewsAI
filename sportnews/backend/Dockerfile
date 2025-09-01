FROM python:3.10-slim

# Crea la cartella app
WORKDIR /app

# Copia requirements
COPY requirements.txt .

# Installa dipendenze
RUN pip install --no-cache-dir -r requirements.txt


# Copia il codice
COPY . .

# Script di avvio
COPY start.sh .
RUN chmod +x start.sh

CMD ["./start.sh"]