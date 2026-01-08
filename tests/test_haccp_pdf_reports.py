"""
Test suite for HACCP PDF Report Generation endpoints.
Tests PDF generation for ASL inspections.
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://dipendenti-fix.preview.emergentagent.com').rstrip('/')


class TestHACCPPDFReports:
    """HACCP PDF Report Generation tests"""
    
    def test_completo_pdf_generation(self):
        """Test complete HACCP report PDF generation"""
        response = requests.get(f"{BASE_URL}/api/haccp-report/completo-pdf?mese=2025-01")
        
        assert response.status_code == 200
        assert response.headers.get('content-type') == 'application/pdf'
        assert 'content-disposition' in response.headers
        assert 'haccp_report_completo_2025-01.pdf' in response.headers.get('content-disposition', '')
        
        # Verify PDF content (starts with %PDF)
        assert response.content[:4] == b'%PDF'
        assert len(response.content) > 1000  # Should have substantial content
    
    def test_temperature_frigoriferi_pdf(self):
        """Test temperature frigoriferi PDF generation"""
        response = requests.get(f"{BASE_URL}/api/haccp-report/temperature-pdf?mese=2025-01&tipo=frigoriferi")
        
        assert response.status_code == 200
        assert response.headers.get('content-type') == 'application/pdf'
        assert 'haccp_temperature_frigoriferi_2025-01.pdf' in response.headers.get('content-disposition', '')
        
        # Verify PDF content
        assert response.content[:4] == b'%PDF'
    
    def test_temperature_congelatori_pdf(self):
        """Test temperature congelatori PDF generation"""
        response = requests.get(f"{BASE_URL}/api/haccp-report/temperature-pdf?mese=2025-01&tipo=congelatori")
        
        assert response.status_code == 200
        assert response.headers.get('content-type') == 'application/pdf'
        assert 'haccp_temperature_congelatori_2025-01.pdf' in response.headers.get('content-disposition', '')
        
        # Verify PDF content
        assert response.content[:4] == b'%PDF'
    
    def test_sanificazioni_pdf(self):
        """Test sanificazioni PDF generation"""
        response = requests.get(f"{BASE_URL}/api/haccp-report/sanificazioni-pdf?mese=2025-01")
        
        assert response.status_code == 200
        assert response.headers.get('content-type') == 'application/pdf'
        assert 'haccp_sanificazioni_2025-01.pdf' in response.headers.get('content-disposition', '')
        
        # Verify PDF content
        assert response.content[:4] == b'%PDF'
    
    def test_pdf_with_current_month(self):
        """Test PDF generation with current month"""
        current_month = datetime.now().strftime("%Y-%m")
        response = requests.get(f"{BASE_URL}/api/haccp-report/completo-pdf?mese={current_month}")
        
        assert response.status_code == 200
        assert response.headers.get('content-type') == 'application/pdf'
    
    def test_pdf_missing_mese_parameter(self):
        """Test PDF endpoint without required mese parameter"""
        response = requests.get(f"{BASE_URL}/api/haccp-report/completo-pdf")
        
        # Should return 422 Unprocessable Entity for missing required parameter
        assert response.status_code == 422
    
    def test_pdf_invalid_tipo_parameter(self):
        """Test temperature PDF with invalid tipo parameter"""
        response = requests.get(f"{BASE_URL}/api/haccp-report/temperature-pdf?mese=2025-01&tipo=invalid")
        
        # Should still return 200 but with empty data (defaults to frigoriferi collection)
        assert response.status_code == 200


class TestHACCPDashboardEndpoint:
    """HACCP Dashboard endpoint tests"""
    
    def test_dashboard_returns_stats(self):
        """Test HACCP dashboard returns all required stats"""
        response = requests.get(f"{BASE_URL}/api/haccp-completo/dashboard")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all required fields
        assert "moduli_attivi" in data
        assert "scadenze_imminenti" in data
        assert "conformita_percentuale" in data
        assert "temperature_registrate_mese" in data
        assert "sanificazioni_mese" in data
        
        # Verify data types
        assert isinstance(data["moduli_attivi"], int)
        assert isinstance(data["conformita_percentuale"], (int, float))
        assert isinstance(data["temperature_registrate_mese"], int)
        assert isinstance(data["sanificazioni_mese"], int)


class TestHACCPDataForPDF:
    """Test HACCP data endpoints that feed into PDF reports"""
    
    def test_temperature_frigoriferi_data(self):
        """Test temperature frigoriferi data for January 2025"""
        response = requests.get(f"{BASE_URL}/api/haccp-completo/temperature/frigoriferi?mese=2025-01")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "mese" in data
        assert "records" in data
        assert "frigoriferi" in data
        assert "count" in data
        assert data["mese"] == "2025-01"
    
    def test_temperature_congelatori_data(self):
        """Test temperature congelatori data for January 2025"""
        response = requests.get(f"{BASE_URL}/api/haccp-completo/temperature/congelatori?mese=2025-01")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "mese" in data
        assert "records" in data
        assert "congelatori" in data
        assert "count" in data
    
    def test_sanificazioni_data(self):
        """Test sanificazioni data for January 2025"""
        response = requests.get(f"{BASE_URL}/api/haccp-completo/sanificazioni?mese=2025-01")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "mese" in data
        assert "records" in data
        assert "aree" in data
        assert "count" in data


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
