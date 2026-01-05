"""
Test suite for Dipendenti Salari API endpoints
Tests: GET /api/dipendenti/salari, DELETE /api/dipendenti/salari/reset-reconciliation, GET /api/dipendenti/salari/riepilogo
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://accountmatch-3.preview.emergentagent.com').rstrip('/')


class TestSalariEndpoints:
    """Test suite for salari (salary) endpoints"""
    
    def test_get_salari_list_no_filters(self):
        """GET /api/dipendenti/salari - returns list of all salaries"""
        response = requests.get(f"{BASE_URL}/api/dipendenti/salari")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        # Should have salary records
        assert len(data) > 0
        
        # Verify structure of first record
        first_record = data[0]
        assert "id" in first_record
        assert "dipendente" in first_record
        assert "anno" in first_record
        assert "mese" in first_record
        assert "importo" in first_record
    
    def test_get_salari_filter_by_anno(self):
        """GET /api/dipendenti/salari?anno=2025 - filters by year"""
        response = requests.get(f"{BASE_URL}/api/dipendenti/salari?anno=2025")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # All records should be from 2025
        for record in data:
            assert record.get("anno") == 2025
    
    def test_get_salari_filter_by_mese(self):
        """GET /api/dipendenti/salari?anno=2025&mese=1 - filters by year and month"""
        response = requests.get(f"{BASE_URL}/api/dipendenti/salari?anno=2025&mese=1")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # All records should be from January 2025
        for record in data:
            assert record.get("anno") == 2025
            assert record.get("mese") == 1
    
    def test_get_salari_filter_by_dipendente(self):
        """GET /api/dipendenti/salari?dipendente=Ceraldi - filters by employee name"""
        response = requests.get(f"{BASE_URL}/api/dipendenti/salari?dipendente=Ceraldi")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # All records should contain "Ceraldi" in dipendente name
        for record in data:
            assert "ceraldi" in record.get("dipendente", "").lower()
    
    def test_get_salari_combined_filters(self):
        """GET /api/dipendenti/salari?anno=2025&mese=1&dipendente=Ceraldi - combined filters"""
        response = requests.get(f"{BASE_URL}/api/dipendenti/salari?anno=2025&mese=1&dipendente=Ceraldi")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # All records should match all filters
        for record in data:
            assert record.get("anno") == 2025
            assert record.get("mese") == 1
            assert "ceraldi" in record.get("dipendente", "").lower()


class TestSalariRiepilogo:
    """Test suite for salari riepilogo (summary) endpoint"""
    
    def test_get_riepilogo_no_filters(self):
        """GET /api/dipendenti/salari/riepilogo - returns summary without filters"""
        response = requests.get(f"{BASE_URL}/api/dipendenti/salari/riepilogo")
        assert response.status_code == 200
        
        data = response.json()
        assert "totale_dipendenti" in data
        assert "totale_buste" in data
        assert "totale_bonifici" in data
        assert "totale_riconciliati" in data
        assert "totale_non_riconciliati" in data
        assert "dipendenti" in data
        
        # Verify dipendenti is a list
        assert isinstance(data["dipendenti"], list)
    
    def test_get_riepilogo_filter_by_anno(self):
        """GET /api/dipendenti/salari/riepilogo?anno=2025 - summary for specific year"""
        response = requests.get(f"{BASE_URL}/api/dipendenti/salari/riepilogo?anno=2025")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("anno") == 2025
        assert "totale_dipendenti" in data
        assert "totale_buste" in data
        assert "dipendenti" in data
        
        # Verify totals are numeric
        assert isinstance(data["totale_buste"], (int, float))
        assert isinstance(data["totale_bonifici"], (int, float))
    
    def test_get_riepilogo_dipendente_structure(self):
        """Verify structure of dipendente in riepilogo"""
        response = requests.get(f"{BASE_URL}/api/dipendenti/salari/riepilogo?anno=2025")
        assert response.status_code == 200
        
        data = response.json()
        dipendenti = data.get("dipendenti", [])
        
        if len(dipendenti) > 0:
            first_dip = dipendenti[0]
            assert "dipendente" in first_dip
            assert "totale_busta" in first_dip
            assert "totale_bonifico" in first_dip
            assert "riconciliati" in first_dip
            assert "non_riconciliati" in first_dip
            assert "saldo" in first_dip


class TestResetRiconciliazione:
    """Test suite for reset reconciliation endpoint"""
    
    def test_reset_reconciliation_no_filters(self):
        """DELETE /api/dipendenti/salari/reset-reconciliation - reset all"""
        response = requests.delete(f"{BASE_URL}/api/dipendenti/salari/reset-reconciliation")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "salari_resettati" in data
        assert "estratti_conto_eliminati" in data
        
        # Verify message content
        assert "Reset riconciliazione completato" in data["message"]
    
    def test_reset_reconciliation_filter_by_anno(self):
        """DELETE /api/dipendenti/salari/reset-reconciliation?anno=2025 - reset for specific year"""
        response = requests.delete(f"{BASE_URL}/api/dipendenti/salari/reset-reconciliation?anno=2025")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "salari_resettati" in data
        assert isinstance(data["salari_resettati"], int)
    
    def test_reset_reconciliation_filter_by_dipendente(self):
        """DELETE /api/dipendenti/salari/reset-reconciliation?dipendente=Ceraldi - reset for specific employee"""
        response = requests.delete(f"{BASE_URL}/api/dipendenti/salari/reset-reconciliation?dipendente=Ceraldi")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "salari_resettati" in data


class TestDipendentiLista:
    """Test suite for dipendenti lista endpoint"""
    
    def test_get_dipendenti_lista(self):
        """GET /api/dipendenti/dipendenti-lista - returns unique employee names from salari"""
        response = requests.get(f"{BASE_URL}/api/dipendenti/dipendenti-lista")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Should have employee names
        if len(data) > 0:
            assert isinstance(data[0], str)


class TestDipendentiBase:
    """Test suite for base dipendenti endpoints"""
    
    def test_get_dipendenti_list(self):
        """GET /api/dipendenti - returns list of employees"""
        response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_dipendenti_stats(self):
        """GET /api/dipendenti/stats - returns employee statistics"""
        response = requests.get(f"{BASE_URL}/api/dipendenti/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "totale" in data
        assert "attivi" in data
        assert "inattivi" in data


class TestEuroFormatting:
    """Test that API returns proper numeric values for euro formatting"""
    
    def test_salari_importo_is_numeric(self):
        """Verify importo values are numeric for proper euro formatting"""
        response = requests.get(f"{BASE_URL}/api/dipendenti/salari?anno=2025&mese=1")
        assert response.status_code == 200
        
        data = response.json()
        for record in data:
            importo = record.get("importo")
            assert isinstance(importo, (int, float)), f"importo should be numeric, got {type(importo)}"
            
            stipendio_netto = record.get("stipendio_netto")
            if stipendio_netto is not None:
                assert isinstance(stipendio_netto, (int, float)), f"stipendio_netto should be numeric"
            
            importo_erogato = record.get("importo_erogato")
            if importo_erogato is not None:
                assert isinstance(importo_erogato, (int, float)), f"importo_erogato should be numeric"
    
    def test_riepilogo_totals_are_numeric(self):
        """Verify riepilogo totals are numeric for proper euro formatting"""
        response = requests.get(f"{BASE_URL}/api/dipendenti/salari/riepilogo?anno=2025")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data["totale_buste"], (int, float))
        assert isinstance(data["totale_bonifici"], (int, float))
        
        for dip in data.get("dipendenti", []):
            assert isinstance(dip["totale_busta"], (int, float))
            assert isinstance(dip["totale_bonifico"], (int, float))
            assert isinstance(dip["saldo"], (int, float))


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
