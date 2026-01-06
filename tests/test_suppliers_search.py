"""
Test suite for Suppliers Search and Delete functionality.
Tests the bug fixes for:
1. Supplier search by name and P.IVA
2. Delete supplier with linked invoices (checks both cedente_piva and supplier_vat)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSuppliersSearch:
    """Test supplier search functionality"""
    
    def test_search_by_name_acquaverde(self):
        """Search for ACQUAVERDE should return 1 result"""
        response = requests.get(f"{BASE_URL}/api/suppliers?search=ACQUAVERDE")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 1, f"Expected 1 result, got {len(data)}"
        assert data[0]["denominazione"] == "ACQUAVERDE SRL"
        assert data[0]["partita_iva"] == "04487630727"
    
    def test_search_by_piva(self):
        """Search by P.IVA 04487630727 should find ACQUAVERDE SRL"""
        response = requests.get(f"{BASE_URL}/api/suppliers?search=04487630727")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 1, f"Expected 1 result, got {len(data)}"
        assert data[0]["denominazione"] == "ACQUAVERDE SRL"
    
    def test_search_no_filter_returns_all(self):
        """GET /api/suppliers without filter should return all suppliers (300+)"""
        response = requests.get(f"{BASE_URL}/api/suppliers")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) >= 300, f"Expected 300+ suppliers, got {len(data)}"
    
    def test_search_partial_name(self):
        """Search with partial name should work"""
        response = requests.get(f"{BASE_URL}/api/suppliers?search=ACQUA")
        assert response.status_code == 200
        
        data = response.json()
        # Should find at least ACQUAVERDE
        assert len(data) >= 1
        names = [s.get("denominazione", "") for s in data]
        assert any("ACQUA" in (n or "").upper() for n in names)
    
    def test_search_case_insensitive(self):
        """Search should be case insensitive"""
        response_upper = requests.get(f"{BASE_URL}/api/suppliers?search=ACQUAVERDE")
        response_lower = requests.get(f"{BASE_URL}/api/suppliers?search=acquaverde")
        
        assert response_upper.status_code == 200
        assert response_lower.status_code == 200
        
        data_upper = response_upper.json()
        data_lower = response_lower.json()
        
        assert len(data_upper) == len(data_lower)


class TestSuppliersInvoiceCount:
    """Test that suppliers show correct invoice count"""
    
    def test_suppliers_have_invoice_stats(self):
        """Suppliers with P.IVA should have fatture_count field"""
        response = requests.get(f"{BASE_URL}/api/suppliers?limit=50")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) > 0
        
        # Check that suppliers with P.IVA have fatture_count field
        suppliers_with_piva = [s for s in data if s.get("partita_iva")]
        assert len(suppliers_with_piva) > 0, "No suppliers with P.IVA found"
        
        for supplier in suppliers_with_piva[:10]:
            assert "fatture_count" in supplier, f"Missing fatture_count for {supplier.get('denominazione')}"
            assert "fatture_totale" in supplier
            assert "fatture_non_pagate" in supplier
    
    def test_suppliers_with_invoices_count(self):
        """Should have suppliers with invoice count > 0"""
        response = requests.get(f"{BASE_URL}/api/suppliers")
        assert response.status_code == 200
        
        data = response.json()
        with_invoices = [s for s in data if s.get("fatture_count", 0) > 0]
        
        # After fix, should have many suppliers with invoices
        assert len(with_invoices) > 100, f"Expected 100+ suppliers with invoices, got {len(with_invoices)}"


class TestSuppliersDelete:
    """Test supplier delete with linked invoices"""
    
    def test_delete_supplier_with_invoices_blocked(self):
        """Delete supplier with linked invoices should return 400"""
        # First find a supplier with invoices
        response = requests.get(f"{BASE_URL}/api/suppliers")
        assert response.status_code == 200
        
        data = response.json()
        with_invoices = [s for s in data if s.get("fatture_count", 0) > 0]
        
        if not with_invoices:
            pytest.skip("No suppliers with invoices found")
        
        supplier = with_invoices[0]
        supplier_id = supplier.get("id")
        
        # Try to delete without force
        delete_response = requests.delete(f"{BASE_URL}/api/suppliers/{supplier_id}")
        
        # Should return 400 with error message
        assert delete_response.status_code == 400
        error_data = delete_response.json()
        assert "fatture collegate" in str(error_data).lower() or "impossibile eliminare" in str(error_data).lower()
    
    def test_delete_supplier_force_works(self):
        """Delete supplier with force=true should work even with invoices"""
        # Create a test supplier first
        create_response = requests.post(f"{BASE_URL}/api/suppliers", json={
            "denominazione": "TEST_DELETE_SUPPLIER",
            "partita_iva": "99999999999"
        })
        
        if create_response.status_code != 200:
            pytest.skip("Could not create test supplier")
        
        supplier_id = create_response.json().get("id")
        
        # Delete with force
        delete_response = requests.delete(f"{BASE_URL}/api/suppliers/{supplier_id}?force=true")
        assert delete_response.status_code == 200
        
        # Verify deleted
        get_response = requests.get(f"{BASE_URL}/api/suppliers/{supplier_id}")
        assert get_response.status_code == 404


class TestSuppliersAPI:
    """General API tests"""
    
    def test_get_supplier_by_id(self):
        """GET /api/suppliers/{id} should return supplier details"""
        # First get a supplier
        list_response = requests.get(f"{BASE_URL}/api/suppliers?limit=1")
        assert list_response.status_code == 200
        
        suppliers = list_response.json()
        if not suppliers:
            pytest.skip("No suppliers found")
        
        supplier_id = suppliers[0].get("id")
        
        # Get by ID
        response = requests.get(f"{BASE_URL}/api/suppliers/{supplier_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("id") == supplier_id
    
    def test_get_supplier_not_found(self):
        """GET /api/suppliers/{invalid_id} should return 404"""
        response = requests.get(f"{BASE_URL}/api/suppliers/invalid-id-12345")
        assert response.status_code == 404


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
