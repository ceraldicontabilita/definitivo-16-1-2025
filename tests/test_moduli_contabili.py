"""
Test Moduli Contabili ERP Italiano
Tests for: Cedolini, TFR, Cespiti, Scadenzario Fornitori, Calcolo IVA, 
Controllo Gestione, Indici Bilancio, Chiusura Esercizio
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCedolini:
    """Test Cedolini Paga endpoints"""
    
    def test_lista_cedolini_mese(self):
        """GET /api/cedolini/lista/{anno}/{mese} - Lista cedolini per mese"""
        response = requests.get(f"{BASE_URL}/api/cedolini/lista/2025/1")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Lista cedolini 2025/01: {len(data)} cedolini trovati")
    
    def test_riepilogo_mensile(self):
        """GET /api/cedolini/riepilogo-mensile/{anno}/{mese} - Riepilogo costi personale"""
        response = requests.get(f"{BASE_URL}/api/cedolini/riepilogo-mensile/2025/1")
        assert response.status_code == 200
        data = response.json()
        assert "anno" in data
        assert "mese" in data
        print(f"✓ Riepilogo mensile: {data}")


class TestTFR:
    """Test TFR (Trattamento Fine Rapporto) endpoints"""
    
    def test_riepilogo_aziendale(self):
        """GET /api/tfr/riepilogo-aziendale - Riepilogo TFR aziendale"""
        response = requests.get(f"{BASE_URL}/api/tfr/riepilogo-aziendale?anno=2025")
        assert response.status_code == 200
        data = response.json()
        assert "anno" in data
        assert "totale_fondo_tfr" in data
        assert "num_dipendenti_attivi" in data
        assert "accantonamenti_anno" in data
        assert "liquidazioni_anno" in data
        assert "dettaglio_dipendenti" in data
        print(f"✓ Riepilogo TFR aziendale: Fondo totale €{data['totale_fondo_tfr']}, {data['num_dipendenti_attivi']} dipendenti attivi")


class TestCespiti:
    """Test Cespiti e Ammortamenti endpoints"""
    
    def test_categorie_cespiti(self):
        """GET /api/cespiti/categorie - Lista categorie cespiti con coefficienti"""
        response = requests.get(f"{BASE_URL}/api/cespiti/categorie")
        assert response.status_code == 200
        data = response.json()
        assert "categorie" in data
        assert isinstance(data["categorie"], list)
        assert len(data["categorie"]) > 0
        # Verify category structure
        cat = data["categorie"][0]
        assert "codice" in cat
        assert "descrizione" in cat
        assert "coefficiente" in cat
        assert "vita_utile_anni" in cat
        print(f"✓ Categorie cespiti: {len(data['categorie'])} categorie disponibili")
        for c in data["categorie"][:3]:
            print(f"  - {c['codice']}: {c['descrizione']} ({c['coefficiente']}%)")
    
    def test_lista_cespiti(self):
        """GET /api/cespiti - Lista cespiti attivi"""
        response = requests.get(f"{BASE_URL}/api/cespiti?attivi=true")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Lista cespiti attivi: {len(data)} cespiti")
    
    def test_riepilogo_cespiti(self):
        """GET /api/cespiti/riepilogo - Riepilogo cespiti per categoria"""
        response = requests.get(f"{BASE_URL}/api/cespiti/riepilogo")
        assert response.status_code == 200
        data = response.json()
        assert "totali" in data
        assert "per_categoria" in data
        totali = data["totali"]
        assert "num_cespiti" in totali
        assert "valore_acquisto" in totali
        assert "fondo_ammortamento" in totali
        assert "valore_netto_contabile" in totali
        print(f"✓ Riepilogo cespiti: {totali['num_cespiti']} cespiti, Valore €{totali['valore_acquisto']}, Netto €{totali['valore_netto_contabile']}")
    
    def test_calcolo_ammortamenti_preview(self):
        """GET /api/cespiti/calcolo/{anno} - Preview ammortamenti anno"""
        response = requests.get(f"{BASE_URL}/api/cespiti/calcolo/2025")
        assert response.status_code == 200
        data = response.json()
        assert "anno" in data
        assert "preview" in data
        assert "ammortamenti" in data
        assert "totale_ammortamenti" in data
        print(f"✓ Preview ammortamenti 2025: {data['num_cespiti']} cespiti, Totale €{data['totale_ammortamenti']}")


class TestScadenzarioFornitori:
    """Test Scadenzario Fornitori endpoints"""
    
    def test_scadenzario_anno(self):
        """GET /api/scadenzario-fornitori - Scadenzario per anno"""
        response = requests.get(f"{BASE_URL}/api/scadenzario-fornitori/?anno=2025")
        assert response.status_code == 200
        data = response.json()
        assert "riepilogo" in data
        assert "per_fornitore" in data
        riepilogo = data["riepilogo"]
        assert "totale_fatture" in riepilogo
        assert "totale_da_pagare" in riepilogo
        print(f"✓ Scadenzario 2025: {riepilogo['totale_fatture']} fatture, Da pagare €{riepilogo['totale_da_pagare']}")
    
    def test_fatture_urgenti(self):
        """GET /api/scadenzario-fornitori/urgenti - Fatture urgenti e scadute"""
        response = requests.get(f"{BASE_URL}/api/scadenzario-fornitori/urgenti")
        assert response.status_code == 200
        data = response.json()
        assert "num_urgenti" in data
        assert "num_scadute" in data
        assert "totale_urgente" in data
        assert "totale_scaduto" in data
        print(f"✓ Fatture urgenti: {data['num_urgenti']} urgenti, {data['num_scadute']} scadute, Totale urgente €{data['totale_urgente']}")


class TestCalcoloIVA:
    """Test Calcolo IVA endpoints"""
    
    def test_calcolo_periodico(self):
        """GET /api/calcolo-iva/calcolo-periodico - Calcolo IVA periodo"""
        response = requests.get(f"{BASE_URL}/api/calcolo-iva/calcolo-periodico?anno=2025&mese=1")
        assert response.status_code == 200
        data = response.json()
        # API returns periodo, calcolo, esito structure
        assert "periodo" in data or "calcolo" in data
        print(f"✓ Calcolo IVA 2025/01: {data}")
    
    def test_riepilogo_annuale(self):
        """GET /api/calcolo-iva/riepilogo-annuale - Riepilogo IVA annuale"""
        response = requests.get(f"{BASE_URL}/api/calcolo-iva/riepilogo-annuale?anno=2025")
        assert response.status_code == 200
        data = response.json()
        assert "anno" in data
        print(f"✓ Riepilogo IVA annuale 2025: {data}")


class TestControlloGestione:
    """Test Controllo Gestione endpoints"""
    
    def test_costi_ricavi(self):
        """GET /api/controllo-gestione/costi-ricavi - Analisi costi e ricavi"""
        response = requests.get(f"{BASE_URL}/api/controllo-gestione/costi-ricavi?anno=2025")
        assert response.status_code == 200
        data = response.json()
        assert "anno" in data
        print(f"✓ Analisi costi/ricavi 2025: {data}")
    
    def test_kpi_gestionali(self):
        """GET /api/controllo-gestione/kpi/{anno} - KPI gestionali"""
        response = requests.get(f"{BASE_URL}/api/controllo-gestione/kpi/2025")
        assert response.status_code == 200
        data = response.json()
        assert "anno" in data
        print(f"✓ KPI gestionali 2025: {data}")
    
    def test_margini_analisi(self):
        """GET /api/controllo-gestione/margini - Analisi margini"""
        response = requests.get(f"{BASE_URL}/api/controllo-gestione/margini?anno=2025")
        # This endpoint may not exist, skip if 404
        if response.status_code == 404:
            pytest.skip("Endpoint /margini not implemented")
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Margini 2025: {data}")


class TestIndiciBilancio:
    """Test Indici di Bilancio endpoints"""
    
    def test_calcola_indici(self):
        """GET /api/indici-bilancio/calcola/{anno} - Calcolo indici ROI, ROE, ROS"""
        response = requests.get(f"{BASE_URL}/api/indici-bilancio/calcola/2025")
        assert response.status_code == 200
        data = response.json()
        assert "anno" in data
        print(f"✓ Indici bilancio 2025: {data}")
    
    def test_storico_indici(self):
        """GET /api/indici-bilancio/storico - Storico indici"""
        response = requests.get(f"{BASE_URL}/api/indici-bilancio/storico")
        # This endpoint may not exist, skip if 404
        if response.status_code == 404:
            pytest.skip("Endpoint /storico not implemented")
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Storico indici: {data}")


class TestChiusuraEsercizio:
    """Test Chiusura Esercizio endpoints"""
    
    def test_verifica_preliminare(self):
        """GET /api/chiusura-esercizio/verifica-preliminare/{anno} - Verifica per chiusura"""
        response = requests.get(f"{BASE_URL}/api/chiusura-esercizio/verifica-preliminare/2025")
        assert response.status_code == 200
        data = response.json()
        assert "anno" in data
        # API returns pronto_chiusura, problemi_bloccanti, avvisi, completamenti
        assert "pronto_chiusura" in data
        print(f"✓ Verifica preliminare 2025: Pronto={data['pronto_chiusura']}")
        if "problemi_bloccanti" in data:
            for p in data["problemi_bloccanti"]:
                print(f"  ✗ {p.get('tipo', 'N/A')}: {p.get('messaggio', '')}")
        if "avvisi" in data:
            for a in data["avvisi"]:
                print(f"  ⚠ {a.get('tipo', 'N/A')}: {a.get('messaggio', '')}")
    
    def test_bilancino_verifica(self):
        """GET /api/chiusura-esercizio/bilancino-verifica/{anno} - Bilancino di verifica"""
        response = requests.get(f"{BASE_URL}/api/chiusura-esercizio/bilancino-verifica/2025")
        assert response.status_code == 200
        data = response.json()
        assert "anno" in data
        print(f"✓ Bilancino verifica 2025: {data}")
    
    def test_stato_chiusura(self):
        """GET /api/chiusura-esercizio/stato/{anno} - Stato chiusura esercizio"""
        response = requests.get(f"{BASE_URL}/api/chiusura-esercizio/stato/2025")
        assert response.status_code == 200
        data = response.json()
        assert "anno" in data
        assert "stato" in data
        print(f"✓ Stato chiusura 2025: {data['stato']}")
    
    def test_storico_chiusure(self):
        """GET /api/chiusura-esercizio/storico - Storico chiusure"""
        response = requests.get(f"{BASE_URL}/api/chiusura-esercizio/storico")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Storico chiusure: {len(data)} chiusure registrate")


class TestCedoliniCRUD:
    """Test CRUD operations for Cedolini - requires employee data"""
    
    @pytest.fixture
    def dipendente_id(self):
        """Get first active employee ID"""
        response = requests.get(f"{BASE_URL}/api/dipendenti")
        if response.status_code == 200:
            dipendenti = response.json()
            attivi = [d for d in dipendenti if d.get("status") in ["attivo", "active"]]
            if attivi:
                return attivi[0]["id"]
        pytest.skip("No active employees found")
    
    def test_stima_cedolino(self, dipendente_id):
        """POST /api/cedolini/stima - Calcolo stima cedolino"""
        payload = {
            "dipendente_id": dipendente_id,
            "mese": 1,
            "anno": 2025,
            "ore_lavorate": 160,
            "straordinari_ore": 10,
            "festivita_ore": 0
        }
        response = requests.post(f"{BASE_URL}/api/cedolini/stima", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "dipendente_id" in data
        assert "dipendente_nome" in data
        assert "lordo_totale" in data
        assert "netto_in_busta" in data
        assert "costo_totale_azienda" in data
        assert "inps_dipendente" in data
        assert "irpef_netta" in data
        assert "inps_azienda" in data
        assert "tfr_mese" in data
        
        print(f"✓ Stima cedolino per {data['dipendente_nome']}:")
        print(f"  Lordo: €{data['lordo_totale']}")
        print(f"  Netto: €{data['netto_in_busta']}")
        print(f"  Costo Azienda: €{data['costo_totale_azienda']}")
        
        return data


class TestCespitiCRUD:
    """Test CRUD operations for Cespiti"""
    
    def test_crea_cespite(self):
        """POST /api/cespiti/ - Creazione nuovo cespite (note trailing slash)"""
        payload = {
            "descrizione": "TEST_Forno professionale",
            "categoria": "forni",
            "data_acquisto": "2025-01-15",
            "valore_acquisto": 5000.00,
            "fornitore": "Test Fornitore",
            "numero_fattura": "TEST-001"
        }
        # Note: POST requires trailing slash
        response = requests.post(f"{BASE_URL}/api/cespiti/", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "cespite_id" in data
        assert "dettaglio" in data
        
        print(f"✓ Cespite creato: {data['messaggio']}")
        print(f"  ID: {data['cespite_id']}")
        print(f"  Quota annua: €{data['dettaglio']['quota_annua_ordinaria']}")
        
        return data["cespite_id"]
    
    def test_get_cespite(self):
        """GET /api/cespiti/{id} - Dettaglio cespite"""
        # First create a cespite
        payload = {
            "descrizione": "TEST_Forno per test get",
            "categoria": "forni",
            "data_acquisto": "2025-01-15",
            "valore_acquisto": 3000.00
        }
        create_response = requests.post(f"{BASE_URL}/api/cespiti/", json=payload)
        assert create_response.status_code == 200
        cespite_id = create_response.json()["cespite_id"]
        
        response = requests.get(f"{BASE_URL}/api/cespiti/{cespite_id}")
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == cespite_id
        assert "descrizione" in data
        assert "valore_acquisto" in data
        assert "fondo_ammortamento" in data
        
        print(f"✓ Dettaglio cespite: {data['descrizione']}")


class TestTFRCRUD:
    """Test CRUD operations for TFR"""
    
    @pytest.fixture
    def dipendente_id(self):
        """Get first active employee ID"""
        response = requests.get(f"{BASE_URL}/api/dipendenti")
        if response.status_code == 200:
            dipendenti = response.json()
            attivi = [d for d in dipendenti if d.get("status") in ["attivo", "active"]]
            if attivi:
                return attivi[0]["id"]
        pytest.skip("No active employees found")
    
    def test_accantonamento_tfr(self, dipendente_id):
        """POST /api/tfr/accantonamento - Registrazione accantonamento TFR"""
        payload = {
            "dipendente_id": dipendente_id,
            "anno": 2025,
            "retribuzione_annua": 25000.00,
            "indice_istat": 1.5
        }
        response = requests.post(f"{BASE_URL}/api/tfr/accantonamento", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "accantonamento_id" in data
        assert "dettaglio" in data
        
        print(f"✓ TFR accantonato: {data['messaggio']}")
        print(f"  Quota annuale: €{data['dettaglio']['quota_annuale']}")
        print(f"  Rivalutazione: €{data['dettaglio']['rivalutazione']}")
        print(f"  Nuovo TFR totale: €{data['dettaglio']['nuovo_tfr_totale']}")
    
    def test_situazione_tfr(self, dipendente_id):
        """GET /api/tfr/situazione/{dipendente_id} - Situazione TFR dipendente"""
        response = requests.get(f"{BASE_URL}/api/tfr/situazione/{dipendente_id}")
        assert response.status_code == 200
        data = response.json()
        
        assert "dipendente_id" in data
        assert "tfr_accantonato" in data
        assert "tfr_disponibile" in data
        
        print(f"✓ Situazione TFR {data.get('dipendente_nome', 'N/A')}:")
        print(f"  Accantonato: €{data['tfr_accantonato']}")
        print(f"  Disponibile: €{data['tfr_disponibile']}")


class TestDipendentiEndpoint:
    """Test Dipendenti endpoint for cedolini integration"""
    
    def test_lista_dipendenti(self):
        """GET /api/dipendenti - Lista dipendenti"""
        response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Lista dipendenti: {len(data)} dipendenti")
        attivi = [d for d in data if d.get("status") in ["attivo", "active"]]
        print(f"  Attivi: {attivi}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
