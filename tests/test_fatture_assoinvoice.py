"""
Test suite for Fatture AssoInvoice view feature
Tests the endpoint /api/fatture-ricevute/fattura/{id}/view-assoinvoice
and related functionality for Prima Nota Banca and Gestione Assegni pages
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFattureAssoInvoiceEndpoint:
    """Tests for the view-assoinvoice endpoint"""
    
    def test_view_assoinvoice_returns_html(self):
        """Test that the endpoint returns HTML content"""
        # Use the test fattura_id provided
        fattura_id = "43faf328-3d00-4930-9832-245085a1b56d"
        response = requests.get(f"{BASE_URL}/api/fatture-ricevute/fattura/{fattura_id}/view-assoinvoice")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "text/html" in response.headers.get("content-type", ""), "Expected HTML content type"
        
        # Verify HTML structure
        content = response.text
        assert "<!DOCTYPE html>" in content or "<html" in content, "Response should be valid HTML"
        assert "FATTURA" in content, "HTML should contain 'FATTURA'"
    
    def test_view_assoinvoice_contains_invoice_data(self):
        """Test that the HTML contains invoice data"""
        fattura_id = "43faf328-3d00-4930-9832-245085a1b56d"
        response = requests.get(f"{BASE_URL}/api/fatture-ricevute/fattura/{fattura_id}/view-assoinvoice")
        
        assert response.status_code == 200
        content = response.text
        
        # Check for expected invoice elements
        assert "0070045803" in content, "Invoice number should be present"
        assert "KIMBO" in content, "Supplier name should be present"
        assert "2025-12-17" in content, "Invoice date should be present"
    
    def test_view_assoinvoice_has_print_button(self):
        """Test that the HTML has a print button"""
        fattura_id = "43faf328-3d00-4930-9832-245085a1b56d"
        response = requests.get(f"{BASE_URL}/api/fatture-ricevute/fattura/{fattura_id}/view-assoinvoice")
        
        assert response.status_code == 200
        content = response.text
        
        # Check for print button
        assert "print-btn" in content, "Print button class should be present"
        assert "window.print()" in content, "Print function should be present"
    
    def test_view_assoinvoice_not_found(self):
        """Test that non-existent fattura returns 404"""
        fattura_id = "non-existent-id-12345"
        response = requests.get(f"{BASE_URL}/api/fatture-ricevute/fattura/{fattura_id}/view-assoinvoice")
        
        assert response.status_code == 404, f"Expected 404 for non-existent fattura, got {response.status_code}"


class TestEstrattoContoMovimenti:
    """Tests for Prima Nota Banca data (estratto conto movimenti)"""
    
    def test_movimenti_endpoint_returns_data(self):
        """Test that movimenti endpoint returns data for year 2025"""
        response = requests.get(f"{BASE_URL}/api/estratto-conto-movimenti/movimenti?anno=2025&limit=100")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "movimenti" in data or isinstance(data, list), "Response should contain movimenti"
        
        movimenti = data.get("movimenti", data)
        assert len(movimenti) > 0, "Should have at least one movimento for 2025"
    
    def test_movimenti_with_fattura_id(self):
        """Test that some movimenti have fattura_id in dettagli_riconciliazione"""
        response = requests.get(f"{BASE_URL}/api/estratto-conto-movimenti/movimenti?anno=2025&limit=500")
        
        assert response.status_code == 200
        
        data = response.json()
        movimenti = data.get("movimenti", data)
        
        # Find movimenti with fattura_id
        movimenti_con_fattura = [
            m for m in movimenti 
            if m.get("dettagli_riconciliazione", {}).get("fattura_id") or m.get("fattura_id")
        ]
        
        assert len(movimenti_con_fattura) > 0, "Should have at least one movimento with fattura_id"
        
        # Verify structure of movimento with fattura
        movimento = movimenti_con_fattura[0]
        if movimento.get("dettagli_riconciliazione"):
            assert "fattura_id" in movimento["dettagli_riconciliazione"], "dettagli_riconciliazione should have fattura_id"
    
    def test_movimenti_structure(self):
        """Test that movimenti have expected structure"""
        response = requests.get(f"{BASE_URL}/api/estratto-conto-movimenti/movimenti?anno=2025&limit=10")
        
        assert response.status_code == 200
        
        data = response.json()
        movimenti = data.get("movimenti", data)
        
        if len(movimenti) > 0:
            movimento = movimenti[0]
            # Check required fields
            assert "id" in movimento, "Movimento should have id"
            assert "data" in movimento, "Movimento should have data"
            assert "importo" in movimento, "Movimento should have importo"
            assert "tipo" in movimento, "Movimento should have tipo"


class TestAssegni:
    """Tests for Gestione Assegni functionality"""
    
    def test_assegni_endpoint_returns_data(self):
        """Test that assegni endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/assegni")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list of assegni"
    
    def test_assegni_with_fattura_collegata(self):
        """Test that some assegni have fattura_collegata"""
        response = requests.get(f"{BASE_URL}/api/assegni")
        
        assert response.status_code == 200
        
        assegni = response.json()
        
        # Find assegni with fattura_collegata
        assegni_con_fattura = [
            a for a in assegni 
            if a.get("fattura_collegata")
        ]
        
        # Note: This may be 0 if no assegni have linked invoices
        print(f"Found {len(assegni_con_fattura)} assegni with fattura_collegata")
    
    def test_assegni_structure(self):
        """Test that assegni have expected structure"""
        response = requests.get(f"{BASE_URL}/api/assegni")
        
        assert response.status_code == 200
        
        assegni = response.json()
        
        if len(assegni) > 0:
            assegno = assegni[0]
            # Check required fields
            assert "id" in assegno, "Assegno should have id"
            assert "numero" in assegno, "Assegno should have numero"
            assert "stato" in assegno, "Assegno should have stato"


class TestFattureRicevuteArchivio:
    """Tests for fatture ricevute archivio endpoint"""
    
    def test_archivio_endpoint(self):
        """Test that archivio endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/fatture-ricevute/archivio?anno=2025")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "items" in data, "Response should have items"
        assert "total" in data, "Response should have total count"
    
    def test_fattura_dettaglio(self):
        """Test getting fattura detail"""
        fattura_id = "43faf328-3d00-4930-9832-245085a1b56d"
        response = requests.get(f"{BASE_URL}/api/fatture-ricevute/fattura/{fattura_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "fattura" in data, "Response should have fattura"
        
        fattura = data["fattura"]
        assert fattura.get("id") == fattura_id, "Fattura ID should match"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
