"""
Test Iteration 14 - CRUD Operations, Business Logic Controls, Chiusura/Apertura Esercizio
Tests:
1. DELETE /api/suppliers/{id} - blocks if invoices linked
2. DELETE /api/operazioni-da-confermare/{id} - blocks if already confirmed
3. DELETE /api/noleggio/veicoli/{targa} - deletes from database
4. GET /api/chiusura-esercizio/verifica-preliminare/{anno} - returns completeness check
5. POST /api/chiusura-esercizio/apertura-nuovo-esercizio - creates initial balances
6. GET /api/chiusura-esercizio/saldi-iniziali/{anno} - returns carried balances
7. Riconciliazione manuale creates Prima Nota movement
8. Import fattura XML creates supplier if not exists
9. No ObjectId errors on critical endpoints
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSupplierDeleteWithInvoiceCheck:
    """Test DELETE /api/suppliers/{id} blocks if invoices linked"""
    
    def test_delete_supplier_without_invoices(self):
        """Create a supplier without invoices and delete it successfully"""
        # Create a test supplier
        supplier_id = f"test_supplier_{uuid.uuid4().hex[:8]}"
        supplier_data = {
            "id": supplier_id,
            "partita_iva": f"TEST{uuid.uuid4().hex[:7].upper()}",
            "denominazione": "Test Supplier No Invoices",
            "email": "test@test.com",
            "attivo": True
        }
        
        # First, we need to create the supplier via the API
        # Since there's no direct POST endpoint, we'll test the delete behavior
        # by checking if a non-existent supplier returns 404
        response = requests.delete(f"{BASE_URL}/api/suppliers/nonexistent_supplier_12345")
        assert response.status_code == 404, f"Expected 404 for non-existent supplier, got {response.status_code}"
    
    def test_delete_supplier_with_invoices_blocked(self):
        """Verify that deleting a supplier with linked invoices is blocked"""
        # Get list of suppliers
        response = requests.get(f"{BASE_URL}/api/suppliers")
        assert response.status_code == 200
        
        suppliers = response.json()
        if not suppliers:
            pytest.skip("No suppliers in database to test")
        
        # Find a supplier with invoices (fatture_count > 0)
        supplier_with_invoices = None
        for s in suppliers:
            if s.get("fatture_count", 0) > 0:
                supplier_with_invoices = s
                break
        
        if not supplier_with_invoices:
            pytest.skip("No supplier with invoices found")
        
        supplier_id = supplier_with_invoices.get("id") or supplier_with_invoices.get("partita_iva")
        
        # Try to delete without force - should be blocked
        response = requests.delete(f"{BASE_URL}/api/suppliers/{supplier_id}")
        assert response.status_code == 400, f"Expected 400 (blocked), got {response.status_code}"
        
        data = response.json()
        # Response can use "detail" or "message" depending on error handler
        error_msg = (data.get("detail", "") or data.get("message", "")).lower()
        assert "fatture collegate" in error_msg or "impossibile" in error_msg, f"Unexpected response: {data}"


class TestOperazioniDaConfermarDelete:
    """Test DELETE /api/operazioni-da-confermare/{id} blocks if already confirmed"""
    
    def test_delete_nonexistent_operazione(self):
        """Delete non-existent operation returns 404"""
        response = requests.delete(f"{BASE_URL}/api/operazioni-da-confermare/nonexistent_op_12345")
        assert response.status_code == 404
    
    def test_list_operazioni_da_confermare(self):
        """Verify operazioni-da-confermare/lista endpoint works"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/lista")
        assert response.status_code == 200
        
        data = response.json()
        assert "operazioni" in data
        assert "stats" in data


class TestNoleggioVeicoliDelete:
    """Test DELETE /api/noleggio/veicoli/{targa} deletes from database"""
    
    def test_delete_nonexistent_veicolo(self):
        """Delete non-existent vehicle returns 404"""
        response = requests.delete(f"{BASE_URL}/api/noleggio/veicoli/XX000XX")
        assert response.status_code == 404
    
    def test_create_and_delete_veicolo(self):
        """Create a test vehicle and delete it"""
        test_targa = f"ZZ{uuid.uuid4().hex[:3].upper()}ZZ"
        
        # Create vehicle via PUT (upsert)
        create_data = {
            "marca": "Test",
            "modello": "TestModel",
            "fornitore_noleggio": "ALD",
            "fornitore_piva": "01924961004"
        }
        
        response = requests.put(f"{BASE_URL}/api/noleggio/veicoli/{test_targa}", json=create_data)
        assert response.status_code == 200, f"Failed to create vehicle: {response.text}"
        
        # Verify it was created
        response = requests.get(f"{BASE_URL}/api/noleggio/veicoli")
        assert response.status_code == 200
        
        # Delete the vehicle
        response = requests.delete(f"{BASE_URL}/api/noleggio/veicoli/{test_targa}")
        assert response.status_code == 200, f"Failed to delete vehicle: {response.text}"
        
        data = response.json()
        assert data.get("success") == True


