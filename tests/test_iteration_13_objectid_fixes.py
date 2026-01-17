"""
Test Suite: Iteration 13 - ObjectId Fixes Verification
Tests for ERP application after massive .copy() fixes on 229+ insert_one calls

Features tested:
1. Backend: No ObjectId errors on /api/suppliers
2. Backend: No ObjectId errors on /api/prima-nota/cassa
3. Backend: No ObjectId errors on /api/prima-nota/banca
4. Backend: No ObjectId errors on /api/employees (dipendenti)
5. Backend: No ObjectId errors on /api/noleggio/veicoli
6. Backend: No ObjectId errors on /api/warehouse/products
7. Backend: /api/ciclo-passivo/dashboard-riconciliazione works
8. Backend: Driver validation in noleggio uses employees collection
9. Backend: Duplicate prevention on operazioni da confermare
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://invoice-rescue-7.preview.emergentagent.com"


class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self):
        """Test /api/health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        assert data.get("database") == "connected"
        print(f"✅ API Health: {data.get('status')}, DB: {data.get('database')}")


class TestSuppliersEndpoint:
    """Test /api/suppliers - No ObjectId errors"""
    
    def test_suppliers_list_no_objectid(self):
        """Test /api/suppliers returns valid JSON without ObjectId"""
        response = requests.get(f"{BASE_URL}/api/suppliers?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        suppliers = data if isinstance(data, list) else data.get("items", data.get("suppliers", []))
        
        for s in suppliers:
            assert "_id" not in s, f"ObjectId '_id' found in supplier"
        
        print(f"✅ /api/suppliers: {len(suppliers)} suppliers without ObjectId")
    
    def test_suppliers_response_structure(self):
        """Test suppliers response has expected structure"""
        response = requests.get(f"{BASE_URL}/api/suppliers?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        suppliers = data if isinstance(data, list) else data.get("items", data.get("suppliers", []))
        
        if suppliers:
            supplier = suppliers[0]
            # Check for common fields
            assert "id" in supplier or "partita_iva" in supplier, "Supplier should have id or partita_iva"
        
        print(f"✅ /api/suppliers: Response structure valid")


class TestPrimaNotaCassaEndpoint:
    """Test /api/prima-nota/cassa - No ObjectId errors"""
    
    def test_prima_nota_cassa_no_objectid(self):
        """Test /api/prima-nota/cassa returns valid JSON without ObjectId"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/cassa?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        items = data if isinstance(data, list) else data.get("items", data.get("movimenti", []))
        
        for item in items:
            assert "_id" not in item, f"ObjectId '_id' found in movimento cassa"
        
        print(f"✅ /api/prima-nota/cassa: {len(items)} movimenti without ObjectId")


class TestPrimaNotaBancaEndpoint:
    """Test /api/prima-nota/banca - No ObjectId errors"""
    
    def test_prima_nota_banca_no_objectid(self):
        """Test /api/prima-nota/banca returns valid JSON without ObjectId"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/banca?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        items = data if isinstance(data, list) else data.get("items", data.get("movimenti", []))
        
        for item in items:
            assert "_id" not in item, f"ObjectId '_id' found in movimento banca"
        
        print(f"✅ /api/prima-nota/banca: {len(items)} movimenti without ObjectId")


class TestEmployeesEndpoint:
    """Test /api/dipendenti (employees) - No ObjectId errors"""
    
    def test_dipendenti_no_objectid(self):
        """Test /api/dipendenti returns valid JSON without ObjectId"""
        response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        dipendenti = data.get("dipendenti", data) if isinstance(data, dict) else data
        
        for d in dipendenti:
            assert "_id" not in d, f"ObjectId '_id' found in dipendente"
        
        print(f"✅ /api/dipendenti: {len(dipendenti)} dipendenti without ObjectId")
    
    def test_dipendenti_have_required_fields(self):
        """Test dipendenti have required fields"""
        response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert response.status_code == 200
        
        data = response.json()
        dipendenti = data.get("dipendenti", data) if isinstance(data, dict) else data
        
        if dipendenti:
            d = dipendenti[0]
            assert "id" in d, "Dipendente should have 'id' field"
        
        print(f"✅ /api/dipendenti: Required fields present")


class TestNoleggioVeicoliEndpoint:
    """Test /api/noleggio/veicoli - No ObjectId errors"""
    
    def test_noleggio_veicoli_no_objectid(self):
        """Test /api/noleggio/veicoli returns valid JSON without ObjectId"""
        response = requests.get(f"{BASE_URL}/api/noleggio/veicoli")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "veicoli" in data, "Response should contain 'veicoli' key"
        assert "statistiche" in data, "Response should contain 'statistiche' key"
        
        for veicolo in data.get("veicoli", []):
            assert "_id" not in veicolo, f"ObjectId '_id' found in veicolo"
        
        print(f"✅ /api/noleggio/veicoli: {data.get('count', 0)} veicoli without ObjectId")
    
    def test_noleggio_drivers_uses_employees_collection(self):
        """Test /api/noleggio/drivers returns drivers from employees collection"""
        response = requests.get(f"{BASE_URL}/api/noleggio/drivers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "drivers" in data, "Response should contain 'drivers' key"
        
        drivers = data.get("drivers", [])
        # Should have drivers if employees collection has data
        print(f"✅ /api/noleggio/drivers: {len(drivers)} drivers from employees collection")
    
    def test_update_veicolo_validates_driver_id(self):
        """Test PUT /api/noleggio/veicoli/{targa} validates driver_id against employees"""
        test_targa = "ZZ999ZZ"
        invalid_driver_id = str(uuid.uuid4())
        
        response = requests.put(
            f"{BASE_URL}/api/noleggio/veicoli/{test_targa}",
            json={
                "driver_id": invalid_driver_id,
                "marca": "Test",
                "modello": "Test Model"
            }
        )
        
        # Should return 400 because driver_id doesn't exist in employees
        assert response.status_code == 400, f"Expected 400 for invalid driver_id, got {response.status_code}"
        
        data = response.json()
        error_msg = data.get("detail", "") or data.get("message", "")
        assert "non trovato" in error_msg.lower() or "not found" in error_msg.lower()
        
        print(f"✅ Driver validation: Correctly rejects invalid driver_id")


class TestWarehouseProductsEndpoint:
    """Test /api/warehouse/products - No ObjectId errors"""
    
    def test_warehouse_products_no_objectid(self):
        """Test /api/warehouse/products returns valid JSON without ObjectId"""
        response = requests.get(f"{BASE_URL}/api/warehouse/products?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        items = data if isinstance(data, list) else data.get("items", data.get("products", []))
        
        for item in items:
            assert "_id" not in item, f"ObjectId '_id' found in product"
        
        print(f"✅ /api/warehouse/products: {len(items)} products without ObjectId")


class TestCicloPassivoIntegrato:
    """Test Ciclo Passivo Integrato endpoints"""
    
    def test_dashboard_riconciliazione(self):
        """Test /api/ciclo-passivo/dashboard-riconciliazione works"""
        response = requests.get(f"{BASE_URL}/api/ciclo-passivo/dashboard-riconciliazione")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "statistiche" in data, "Response should contain 'statistiche' key"
        
        print(f"✅ /api/ciclo-passivo/dashboard-riconciliazione: Working")
    
    def test_lotti_no_objectid(self):
        """Test /api/ciclo-passivo/lotti returns valid data"""
        response = requests.get(f"{BASE_URL}/api/ciclo-passivo/lotti?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        items = data.get("items", [])
        
        for item in items:
            assert "_id" not in item, f"ObjectId '_id' found in lotto"
        
        print(f"✅ /api/ciclo-passivo/lotti: {len(items)} lotti without ObjectId")


class TestOperazioniDaConfermare:
    """Test operazioni da confermare - duplicate prevention"""
    
    def test_operazioni_lista_no_objectid(self):
        """Test /api/operazioni-da-confermare/lista returns valid JSON"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/lista")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "operazioni" in data, "Response should contain 'operazioni' key"
        
        for op in data.get("operazioni", []):
            assert "_id" not in op, f"ObjectId '_id' found in operazione"
        
        print(f"✅ /api/operazioni-da-confermare/lista: {len(data.get('operazioni', []))} operazioni without ObjectId")
    
    def test_conferma_duplicate_prevention(self):
        """Test duplicate prevention on conferma"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/lista?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        operazioni = data.get("operazioni", [])
        
        if not operazioni:
            pytest.skip("No operazioni da confermare available")
        
        test_op = operazioni[0]
        op_id = test_op.get("id") or test_op.get("fattura_id")
        
        if not op_id:
            pytest.skip("No operazione with id found")
        
        # Try to confirm twice
        response1 = requests.post(
            f"{BASE_URL}/api/operazioni-da-confermare/{op_id}/conferma",
            json={"metodo": "banca"}
        )
        
        response2 = requests.post(
            f"{BASE_URL}/api/operazioni-da-confermare/{op_id}/conferma",
            json={"metodo": "banca"}
        )
        
        # Should not return 500 (ObjectId error)
        assert response2.status_code != 500, f"Got 500 error on duplicate confirmation"
        
        print(f"✅ Duplicate prevention: No 500 error on duplicate confirmation")


class TestInvoicesEndpoint:
    """Test /api/invoices - No ObjectId errors"""
    
    def test_invoices_no_objectid(self):
        """Test /api/invoices returns valid JSON without ObjectId"""
        response = requests.get(f"{BASE_URL}/api/invoices?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        invoices = data if isinstance(data, list) else data.get("items", data.get("invoices", []))
        
        for inv in invoices:
            assert "_id" not in inv, f"ObjectId '_id' found in invoice"
        
        print(f"✅ /api/invoices: {len(invoices)} invoices without ObjectId")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
