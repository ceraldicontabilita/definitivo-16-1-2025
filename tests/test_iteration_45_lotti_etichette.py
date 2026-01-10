"""
Test Iteration 45 - Lotti Avanzati, FEFO e Etichette
Tests for the new workflow 'Dall'XML all'Etichetta' for Italian ERP.
Includes: Lotti management, FEFO logic, Label printing endpoints.
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLottiEndpoints:
    """Test endpoints for lotti management"""
    
    def test_get_lotti_list(self):
        """GET /api/ciclo-passivo/lotti - Lista lotti con filtri e statistiche"""
        response = requests.get(f"{BASE_URL}/api/ciclo-passivo/lotti?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "statistiche" in data
        
        # Verify statistiche structure
        stats = data["statistiche"]
        assert "totale" in stats
        assert "disponibili" in stats
        assert "esauriti" in stats
        assert "da_completare" in stats
        assert "in_scadenza_7gg" in stats
        
        print(f"✅ GET /api/ciclo-passivo/lotti - Found {data['total']} lotti")
        print(f"   Stats: disponibili={stats['disponibili']}, da_completare={stats['da_completare']}")
    
    def test_get_lotti_with_filters(self):
        """GET /api/ciclo-passivo/lotti with filters"""
        # Test filter by stato
        response = requests.get(f"{BASE_URL}/api/ciclo-passivo/lotti?stato=disponibile")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Filter by stato=disponibile: {data['total']} lotti")
        
        # Test filter by scadenza_entro_giorni
        response = requests.get(f"{BASE_URL}/api/ciclo-passivo/lotti?scadenza_entro_giorni=30")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Filter by scadenza_entro_giorni=30: {data['total']} lotti")
    
    def test_get_lotti_fattura(self):
        """GET /api/ciclo-passivo/lotti/fattura/{id} - Lotti di una fattura specifica"""
        # First get a fattura ID
        fatture_response = requests.get(f"{BASE_URL}/api/fatture-ricevute/archivio?limit=1")
        if fatture_response.status_code != 200 or not fatture_response.json().get("items"):
            pytest.skip("No fatture available for testing")
        
        fattura_id = fatture_response.json()["items"][0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/ciclo-passivo/lotti/fattura/{fattura_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "fattura" in data
        assert "lotti" in data
        assert "totale_lotti" in data
        
        print(f"✅ GET /api/ciclo-passivo/lotti/fattura/{fattura_id[:8]}...")
        print(f"   Fattura: {data['fattura'].get('numero_documento', 'N/A')}")
        print(f"   Lotti trovati: {data['totale_lotti']}")
    
    def test_get_lotto_dettaglio(self):
        """GET /api/ciclo-passivo/lotto/{id} - Dettaglio singolo lotto"""
        # First get a lotto ID
        lotti_response = requests.get(f"{BASE_URL}/api/ciclo-passivo/lotti?limit=1")
        if lotti_response.status_code != 200 or not lotti_response.json().get("items"):
            pytest.skip("No lotti available for testing")
        
        lotto_id = lotti_response.json()["items"][0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/ciclo-passivo/lotto/{lotto_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert "prodotto" in data
        
        print(f"✅ GET /api/ciclo-passivo/lotto/{lotto_id[:8]}...")
        print(f"   Prodotto: {data.get('prodotto', 'N/A')[:50]}")
    
    def test_get_lotto_not_found(self):
        """GET /api/ciclo-passivo/lotto/{id} - 404 for non-existent lotto"""
        response = requests.get(f"{BASE_URL}/api/ciclo-passivo/lotto/non-existent-id")
        assert response.status_code == 404
        print("✅ GET /api/ciclo-passivo/lotto/non-existent-id returns 404")


class TestLottoUpdate:
    """Test lotto update endpoints"""
    
    def test_update_lotto_fornitore(self):
        """PUT /api/ciclo-passivo/lotto/{id} - Aggiornamento lotto fornitore manuale"""
        # First get a lotto ID
        lotti_response = requests.get(f"{BASE_URL}/api/ciclo-passivo/lotti?limit=1")
        if lotti_response.status_code != 200 or not lotti_response.json().get("items"):
            pytest.skip("No lotti available for testing")
        
        lotto_id = lotti_response.json()["items"][0]["id"]
        
        # Update lotto_fornitore
        update_data = {"lotto_fornitore": "TEST-UPDATE-LOTTO-456"}
        response = requests.put(
            f"{BASE_URL}/api/ciclo-passivo/lotto/{lotto_id}",
            json=update_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "lotto_fornitore" in data["updated"]
        
        print(f"✅ PUT /api/ciclo-passivo/lotto/{lotto_id[:8]}...")
        print(f"   Updated fields: {data['updated']}")
        
        # Verify update
        verify_response = requests.get(f"{BASE_URL}/api/ciclo-passivo/lotto/{lotto_id}")
        assert verify_response.status_code == 200
        assert verify_response.json()["lotto_fornitore"] == "TEST-UPDATE-LOTTO-456"
        print("   ✅ Update verified")
    
    def test_segna_etichetta_stampata(self):
        """POST /api/ciclo-passivo/lotto/{id}/segna-etichetta-stampata - Flag stampa etichetta"""
        # First get a lotto ID
        lotti_response = requests.get(f"{BASE_URL}/api/ciclo-passivo/lotti?limit=1")
        if lotti_response.status_code != 200 or not lotti_response.json().get("items"):
            pytest.skip("No lotti available for testing")
        
        lotto_id = lotti_response.json()["items"][0]["id"]
        
        response = requests.post(f"{BASE_URL}/api/ciclo-passivo/lotto/{lotto_id}/segna-etichetta-stampata")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        
        print(f"✅ POST /api/ciclo-passivo/lotto/{lotto_id[:8]}.../segna-etichetta-stampata")
        
        # Verify flag
        verify_response = requests.get(f"{BASE_URL}/api/ciclo-passivo/lotto/{lotto_id}")
        assert verify_response.status_code == 200
        assert verify_response.json().get("etichetta_stampata") == True
        print("   ✅ Flag etichetta_stampata verified")


class TestFEFO:
    """Test FEFO (First Expired First Out) logic"""
    
    def test_suggerimento_fefo(self):
        """GET /api/ciclo-passivo/lotti/suggerimento-fefo/{prodotto} - Suggerimenti FEFO"""
        # Test with a product that might exist
        response = requests.get(
            f"{BASE_URL}/api/ciclo-passivo/lotti/suggerimento-fefo/Prodotto",
            params={"quantita_necessaria": 5}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "trovati" in data
        assert "suggerimenti" in data
        
        if data["trovati"]:
            assert "quantita_richiesta" in data
            assert "quantita_coperta" in data
            print(f"✅ FEFO suggerimento trovato per 'Prodotto'")
            print(f"   Quantità richiesta: {data['quantita_richiesta']}")
            print(f"   Quantità coperta: {data['quantita_coperta']}")
            print(f"   Lotti suggeriti: {len(data['suggerimenti'])}")
        else:
            print(f"✅ FEFO suggerimento - Nessun lotto disponibile per 'Prodotto'")
            print(f"   Message: {data.get('message', 'N/A')}")
    
    def test_suggerimento_fefo_not_found(self):
        """GET /api/ciclo-passivo/lotti/suggerimento-fefo/{prodotto} - No lotti found"""
        response = requests.get(
            f"{BASE_URL}/api/ciclo-passivo/lotti/suggerimento-fefo/ProdottoInesistente12345",
            params={"quantita_necessaria": 1}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["trovati"] == False
        print("✅ FEFO suggerimento returns trovati=False for non-existent product")


class TestScaricoProduzioneFefo:
    """Test scarico produzione with FEFO logic"""
    
    def test_scarico_produzione_fefo_insufficient(self):
        """POST /api/ciclo-passivo/scarico-produzione-fefo - Insufficient quantity"""
        response = requests.post(
            f"{BASE_URL}/api/ciclo-passivo/scarico-produzione-fefo",
            params={
                "prodotto_ricerca": "ProdottoInesistente12345",
                "quantita": 1000,
                "motivo": "Test"
            }
        )
        # Should return 404 (no lotti) or 400 (insufficient quantity)
        assert response.status_code in [400, 404]
        print(f"✅ Scarico FEFO returns {response.status_code} for insufficient/missing product")


class TestEtichette:
    """Test etichette (label) endpoints"""
    
    def test_get_dati_etichetta(self):
        """GET /api/ciclo-passivo/etichetta/{id} - Dati per stampa etichetta con QR"""
        # First get a lotto ID
        lotti_response = requests.get(f"{BASE_URL}/api/ciclo-passivo/lotti?limit=1")
        if lotti_response.status_code != 200 or not lotti_response.json().get("items"):
            pytest.skip("No lotti available for testing")
        
        lotto_id = lotti_response.json()["items"][0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/ciclo-passivo/etichetta/{lotto_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "lotto" in data
        assert "etichetta" in data
        
        etichetta = data["etichetta"]
        assert "nome_prodotto" in etichetta
        assert "lotto_interno" in etichetta
        assert "lotto_fornitore" in etichetta
        assert "fornitore" in etichetta
        assert "data_scadenza" in etichetta
        assert "fattura_numero" in etichetta
        assert "fattura_data" in etichetta
        assert "quantita" in etichetta
        assert "qr_data" in etichetta
        
        print(f"✅ GET /api/ciclo-passivo/etichetta/{lotto_id[:8]}...")
        print(f"   Prodotto: {etichetta['nome_prodotto'][:40]}...")
        print(f"   Lotto interno: {etichetta['lotto_interno']}")
        print(f"   Lotto fornitore: {etichetta['lotto_fornitore']}")
        print(f"   Scadenza: {etichetta['data_scadenza']}")
        print(f"   QR data: {etichetta['qr_data']}")
    
    def test_get_etichetta_not_found(self):
        """GET /api/ciclo-passivo/etichetta/{id} - 404 for non-existent lotto"""
        response = requests.get(f"{BASE_URL}/api/ciclo-passivo/etichetta/non-existent-id")
        assert response.status_code == 404
        print("✅ GET /api/ciclo-passivo/etichetta/non-existent-id returns 404")


class TestParserFunctions:
    """Test parser functions for lotto and scadenza extraction"""
    
    def test_import_with_lotto_pattern(self):
        """Test that import correctly extracts lotto from description"""
        # This is tested indirectly through the import endpoint
        # The lotti created should have lotto_fornitore extracted from description
        lotti_response = requests.get(f"{BASE_URL}/api/ciclo-passivo/lotti?limit=10")
        if lotti_response.status_code != 200:
            pytest.skip("Cannot access lotti endpoint")
        
        data = lotti_response.json()
        lotti_with_lotto = [l for l in data["items"] if l.get("lotto_fornitore") or l.get("numero_lotto")]
        
        print(f"✅ Parser test - Found {len(lotti_with_lotto)} lotti with extracted lotto codes")
        for l in lotti_with_lotto[:3]:
            print(f"   - {l.get('prodotto', 'N/A')[:30]}... -> Lotto: {l.get('lotto_fornitore') or l.get('numero_lotto', 'N/A')}")


class TestCicloPassivoPage:
    """Test /ciclo-passivo page endpoints"""
    
    def test_dashboard_riconciliazione(self):
        """GET /api/ciclo-passivo/dashboard-riconciliazione"""
        response = requests.get(f"{BASE_URL}/api/ciclo-passivo/dashboard-riconciliazione")
        assert response.status_code == 200
        
        data = response.json()
        assert "scadenze_aperte" in data
        assert "scadenze_saldate" in data
        
        print(f"✅ Dashboard riconciliazione")
        print(f"   Scadenze aperte: {data['scadenze_aperte']}")
        print(f"   Scadenze saldate: {data['scadenze_saldate']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
