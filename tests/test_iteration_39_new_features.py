"""
Test Iteration 39 - New Features Testing
- Riconciliazione batch fatture
- Gestione IVA speciale (duplicazione IVA, note credito)
- Operazioni da confermare endpoints
"""
import pytest
import requests
import os
from datetime import datetime
from uuid import uuid4

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestOperazioniDaConfermare:
    """Test endpoints for Operazioni da Confermare"""
    
    def test_lista_operazioni(self):
        """GET /api/operazioni-da-confermare/lista - Lista operazioni"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/lista?anno=2026")
        assert response.status_code == 200
        
        data = response.json()
        assert "operazioni" in data
        assert "stats" in data
        assert "stats_per_anno" in data
        
        # Verify stats structure
        stats = data["stats"]
        assert "totale" in stats
        assert "da_confermare" in stats
        assert "confermate" in stats
        assert "totale_importo_da_confermare" in stats
        print(f"✅ Lista operazioni: {stats['totale']} totali, {stats['da_confermare']} da confermare")
    
    def test_lista_operazioni_filtro_stato(self):
        """GET /api/operazioni-da-confermare/lista - Filtro per stato"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/lista?stato=da_confermare&anno=2026")
        assert response.status_code == 200
        
        data = response.json()
        # All returned operations should be da_confermare
        for op in data["operazioni"]:
            assert op.get("stato") == "da_confermare" or op.get("stato") is None
        print(f"✅ Filtro stato funziona: {len(data['operazioni'])} operazioni da confermare")
    
    def test_check_fattura_esistente(self):
        """GET /api/operazioni-da-confermare/check-fattura-esistente"""
        response = requests.get(
            f"{BASE_URL}/api/operazioni-da-confermare/check-fattura-esistente",
            params={"fornitore": "TEST_FORNITORE", "numero_fattura": "TEST_123"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "esiste" in data
        assert "in_cassa" in data
        assert "in_banca" in data
        assert "dettagli" in data
        print(f"✅ Check fattura esistente: esiste={data['esiste']}")
    
    def test_riconciliazione_batch_dry_run(self):
        """POST /api/operazioni-da-confermare/riconciliazione-batch - Dry run"""
        response = requests.post(
            f"{BASE_URL}/api/operazioni-da-confermare/riconciliazione-batch",
            params={"anno": 2025, "dry_run": True}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "anno" in data
        assert data["anno"] == 2025
        assert "dry_run" in data
        assert data["dry_run"] == True
        assert "totale_fatture" in data
        assert "riconciliate" in data
        assert "non_trovate" in data
        assert "percentuale_riconciliate" in data
        print(f"✅ Riconciliazione batch dry_run: {data['totale_fatture']} fatture, {data['riconciliate']} riconciliate ({data['percentuale_riconciliate']}%)")


class TestGestioneIVASpeciale:
    """Test endpoints for Gestione IVA Speciale"""
    
    def test_lista_note_credito(self):
        """GET /api/iva-speciale/note-credito - Lista note credito"""
        response = requests.get(f"{BASE_URL}/api/iva-speciale/note-credito")
        assert response.status_code == 200
        
        data = response.json()
        assert "note" in data
        assert "riepilogo" in data
        
        riepilogo = data["riepilogo"]
        assert "num_note" in riepilogo
        assert "totale_imponibile" in riepilogo
        assert "totale_iva" in riepilogo
        print(f"✅ Lista note credito: {riepilogo['num_note']} note, IVA totale: {riepilogo['totale_iva']}")
    
    def test_lista_note_credito_filtro_anno(self):
        """GET /api/iva-speciale/note-credito - Filtro per anno"""
        response = requests.get(f"{BASE_URL}/api/iva-speciale/note-credito?anno=2025")
        assert response.status_code == 200
        
        data = response.json()
        # All notes should be from 2025
        for nota in data["note"]:
            assert nota.get("anno") == 2025
        print(f"✅ Filtro anno note credito: {len(data['note'])} note per 2025")
    
    def test_registra_nota_credito(self):
        """POST /api/iva-speciale/nota-credito - Registra nota credito"""
        nota_data = {
            "fornitore": "TEST_FORNITORE_NC",
            "numero_nota": f"NC_TEST_{uuid4().hex[:8]}",
            "data": "2025-12-15",
            "imponibile": 100.00,
            "iva": 22.00,
            "tipo": "reso_merce",
            "descrizione": "Test nota credito per reso merce"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/iva-speciale/nota-credito",
            json=nota_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "nota_id" in data
        assert "messaggio" in data
        assert "dettaglio" in data
        
        dettaglio = data["dettaglio"]
        assert dettaglio["imponibile"] == 100.00
        assert dettaglio["iva"] == 22.00
        assert dettaglio["totale"] == 122.00
        assert dettaglio["tipo"] == "reso_merce"
        
        print(f"✅ Nota credito registrata: {data['nota_id']}")
        return data["nota_id"]
    
    def test_riepilogo_iva_rettificato(self):
        """GET /api/iva-speciale/riepilogo-iva-rettificato/{anno}"""
        response = requests.get(f"{BASE_URL}/api/iva-speciale/riepilogo-iva-rettificato/2025")
        assert response.status_code == 200
        
        data = response.json()
        assert "anno" in data
        assert data["anno"] == 2025
        assert "iva_debito" in data
        assert "iva_credito" in data
        assert "saldo" in data
        assert "tipo_saldo" in data
        
        # Verify iva_debito structure
        iva_debito = data["iva_debito"]
        assert "fatture_emesse" in iva_debito
        assert "fatture_escluse_per_corrispettivi" in iva_debito
        assert "corrispettivi" in iva_debito
        assert "totale" in iva_debito
        
        # Verify iva_credito structure
        iva_credito = data["iva_credito"]
        assert "acquisti" in iva_credito
        assert "note_credito_dedotte" in iva_credito
        assert "totale" in iva_credito
        
        print(f"✅ Riepilogo IVA rettificato: saldo={data['saldo']} ({data['tipo_saldo']})")
    
    def test_riepilogo_iva_rettificato_con_mese(self):
        """GET /api/iva-speciale/riepilogo-iva-rettificato/{anno} - Con filtro mese"""
        response = requests.get(f"{BASE_URL}/api/iva-speciale/riepilogo-iva-rettificato/2025?mese=11")
        assert response.status_code == 200
        
        data = response.json()
        assert data["anno"] == 2025
        assert data["mese"] == 11
        print(f"✅ Riepilogo IVA mese 11/2025: saldo={data['saldo']}")
    
    def test_fatture_in_corrispettivi(self):
        """GET /api/iva-speciale/fatture-in-corrispettivi"""
        response = requests.get(f"{BASE_URL}/api/iva-speciale/fatture-in-corrispettivi?anno=2025")
        assert response.status_code == 200
        
        data = response.json()
        assert "anno" in data
        assert data["anno"] == 2025
        assert "num_fatture" in data
        assert "totale_iva_esclusa" in data
        assert "fatture" in data
        print(f"✅ Fatture in corrispettivi: {data['num_fatture']} fatture, IVA esclusa: {data['totale_iva_esclusa']}")
    
    def test_marca_fattura_in_corrispettivo_not_found(self):
        """POST /api/iva-speciale/marca-in-corrispettivo - Fattura non trovata"""
        response = requests.post(
            f"{BASE_URL}/api/iva-speciale/marca-in-corrispettivo",
            json={
                "fattura_id": "FATTURA_INESISTENTE_123",
                "data_corrispettivo": "2025-12-01",
                "note": "Test"
            }
        )
        assert response.status_code == 404
        print("✅ Marca fattura non trovata: 404 corretto")


class TestCedoliniEndpoints:
    """Test Cedolini endpoints (already tested in iteration 38, quick verification)"""
    
    def test_cedolini_lista(self):
        """GET /api/cedolini/lista/{anno}/{mese}"""
        response = requests.get(f"{BASE_URL}/api/cedolini/lista/2026/1")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Cedolini lista: {len(data)} cedolini per Gen 2026")
    
    def test_cedolini_riepilogo_mensile(self):
        """GET /api/cedolini/riepilogo-mensile/{anno}/{mese}"""
        response = requests.get(f"{BASE_URL}/api/cedolini/riepilogo-mensile/2026/1")
        assert response.status_code == 200
        
        data = response.json()
        assert "num_cedolini" in data
        print(f"✅ Riepilogo mensile: {data['num_cedolini']} cedolini")


class TestCespitiEndpoints:
    """Test Cespiti endpoints (already tested in iteration 38, quick verification)"""
    
    def test_cespiti_lista(self):
        """GET /api/cespiti/?attivi=true"""
        response = requests.get(f"{BASE_URL}/api/cespiti/?attivi=true")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Cespiti lista: {len(data)} cespiti attivi")
    
    def test_cespiti_riepilogo(self):
        """GET /api/cespiti/riepilogo"""
        response = requests.get(f"{BASE_URL}/api/cespiti/riepilogo")
        assert response.status_code == 200
        
        data = response.json()
        assert "totali" in data
        assert "per_categoria" in data
        print(f"✅ Riepilogo cespiti: {data['totali']['num_cespiti']} cespiti totali")


class TestTFREndpoints:
    """Test TFR endpoints (already tested in iteration 38, quick verification)"""
    
    def test_tfr_riepilogo_aziendale(self):
        """GET /api/tfr/riepilogo-aziendale"""
        response = requests.get(f"{BASE_URL}/api/tfr/riepilogo-aziendale?anno=2026")
        assert response.status_code == 200
        
        data = response.json()
        assert "totale_fondo_tfr" in data
        assert "accantonamenti_anno" in data
        assert "liquidazioni_anno" in data
        print(f"✅ TFR riepilogo: fondo totale={data['totale_fondo_tfr']}")


class TestScadenzarioFornitoriEndpoints:
    """Test Scadenzario Fornitori endpoints (already tested in iteration 38, quick verification)"""
    
    def test_scadenzario_lista(self):
        """GET /api/scadenzario-fornitori/?anno={anno}"""
        response = requests.get(f"{BASE_URL}/api/scadenzario-fornitori/?anno=2026")
        assert response.status_code == 200
        
        data = response.json()
        assert "riepilogo" in data
        assert "per_fornitore" in data
        print(f"✅ Scadenzario: {data['riepilogo']['totale_fatture']} fatture")
    
    def test_scadenzario_urgenti(self):
        """GET /api/scadenzario-fornitori/urgenti"""
        response = requests.get(f"{BASE_URL}/api/scadenzario-fornitori/urgenti")
        assert response.status_code == 200
        
        data = response.json()
        assert "num_urgenti" in data
        assert "num_scadute" in data
        print(f"✅ Scadenzario urgenti: {data['num_urgenti']} urgenti, {data['num_scadute']} scadute")


# Cleanup test data
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after tests"""
    yield
    # Cleanup note credito test data
    try:
        response = requests.get(f"{BASE_URL}/api/iva-speciale/note-credito")
        if response.status_code == 200:
            data = response.json()
            for nota in data.get("note", []):
                if nota.get("fornitore", "").startswith("TEST_"):
                    # Note: No delete endpoint for note credito, so we just log
                    print(f"Note: TEST note credito {nota.get('id')} would need manual cleanup")
    except Exception as e:
        print(f"Cleanup warning: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
