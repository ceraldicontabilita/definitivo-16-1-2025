"""
Dizionario Codici Tributo F24.
Fonte: Agenzia delle Entrate + INPS + Ricerca web 2025

LOGICA F24:
- Colonna DEBITO = VERSAMENTO (pagamento)
- Colonna CREDITO = COMPENSAZIONE
- Saldo + = DEBITO da versare
- Saldo - = CREDITO che riduce il totale
"""

CODICI_TRIBUTO_F24 = {
    # ========== ERARIO - IRPEF ==========
    "1001": {
        "sezione": "erario",
        "descrizione": "Ritenute su retribuzioni, pensioni, trasferte, mensilità aggiuntive",
        "tipo": "misto",  # può essere debito o credito
        "codice": "1001"
    },
    "1627": {
        "sezione": "erario",
        "descrizione": "Ritenute su redditi lavoro autonomo, provvigioni, redditi diversi",
        "tipo": "misto",
        "codice": "1627"
    },
    "1631": {
        "sezione": "erario",
        "descrizione": "Credito d'imposta per ritenute IRPEF",
        "tipo": "credito",
        "codice": "1631"
    },
    "1704": {
        "sezione": "erario",
        "descrizione": "Credito IVA utilizzato in compensazione / Ritenute su redditi di capitale",
        "tipo": "misto",
        "codice": "1704"
    },
    
    # ========== ERARIO - IVA ==========
    "6001": {
        "sezione": "erario",
        "descrizione": "IVA - Versamento mensile Gennaio",
        "tipo": "debito",
        "codice": "6001",
        "periodo": "01"
    },
    "6002": {
        "sezione": "erario",
        "descrizione": "IVA - Versamento mensile Febbraio",
        "tipo": "debito",
        "codice": "6002",
        "periodo": "02"
    },
    "6003": {
        "sezione": "erario",
        "descrizione": "IVA - Versamento mensile Marzo",
        "tipo": "debito",
        "codice": "6003",
        "periodo": "03"
    },
    "6004": {
        "sezione": "erario",
        "descrizione": "IVA - Versamento mensile Aprile",
        "tipo": "debito",
        "codice": "6004",
        "periodo": "04"
    },
    "6005": {
        "sezione": "erario",
        "descrizione": "IVA - Versamento mensile Maggio",
        "tipo": "debito",
        "codice": "6005",
        "periodo": "05"
    },
    "6006": {
        "sezione": "erario",
        "descrizione": "IVA - Versamento mensile Giugno",
        "tipo": "debito",
        "codice": "6006",
        "periodo": "06"
    },
    "6007": {
        "sezione": "erario",
        "descrizione": "IVA - Versamento mensile Luglio",
        "tipo": "debito",
        "codice": "6007",
        "periodo": "07"
    },
    "6008": {
        "sezione": "erario",
        "descrizione": "IVA - Versamento mensile Agosto",
        "tipo": "debito",
        "codice": "6008",
        "periodo": "08"
    },
    "6009": {
        "sezione": "erario",
        "descrizione": "IVA - Versamento mensile Settembre",
        "tipo": "debito",
        "codice": "6009",
        "periodo": "09"
    },
    "6010": {
        "sezione": "erario",
        "descrizione": "IVA - Versamento mensile Ottobre",
        "tipo": "debito",
        "codice": "6010",
        "periodo": "10"
    },
    "6011": {
        "sezione": "erario",
        "descrizione": "IVA - Versamento mensile Novembre",
        "tipo": "debito",
        "codice": "6011",
        "periodo": "11"
    },
    "6012": {
        "sezione": "erario",
        "descrizione": "IVA - Versamento mensile Dicembre",
        "tipo": "debito",
        "codice": "6012",
        "periodo": "12"
    },
    "6099": {
        "sezione": "erario",
        "descrizione": "IVA - Versamento annuale",
        "tipo": "debito",
        "codice": "6099"
    },
    
    # ========== INPS ==========
    "5100": {
        "sezione": "inps",
        "descrizione": "Contributi previdenziali INPS lavoratori dipendenti",
        "tipo": "debito",
        "codice": "5100",
        "causali": ["DM10", "CXX", "M100"]
    },
    "5101": {
        "sezione": "inps",
        "descrizione": "Contributi previdenziali INPS gestione separata",
        "tipo": "debito",
        "codice": "5101"
    },
    
    # ========== REGIONI - Addizionale Regionale IRPEF ==========
    "3802": {
        "sezione": "regioni",
        "descrizione": "Addizionale regionale IRPEF - sostituti d'imposta",
        "tipo": "debito",
        "codice": "3802"
    },
    "3796": {
        "sezione": "regioni",
        "descrizione": "Addizionale regionale IRPEF rimborsata",
        "tipo": "credito",
        "codice": "3796"
    },
    
    # ========== IMU/COMUNI - Addizionale Comunale IRPEF ==========
    "3847": {
        "sezione": "imu",
        "descrizione": "Addizionale comunale IRPEF - acconto",
        "tipo": "debito",
        "codice": "3847"
    },
    "3848": {
        "sezione": "imu",
        "descrizione": "Addizionale comunale IRPEF - saldo",
        "tipo": "debito",
        "codice": "3848"
    },
    "3797": {
        "sezione": "imu",
        "descrizione": "Addizionale comunale IRPEF rimborsata",
        "tipo": "credito",
        "codice": "3797"
    },
    
    # ========== IMU - Imposta Municipale ==========
    "3912": {
        "sezione": "imu",
        "descrizione": "IMU - Abitazione principale e pertinenze",
        "tipo": "debito",
        "codice": "3912"
    },
    "3913": {
        "sezione": "imu",
        "descrizione": "IMU - Fabbricati rurali strumentali - Comune",
        "tipo": "debito",
        "codice": "3913"
    },
    "3914": {
        "sezione": "imu",
        "descrizione": "IMU - Terreni - Comune",
        "tipo": "debito",
        "codice": "3914"
    },
    "3916": {
        "sezione": "imu",
        "descrizione": "IMU - Aree fabbricabili - Comune",
        "tipo": "debito",
        "codice": "3916"
    },
    "3918": {
        "sezione": "imu",
        "descrizione": "IMU - Altri fabbricati - Comune",
        "tipo": "debito",
        "codice": "3918"
    }
}

# Sezioni F24
SEZIONI_F24 = {
    "erario": "Erario",
    "inps": "INPS",
    "regioni": "Regioni",
    "imu": "IMU e altri tributi locali",
    "altri_enti": "Altri enti previdenziali"
}

# Scadenze F24 standard
SCADENZE_F24 = {
    "iva_mensile": 16,  # giorno del mese successivo
    "ritenute": 16,     # giorno del mese successivo
    "inps": 16,         # giorno del mese successivo
    "imu_acconto": "16/06",
    "imu_saldo": "16/12"
}


def get_codice_info(codice: str) -> dict:
    """Restituisce info su un codice tributo."""
    return CODICI_TRIBUTO_F24.get(codice, {
        "sezione": "sconosciuta",
        "descrizione": f"Codice tributo {codice} - non presente in archivio",
        "tipo": "misto",
        "codice": codice
    })


def get_codici_per_sezione(sezione: str) -> list:
    """Restituisce tutti i codici di una sezione."""
    return [
        {"codice": k, **v}
        for k, v in CODICI_TRIBUTO_F24.items()
        if v.get("sezione") == sezione
    ]
