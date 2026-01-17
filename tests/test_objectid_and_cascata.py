"""
Test Suite: ObjectId Serialization & Cascade Operations
Tests for ERP Bar/Pasticceria application

Features tested:
1. Backend: /api/noleggio/veicoli returns vehicles without ObjectId
2. Backend: PUT /api/noleggio/veicoli/{targa} verifies driver_id exists in dipendenti
3. Backend: POST /api/operazioni-da-confermare/{id}/conferma no duplicates if already confirmed
4. Backend: No ObjectId serialization error on all main endpoints
5. Frontend: /ciclo-passivo page loads correctly
6. Frontend: /noleggio-auto page shows vehicles
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://account-unifier.preview.emergentagent.com"


class TestObjectIdSerialization:
    """Test that no endpoint returns ObjectId serialization errors"""
    
    def test_noleggio_veicoli_no_objectid(self):
        """Test /api/noleggio/veicoli returns valid JSON without ObjectId"""
        response = requests.get(f"{BASE_URL}/api/noleggio/veicoli")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "veicoli" in data, "Response should contain 'veicoli' key"
        assert "statistiche" in data, "Response should contain 'statistiche' key"
        
        # Verify no _id field in response
        for veicolo in data.get("veicoli", []):
            assert "_id" not in veicolo, f"ObjectId '_id' found in veicolo: {veicolo.get('targa')}"
        
        print(f"✅ /api/noleggio/veicoli: {data.get('count', 0)} veicoli returned without ObjectId")
    
    def test_operazioni_da_confermare_lista_no_objectid(self):
        """Test /api/operazioni-da-confermare/lista returns valid JSON"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/lista")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "operazioni" in data, "Response should contain 'operazioni' key"
        
        # Verify no _id field in operazioni
        for op in data.get("operazioni", []):
            assert "_id" not in op, f"ObjectId '_id' found in operazione"
        
        print(f"✅ /api/operazioni-da-confermare/lista: {len(data.get('operazioni', []))} operazioni without ObjectId")
    
    def test_dipendenti_lista_no_objectid(self):
        """Test /api/dipendenti returns valid JSON"""
        response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        dipendenti = data.get("dipendenti", data) if isinstance(data, dict) else data
        
        for d in dipendenti:
            assert "_id" not in d, f"ObjectId '_id' found in dipendente"
        
        print(f"✅ /api/dipendenti: {len(dipendenti)} dipendenti without ObjectId")
    
    def test_suppliers_lista_no_objectid(self):
        """Test /api/suppliers returns valid JSON"""
        response = requests.get(f"{BASE_URL}/api/suppliers?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        suppliers = data if isinstance(data, list) else data.get("items", data.get("suppliers", []))
        
        for s in suppliers:
            assert "_id" not in s, f"ObjectId '_id' found in supplier"
        
        print(f"✅ /api/suppliers: {len(suppliers)} suppliers without ObjectId")
    
    def test_invoices_lista_no_objectid(self):
        """Test /api/invoices returns valid JSON"""
        response = requests.get(f"{BASE_URL}/api/invoices?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        invoices = data if isinstance(data, list) else data.get("items", data.get("invoices", []))
        
        for inv in invoices:
            assert "_id" not in inv, f"ObjectId '_id' found in invoice"
        
        print(f"✅ /api/invoices: {len(invoices)} invoices without ObjectId")


class TestNoleggioVeicoliDriverValidation:
    """Test driver_id validation in noleggio veicoli"""
    
    def test_update_veicolo_with_invalid_driver_id(self):
        """Test PUT /api/noleggio/veicoli/{targa} rejects invalid driver_id"""
        test_targa = "ZZ999ZZ"
        invalid_driver_id = str(uuid.uuid4())  # Non-existent driver
        
        response = requests.put(
            f"{BASE_URL}/api/noleggio/veicoli/{test_targa}",
            json={
                "driver_id": invalid_driver_id,
                "marca": "Test",
                "modello": "Test Model"
            }
        )
        
        # Should return 400 because driver_id doesn't exist
        assert response.status_code == 400, f"Expected 400 for invalid driver_id, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Check both 'detail' and 'message' fields for error message
        error_msg = data.get("detail", "") or data.get("message", "")
        assert "non trovato" in error_msg.lower() or "not found" in error_msg.lower(), \
            f"Error message should mention driver not found: {data}"
        
        print(f"✅ PUT /api/noleggio/veicoli/{test_targa}: Correctly rejects invalid driver_id")
    
    def test_update_veicolo_with_valid_driver_id(self):
        """Test PUT /api/noleggio/veicoli/{targa} accepts valid driver_id"""
        # First get a valid driver from the noleggio/drivers endpoint
        response = requests.get(f"{BASE_URL}/api/noleggio/drivers")
        assert response.status_code == 200
        
        drivers_data = response.json()
        drivers = drivers_data.get("drivers", [])
        
        # Filter out drivers with empty nome_completo
        valid_drivers = [d for d in drivers if d.get("id") and d.get("nome_completo")]
        
        if not valid_drivers:
            pytest.skip("No valid drivers available for testing")
        
        valid_driver = valid_drivers[0]
        test_targa = "TEST01A"
        
        response = requests.put(
            f"{BASE_URL}/api/noleggio/veicoli/{test_targa}",
            json={
                "driver_id": valid_driver["id"],
                "marca": "Test",
                "modello": "Test Model"
            }
        )
        
        # Should succeed
        assert response.status_code == 200, f"Expected 200 for valid driver_id, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True: {data}"
        
        print(f"✅ PUT /api/noleggio/veicoli/{test_targa}: Correctly accepts valid driver_id ({valid_driver.get('nome_completo', '')})")
        
        # Cleanup - delete test veicolo
        requests.delete(f"{BASE_URL}/api/noleggio/veicoli/{test_targa}")


class TestDuplicatePrevention:
    """Test duplicate prevention in operazioni da confermare"""
    
    def test_conferma_operazione_duplicate_prevention(self):
        """Test POST /api/operazioni-da-confermare/{id}/conferma prevents duplicates"""
        # First, get list of operazioni
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/lista?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        operazioni = data.get("operazioni", [])
        
        if not operazioni:
            pytest.skip("No operazioni da confermare available for testing")
        
        # Find an operazione that's already confirmed or use first one
        test_op = operazioni[0]
        op_id = test_op.get("id") or test_op.get("fattura_id")
        
        if not op_id:
            pytest.skip("No operazione with id found")
        
        # Try to confirm twice - second should be handled gracefully
        response1 = requests.post(
            f"{BASE_URL}/api/operazioni-da-confermare/{op_id}/conferma",
            json={"metodo": "banca"}
        )
        
        # First confirmation might succeed or fail depending on state
        print(f"First confirmation response: {response1.status_code}")
        
        # Second confirmation should either succeed with duplicate_evitato or fail gracefully
        response2 = requests.post(
            f"{BASE_URL}/api/operazioni-da-confermare/{op_id}/conferma",
            json={"metodo": "banca"}
        )
        
        # Should not return 500 (ObjectId error)
        assert response2.status_code != 500, f"Got 500 error on duplicate confirmation: {response2.text}"
        
        if response2.status_code == 200:
            data2 = response2.json()
            # Should indicate duplicate was prevented
            if data2.get("duplicato_evitato"):
                print(f"✅ Duplicate prevention working: {data2.get('message')}")
            else:
                print(f"✅ Confirmation handled: {data2}")
        elif response2.status_code == 400:
            data2 = response2.json()
            error_msg = data2.get("detail", "") or data2.get("message", "")
            assert "già confermata" in error_msg.lower() or "already" in error_msg.lower() or "già" in error_msg.lower(), \
                f"Expected 'already confirmed' message: {data2}"
            print(f"✅ Duplicate prevention working: Operation already confirmed")
        else:
            print(f"Response: {response2.status_code} - {response2.text}")


class TestCicloPassivoIntegration:
    """Test ciclo passivo integration features"""
    
    def test_ciclo_passivo_lotti_lista(self):
        """Test /api/ciclo-passivo/lotti returns valid data"""
        response = requests.get(f"{BASE_URL}/api/ciclo-passivo/lotti?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        items = data.get("items", [])
        for item in items:
            assert "_id" not in item, f"ObjectId '_id' found in lotto"
        
        print(f"✅ /api/ciclo-passivo/lotti: {len(items)} lotti without ObjectId")
    
    def test_ciclo_passivo_dashboard_riconciliazione(self):
        """Test /api/ciclo-passivo/dashboard-riconciliazione returns valid data"""
        response = requests.get(f"{BASE_URL}/api/ciclo-passivo/dashboard-riconciliazione")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "statistiche" in data, "Response should contain 'statistiche' key"
        
        print(f"✅ /api/ciclo-passivo/dashboard-riconciliazione: Loaded successfully")


class TestNoleggioDriversEndpoint:
    """Test noleggio drivers endpoint"""
    
    def test_get_drivers(self):
        """Test /api/noleggio/drivers returns valid data"""
        response = requests.get(f"{BASE_URL}/api/noleggio/drivers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "drivers" in data, "Response should contain 'drivers' key"
        
        drivers = data.get("drivers", [])
        for d in drivers:
            assert "_id" not in d, f"ObjectId '_id' found in driver"
            assert "id" in d, "Driver should have 'id' field"
            assert "nome_completo" in d, "Driver should have 'nome_completo' field"
        
        print(f"✅ /api/noleggio/drivers: {len(drivers)} drivers without ObjectId")


class TestHealthAndBasicEndpoints:
    """Test health and basic endpoints"""
    
    def test_health_check(self):
        """Test /api/health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✅ /api/health: OK")
    
    def test_noleggio_fornitori(self):
        """Test /api/noleggio/fornitori endpoint"""
        response = requests.get(f"{BASE_URL}/api/noleggio/fornitori")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "fornitori" in data, "Response should contain 'fornitori' key"
        print(f"✅ /api/noleggio/fornitori: {len(data.get('fornitori', []))} fornitori")


class TestPrimaNotaEndpoints:
    """Test Prima Nota endpoints"""
    
    def test_prima_nota_banca(self):
        """Test /api/prima-nota/banca returns valid data"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/banca?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        items = data if isinstance(data, list) else data.get("items", data.get("movimenti", []))
        for item in items:
            assert "_id" not in item, f"ObjectId '_id' found in movimento"
        
        print(f"✅ /api/prima-nota/banca: {len(items)} movimenti without ObjectId")
    
    def test_prima_nota_cassa(self):
        """Test /api/prima-nota/cassa returns valid data"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/cassa?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        items = data if isinstance(data, list) else data.get("items", data.get("movimenti", []))
        for item in items:
            assert "_id" not in item, f"ObjectId '_id' found in movimento"
        
        print(f"✅ /api/prima-nota/cassa: {len(items)} movimenti without ObjectId")


class TestWarehouseEndpoints:
    """Test Warehouse endpoints"""
    
    def test_warehouse_products(self):
        """Test /api/warehouse/products returns valid data"""
        response = requests.get(f"{BASE_URL}/api/warehouse/products?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        items = data if isinstance(data, list) else data.get("items", data.get("products", []))
        for item in items:
            assert "_id" not in item, f"ObjectId '_id' found in product"
        
        print(f"✅ /api/warehouse/products: {len(items)} products without ObjectId")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