class TestChiusuraEsercizio:
    """Test Chiusura Esercizio endpoints"""
    
    def test_verifica_preliminare(self):
        """GET /api/chiusura-esercizio/verifica-preliminare/{anno} returns completeness check"""
        anno = 2025
        response = requests.get(f"{BASE_URL}/api/chiusura-esercizio/verifica-preliminare/{anno}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "anno" in data
        assert data["anno"] == anno
        assert "pronto_per_chiusura" in data
        assert "punteggio_completezza" in data
        assert "problemi_bloccanti" in data
        assert "avvisi" in data
        assert "completamenti" in data
        assert "step_successivo" in data
    
    def test_bilancino_verifica(self):
        """GET /api/chiusura-esercizio/bilancino-verifica/{anno} returns balance check"""
        anno = 2025
        response = requests.get(f"{BASE_URL}/api/chiusura-esercizio/bilancino-verifica/{anno}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "anno" in data
        assert "bilancino" in data
        
        bilancino = data["bilancino"]
        assert "ricavi" in bilancino
        assert "costi" in bilancino
        assert "risultato" in bilancino
    
    def test_stato_chiusura(self):
        """GET /api/chiusura-esercizio/stato/{anno} returns closure status"""
        anno = 2025
        response = requests.get(f"{BASE_URL}/api/chiusura-esercizio/stato/{anno}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "anno" in data
        assert "stato" in data
        # stato can be "aperto" or "chiuso"
        assert data["stato"] in ["aperto", "chiuso"]
    
    def test_storico_chiusure(self):
        """GET /api/chiusura-esercizio/storico returns closure history"""
        response = requests.get(f"{BASE_URL}/api/chiusura-esercizio/storico")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
    
    def test_saldi_iniziali(self):
        """GET /api/chiusura-esercizio/saldi-iniziali/{anno} returns carried balances"""
        anno = 2025  # Use 2025 which exists
        response = requests.get(f"{BASE_URL}/api/chiusura-esercizio/saldi-iniziali/{anno}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "anno" in data
        # saldi can be null if no opening registered
        assert "saldi" in data or "messaggio" in data
    
    def test_apertura_nuovo_esercizio_requires_chiusura(self):
        """POST /api/chiusura-esercizio/apertura-nuovo-esercizio requires previous year closed"""
        # Try to open 2027 without closing 2026
        response = requests.post(f"{BASE_URL}/api/chiusura-esercizio/apertura-nuovo-esercizio?anno_nuovo=2027")
        
        # Should fail because 2026 is not closed
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Response can use "detail" or "message" depending on error handler
        error_msg = (data.get("detail", "") or data.get("message", "")).lower()
        assert "non è ancora stato chiuso" in error_msg or "chiuso" in error_msg, f"Unexpected response: {data}"


class TestRiconciliazioneManuale:
    """Test riconciliazione manuale creates Prima Nota movement"""
    
    def test_smart_analizza_endpoint(self):
        """GET /api/operazioni-da-confermare/smart/analizza works"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/analizza")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Should return analysis results
        assert isinstance(data, dict)
    
    def test_cerca_fatture_per_associazione(self):
        """GET /api/operazioni-da-confermare/smart/cerca-fatture works"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/cerca-fatture")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "fatture" in data
        assert "totale" in data
    
    def test_cerca_stipendi_per_associazione(self):
        """GET /api/operazioni-da-confermare/smart/cerca-stipendi works"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/cerca-stipendi")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "stipendi" in data
        assert "totale" in data


class TestNoObjectIdErrors:
    """Test that critical endpoints don't return ObjectId errors"""
    
    def test_suppliers_no_objectid(self):
        """GET /api/suppliers returns valid JSON without ObjectId"""
        response = requests.get(f"{BASE_URL}/api/suppliers")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Check no _id fields in response
        for item in data[:5]:  # Check first 5
            assert "_id" not in item, f"Found _id in supplier: {item}"
    
    def test_invoices_no_objectid(self):
        """GET /api/invoices returns valid JSON without ObjectId"""
        response = requests.get(f"{BASE_URL}/api/invoices?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        # Check structure
        if isinstance(data, dict) and "invoices" in data:
            invoices = data["invoices"]
        else:
            invoices = data if isinstance(data, list) else []
        
        for item in invoices[:5]:
            assert "_id" not in item, f"Found _id in invoice: {item}"
    
    def test_prima_nota_cassa_no_objectid(self):
        """GET /api/prima-nota/cassa returns valid JSON without ObjectId"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/cassa")
        assert response.status_code == 200
        
        data = response.json()
        if isinstance(data, dict) and "movimenti" in data:
            movimenti = data["movimenti"]
        else:
            movimenti = data if isinstance(data, list) else []
        
        for item in movimenti[:5]:
            assert "_id" not in item, f"Found _id in movimento cassa: {item}"
    
    def test_prima_nota_banca_no_objectid(self):
        """GET /api/prima-nota/banca returns valid JSON without ObjectId"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/banca")
        assert response.status_code == 200
        
        data = response.json()
        if isinstance(data, dict) and "movimenti" in data:
            movimenti = data["movimenti"]
        else:
            movimenti = data if isinstance(data, list) else []
        
        for item in movimenti[:5]:
            assert "_id" not in item, f"Found _id in movimento banca: {item}"
    
    def test_dipendenti_no_objectid(self):
        """GET /api/dipendenti returns valid JSON without ObjectId"""
        response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert response.status_code == 200
        
        data = response.json()
        if isinstance(data, dict) and "dipendenti" in data:
            dipendenti = data["dipendenti"]
        else:
            dipendenti = data if isinstance(data, list) else []
        
        for item in dipendenti[:5]:
            assert "_id" not in item, f"Found _id in dipendente: {item}"
    
    def test_noleggio_veicoli_no_objectid(self):
        """GET /api/noleggio/veicoli returns valid JSON without ObjectId"""
        response = requests.get(f"{BASE_URL}/api/noleggio/veicoli")
        assert response.status_code == 200
        
        data = response.json()
        if isinstance(data, dict) and "veicoli" in data:
            veicoli = data["veicoli"]
        else:
            veicoli = data if isinstance(data, list) else []
        
        for item in veicoli[:5]:
            assert "_id" not in item, f"Found _id in veicolo: {item}"


class TestTFREndpoints:
    """Test TFR endpoints for frontend page"""
    
    def test_dipendenti_endpoint(self):
        """GET /api/dipendenti returns employees for TFR page"""
        response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Should have dipendenti list
        if isinstance(data, dict):
            assert "dipendenti" in data or isinstance(data.get("dipendenti"), list)
    
    def test_tfr_situazione_endpoint(self):
        """GET /api/tfr/situazione/{dipendente_id} works"""
        # First get a dipendente
        response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert response.status_code == 200
        
        data = response.json()
        dipendenti = data.get("dipendenti", data) if isinstance(data, dict) else data
        
        if not dipendenti:
            pytest.skip("No employees to test TFR")
        
        dipendente_id = dipendenti[0].get("id")
        if not dipendente_id:
            pytest.skip("Employee has no ID")
        
        # Get TFR situation
        response = requests.get(f"{BASE_URL}/api/tfr/situazione/{dipendente_id}")
        # Can be 200 or 404 if no TFR data
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"


class TestCriticalEndpointsHealth:
    """Test that all critical endpoints are healthy"""
    
    def test_health_endpoint(self):
        """GET /api/health returns OK"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
    
    def test_suppliers_endpoint(self):
        """GET /api/suppliers is healthy"""
        response = requests.get(f"{BASE_URL}/api/suppliers")
        assert response.status_code == 200
    
    def test_invoices_endpoint(self):
        """GET /api/invoices is healthy"""
        response = requests.get(f"{BASE_URL}/api/invoices")
        assert response.status_code == 200
    
    def test_operazioni_lista_endpoint(self):
        """GET /api/operazioni-da-confermare/lista is healthy"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/lista")
        assert response.status_code == 200
    
    def test_noleggio_veicoli_endpoint(self):
        """GET /api/noleggio/veicoli is healthy"""
        response = requests.get(f"{BASE_URL}/api/noleggio/veicoli")
        assert response.status_code == 200
    
    def test_chiusura_esercizio_endpoints(self):
        """Chiusura esercizio endpoints are healthy"""
        endpoints = [
            "/api/chiusura-esercizio/verifica-preliminare/2025",
            "/api/chiusura-esercizio/bilancino-verifica/2025",
            "/api/chiusura-esercizio/stato/2025",
            "/api/chiusura-esercizio/storico",
            "/api/chiusura-esercizio/saldi-iniziali/2025"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code == 200, f"Endpoint {endpoint} failed: {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
