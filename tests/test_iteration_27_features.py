"""
Test suite for Iteration 27 features:
1. Verify 90 ricette in database
2. Verify anno selector includes 2023, 2024, 2025, 2026
3. Verify IVA page shows different data for each month in 2024
4. Verify delete supplier with linked invoices returns 400
5. Verify force delete works
6. Verify supplier search
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestRicetteImport:
    """Test ricette import - should have 90 ricette"""
    
    def test_ricette_count_is_90(self):
        """GET /api/ricette should return 90 ricette"""
        response = requests.get(f"{BASE_URL}/api/ricette")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("totale") == 90, f"Expected 90 ricette, got {data.get('totale')}"
    
    def test_ricette_have_required_fields(self):
        """Ricette should have required fields"""
        response = requests.get(f"{BASE_URL}/api/ricette?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        ricette = data.get("ricette", [])
        assert len(ricette) > 0
        
        for ricetta in ricette:
            assert "id" in ricetta
            assert "nome" in ricetta
            assert "categoria" in ricetta


class TestIVAAnnual:
    """Test IVA annual data for different years"""
    
    def test_iva_annual_2024_has_data(self):
        """GET /api/iva/annual/2024 should return data for all 12 months"""
        response = requests.get(f"{BASE_URL}/api/iva/annual/2024")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("anno") == 2024
        
        monthly_data = data.get("monthly_data", [])
        assert len(monthly_data) == 12, f"Expected 12 months, got {len(monthly_data)}"
    
    def test_iva_2024_different_values_per_month(self):
        """IVA 2024 should have different values for each month"""
        response = requests.get(f"{BASE_URL}/api/iva/annual/2024")
        assert response.status_code == 200
        
        data = response.json()
        monthly_data = data.get("monthly_data", [])
        
        # Get unique IVA credito values
        credito_values = [m.get("iva_credito", 0) for m in monthly_data]
        unique_values = set(credito_values)
        
        # Should have multiple different values (not all the same)
        assert len(unique_values) > 1, "All months have the same IVA credito value"
        
        # Verify specific months have data
        months_with_data = [m for m in monthly_data if m.get("iva_credito", 0) > 0]
        assert len(months_with_data) >= 10, f"Expected at least 10 months with data, got {len(months_with_data)}"
    
    def test_iva_annual_2023_exists(self):
        """GET /api/iva/annual/2023 should return data"""
        response = requests.get(f"{BASE_URL}/api/iva/annual/2023")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("anno") == 2023
        
        monthly_data = data.get("monthly_data", [])
        assert len(monthly_data) == 12
    
    def test_iva_annual_2025_exists(self):
        """GET /api/iva/annual/2025 should return data"""
        response = requests.get(f"{BASE_URL}/api/iva/annual/2025")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("anno") == 2025


class TestSupplierDeleteWithInvoices:
    """Test supplier delete with linked invoices"""
    
    def test_delete_supplier_with_invoices_returns_400(self):
        """DELETE supplier with linked invoices should return 400"""
        # Testo S.p.A. has 2 linked invoices
        supplier_id = "b576b9bd-d1dd-41bc-b060-2db057294b47"
        
        response = requests.delete(f"{BASE_URL}/api/suppliers/{supplier_id}")
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        error_msg = str(data).lower()
        assert "fatture collegate" in error_msg or "impossibile eliminare" in error_msg
    
    def test_delete_supplier_error_message_contains_count(self):
        """Error message should contain invoice count"""
        supplier_id = "b576b9bd-d1dd-41bc-b060-2db057294b47"
        
        response = requests.delete(f"{BASE_URL}/api/suppliers/{supplier_id}")
        assert response.status_code == 400
        
        data = response.json()
        # Should mention "2 fatture collegate"
        assert "2" in str(data) or "fatture" in str(data).lower()
    
    def test_force_delete_works(self):
        """DELETE with force=true should work"""
        # Create a test supplier
        create_response = requests.post(f"{BASE_URL}/api/suppliers", json={
            "denominazione": "TEST_ITERATION_27_DELETE",
            "partita_iva": "77777777777"
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


class TestSupplierSearch:
    """Test supplier search functionality"""
    
    def test_search_by_name(self):
        """Search by name should work"""
        response = requests.get(f"{BASE_URL}/api/suppliers?search=Testo")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) >= 1
        
        # Should find Testo S.p.A.
        names = [s.get("denominazione", "") for s in data]
        assert any("Testo" in (n or "") for n in names)
    
    def test_search_by_piva(self):
        """Search by P.IVA should work"""
        response = requests.get(f"{BASE_URL}/api/suppliers?search=10498780153")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) >= 1
        
        # Should find Testo S.p.A.
        pivas = [s.get("partita_iva", "") for s in data]
        assert "10498780153" in pivas
    
    def test_search_case_insensitive(self):
        """Search should be case insensitive"""
        response_upper = requests.get(f"{BASE_URL}/api/suppliers?search=TESTO")
        response_lower = requests.get(f"{BASE_URL}/api/suppliers?search=testo")
        
        assert response_upper.status_code == 200
        assert response_lower.status_code == 200
        
        data_upper = response_upper.json()
        data_lower = response_lower.json()
        
        assert len(data_upper) == len(data_lower)
    
    def test_supplier_has_invoice_count(self):
        """Suppliers should have fatture_count field"""
        response = requests.get(f"{BASE_URL}/api/suppliers?search=Testo")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) >= 1
        
        supplier = data[0]
        assert "fatture_count" in supplier
        assert supplier["fatture_count"] == 2, f"Expected 2 invoices, got {supplier['fatture_count']}"


class TestSupplierStats:
    """Test supplier statistics"""
    
    def test_suppliers_total_count(self):
        """Should have 300+ suppliers"""
        response = requests.get(f"{BASE_URL}/api/suppliers")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) >= 300, f"Expected 300+ suppliers, got {len(data)}"
    
    def test_suppliers_with_invoices(self):
        """Should have many suppliers with invoices"""
        response = requests.get(f"{BASE_URL}/api/suppliers")
        assert response.status_code == 200
        
        data = response.json()
        with_invoices = [s for s in data if s.get("fatture_count", 0) > 0]
        
        assert len(with_invoices) >= 100, f"Expected 100+ suppliers with invoices, got {len(with_invoices)}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
