#!/bin/bash
# Attendi qualche secondo se necessario (per il DB)
sleep 5

# Crea le tabelle SQLAlchemy
python -c "from backend import Base, engine; Base.metadata.create_all(engine)"

# Avvia l'app Flask
gunicorn -b 0.0.0.0:5000 backend:app