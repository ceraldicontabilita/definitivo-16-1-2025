"""
Costanti HACCP per il sistema ERP.
Definisce operatori autorizzati, limiti temperature e info azienda.
"""

# Operatori autorizzati per registrazioni HACCP
OPERATORI_HACCP = ["VALERIO", "VINCENZO", "POCCI"]

# Range temperature frigoriferi (in Celsius)
TEMP_FRIGO_MIN = 2
TEMP_FRIGO_MAX = 5

# Range temperature congelatori (in Celsius)
TEMP_CONGELATORI_MIN = -25
TEMP_CONGELATORI_MAX = -15

# Info azienda per footer documenti
AZIENDA_INFO = {
    "ragione_sociale": "Ceraldi Group SRL",
    "indirizzo": "Piazza Carità 14 - 80134 Napoli (NA)",
    "piva": "04523831214",
    "telefono": "+393937415426",
    "email": "ceraldigroupsrl@gmail.com",
    "footer_text": "Documento conforme al Regolamento (CE) N. 852/2004 sull'igiene dei prodotti alimentari"
}

# Limiti alert temperature
ALERT_TEMP_FRIGO = {
    "warning_min": 1,
    "warning_max": 6,
    "critical_min": 0,
    "critical_max": 8
}

ALERT_TEMP_CONGELATORI = {
    "warning_min": -26,
    "warning_max": -14,
    "critical_min": -30,
    "critical_max": -10
}
