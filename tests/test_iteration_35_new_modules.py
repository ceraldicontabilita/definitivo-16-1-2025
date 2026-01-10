"""
Test Iteration 35 - New Modules Integration
Tests for:
1. codici_tributo_f24.py - F24 tax codes database
2. libro_unico_parser.py - Zucchetti payslip PDF parser
3. buste_paga.py router - Payslip upload and management API
4. comparatore.py router - Price comparator API
"""
import pytest
import requests
import os
import sys

# Add app to path for direct imports
sys.path.insert(0, '/app')

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://haccp-backend-repair.preview.emergentagent.com').rstrip('/')


class TestCodiciTributoF24:
    """Test codici_tributo_f24.py service - F24 tax codes database"""
    
    def test_get_codice_info_known_code(self):
        """Test get_codice_info with known code 1001"""
        from app.services.codici_tributo_f24 import get_codice_info
        
        info = get_codice_info("1001")
        assert info is not None
        assert "descrizione" in info
        assert "Ritenute su retribuzioni" in info["descrizione"]
        assert info["tipo"] == "misto"
        assert info["sezione"] == "ERARIO"
    
    def test_get_codice_info_unknown_code(self):
        """Test get_codice_info with unknown code returns default"""
        from app.services.codici_tributo_f24 import get_codice_info
        
        info = get_codice_info("9999")
        assert info is not None
        assert info["tipo"] == "unknown"
        assert info["sezione"] == "UNKNOWN"
    
    def test_get_descrizione_tributo(self):
        """Test get_descrizione_tributo function"""
        from app.services.codici_tributo_f24 import get_descrizione_tributo
        
        desc = get_descrizione_tributo("6001")
        assert "IVA" in desc
        assert "gennaio" in desc.lower()
    
    def test_get_tipo_tributo(self):
        """Test get_tipo_tributo function"""
        from app.services.codici_tributo_f24 import get_tipo_tributo
        
        tipo = get_tipo_tributo("1631")
        assert tipo == "credito"
        
        tipo = get_tipo_tributo("6001")
        assert tipo == "debito"
    
    def test_get_sezione_tributo(self):
        """Test get_sezione_tributo function"""
        from app.services.codici_tributo_f24 import get_sezione_tributo
        
        sezione = get_sezione_tributo("5100")
        assert sezione == "INPS"
        
        sezione = get_sezione_tributo("3800")
        assert sezione == "REGIONI"
    
    def test_get_codici_by_sezione(self):
        """Test get_codici_by_sezione function"""
        from app.services.codici_tributo_f24 import get_codici_by_sezione
        
        codici_erario = get_codici_by_sezione("ERARIO")
        assert len(codici_erario) > 0
        assert "1001" in codici_erario
        assert "6001" in codici_erario
        
        codici_inps = get_codici_by_sezione("INPS")
        assert len(codici_inps) > 0
        assert "5100" in codici_inps
    
    def test_cerca_codice_tributo(self):
        """Test cerca_codice_tributo search function"""
        from app.services.codici_tributo_f24 import cerca_codice_tributo
        
        # Search by description
        results = cerca_codice_tributo("IVA")
        assert len(results) > 0
        assert all("IVA" in r["descrizione"].upper() for r in results)
        
        # Search by code
        results = cerca_codice_tributo("1001")
        assert len(results) >= 1
        assert any(r["codice"] == "1001" for r in results)
    
    def test_get_all_codici(self):
        """Test get_all_codici returns all codes"""
        from app.services.codici_tributo_f24 import get_all_codici
        
        all_codici = get_all_codici()
        assert len(all_codici) >= 40  # Should have at least 40 codes
        
        # Verify structure
        for codice in all_codici:
            assert "codice" in codice
            assert "descrizione" in codice
            assert "tipo" in codice
            assert "sezione" in codice


class TestLibroUnicoParser:
    """Test libro_unico_parser.py service - PDF parsing utilities"""
    
    def test_safe_float(self):
        """Test safe_float conversion"""
        from app.services.libro_unico_parser import safe_float
        
        # Note: safe_float replaces comma with dot, handles simple formats
        assert safe_float("100,50") == 100.50
        assert safe_float("invalid") == 0.0
        assert safe_float("", 10.0) == 10.0
        assert safe_float("1234.56") == 1234.56
    
    def test_safe_int(self):
        """Test safe_int conversion"""
        from app.services.libro_unico_parser import safe_int
        
        assert safe_int("123") == 123
        assert safe_int("invalid") == 0
        assert safe_int("", 5) == 5
    
    def test_normalize_date(self):
        """Test normalize_date function"""
        from app.services.libro_unico_parser import normalize_date
        
        assert normalize_date("15/01/2025") == "2025-01-15"
        assert normalize_date("15-01-2025") == "2025-01-15"
        assert normalize_date("15/01/25") == "2025-01-15"
        assert normalize_date(None) is None
        assert normalize_date("invalid") is None
    
    def test_extract_competenza_month(self):
        """Test extract_competenza_month function"""
        from app.services.libro_unico_parser import extract_competenza_month
        
        # Test with date range
        text = "dal 01/12/2025 al 31/12/2025"
        month, high_conf = extract_competenza_month(text)
        assert month == "2025-12"
        assert high_conf is True
        
        # Test with competenza keyword
        text = "competenza: 11/2025"
        month, high_conf = extract_competenza_month(text)
        assert month == "2025-11"
        assert high_conf is True
        
        # Test with Italian month name
        text = "periodo di paga gennaio 2025"
        month, high_conf = extract_competenza_month(text)
        assert month == "2025-01"
    
    def test_detect_pdf_type(self):
        """Test detect_pdf_type function"""
        from app.services.libro_unico_parser import detect_pdf_type
        
        # Test amministratore detection
        text = "Compenso Amministratore *000003"
        assert detect_pdf_type(text) == "amministratore"
        
        # Test dipendente detection
        text = "COGNOME NOME INDIRIZZO"
        assert detect_pdf_type(text) == "dipendente"
    
    def test_parsing_error_exception(self):
        """Test ParsingError exception"""
        from app.services.libro_unico_parser import ParsingError
        
        with pytest.raises(ParsingError):
            raise ParsingError("Test error")


class TestBustePagaAPI:
    """Test buste_paga.py router - Payslip API endpoints"""
    
    def test_upload_without_file(self):
        """Test upload endpoint returns error without file"""
        response = requests.post(f"{BASE_URL}/api/buste-paga/upload")
        # Should return 422 (validation error) because file is required
        assert response.status_code == 422
    
    def test_upload_non_pdf_file(self):
        """Test upload endpoint rejects non-PDF files"""
        files = {'file': ('test.txt', b'test content', 'text/plain')}
        response = requests.post(f"{BASE_URL}/api/buste-paga/upload", files=files)
        assert response.status_code == 400
        data = response.json()
        # Error message can be in 'detail' or 'message' field
        error_msg = data.get("detail", "") or data.get("message", "")
        assert "PDF" in error_msg
    
    def test_lista_competenze(self):
        """Test GET /api/buste-paga/competenze endpoint"""
        response = requests.get(f"{BASE_URL}/api/buste-paga/competenze")
        assert response.status_code == 200
        data = response.json()
        assert "competenze" in data
        assert isinstance(data["competenze"], list)
    
    def test_riepilogo_mensile(self):
        """Test GET /api/buste-paga/riepilogo-mensile/{competenza} endpoint"""
        response = requests.get(f"{BASE_URL}/api/buste-paga/riepilogo-mensile/2025-12")
        assert response.status_code == 200
        data = response.json()
        assert "competenza" in data
        assert data["competenza"] == "2025-12"
        assert "dipendenti" in data
        assert "totale_netto" in data
        assert "totale_acconti" in data
        assert "totale_differenza" in data
        assert "totale_ore" in data
        assert "buste" in data
    
    def test_lista_buste_paga(self):
        """Test GET /api/buste-paga/lista endpoint"""
        response = requests.get(f"{BASE_URL}/api/buste-paga/lista")
        assert response.status_code == 200
        data = response.json()
        assert "buste_paga" in data
        assert "count" in data
        assert isinstance(data["buste_paga"], list)
    
    def test_lista_buste_paga_with_filters(self):
        """Test GET /api/buste-paga/lista with filters"""
        response = requests.get(f"{BASE_URL}/api/buste-paga/lista?competenza=2025-12&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "buste_paga" in data


class TestComparatoreAPI:
    """Test comparatore.py router - Price comparator API endpoints"""
    
    def test_comparatore_root(self):
        """Test GET /api/comparatore/ root endpoint"""
        response = requests.get(f"{BASE_URL}/api/comparatore/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "Comparatore" in data["message"]
    
    def test_get_suppliers(self):
        """Test GET /api/comparatore/suppliers endpoint"""
        response = requests.get(f"{BASE_URL}/api/comparatore/suppliers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_products_search(self):
        """Test GET /api/comparatore/products with search"""
        response = requests.get(f"{BASE_URL}/api/comparatore/products?search=latte")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_products_no_search(self):
        """Test GET /api/comparatore/products without search"""
        response = requests.get(f"{BASE_URL}/api/comparatore/products")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_cart(self):
        """Test GET /api/comparatore/cart endpoint"""
        response = requests.get(f"{BASE_URL}/api/comparatore/cart")
        assert response.status_code == 200
        data = response.json()
        assert "by_supplier" in data
        assert "total_items" in data
        assert "total_amount" in data
    
    def test_get_invoices(self):
        """Test GET /api/comparatore/invoices endpoint"""
        response = requests.get(f"{BASE_URL}/api/comparatore/invoices")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_unmapped_products(self):
        """Test GET /api/comparatore/unmapped-products endpoint"""
        response = requests.get(f"{BASE_URL}/api/comparatore/unmapped-products")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_mapped_products(self):
        """Test GET /api/comparatore/mapped-products endpoint"""
        response = requests.get(f"{BASE_URL}/api/comparatore/mapped-products")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_excluded_suppliers(self):
        """Test GET /api/comparatore/excluded-suppliers endpoint"""
        response = requests.get(f"{BASE_URL}/api/comparatore/excluded-suppliers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_cart_add_and_remove(self):
        """Test cart add and remove flow"""
        # Add item to cart
        item = {
            "normalized_name": "TEST_PRODUCT",
            "original_description": "Test product description",
            "supplier_name": "TEST_SUPPLIER",
            "price": 10.50,
            "unit": "PZ",
            "quantity": 2
        }
        response = requests.post(f"{BASE_URL}/api/comparatore/cart/add", json=item)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "item" in data
        item_id = data["item"]["id"]
        
        # Verify item in cart
        response = requests.get(f"{BASE_URL}/api/comparatore/cart")
        assert response.status_code == 200
        cart_data = response.json()
        assert cart_data["total_items"] >= 1
        
        # Remove item from cart
        response = requests.delete(f"{BASE_URL}/api/comparatore/cart/{item_id}")
        assert response.status_code == 200
        assert response.json()["success"] is True
    
    def test_map_product(self):
        """Test POST /api/comparatore/map-product endpoint"""
        data = {
            "original_description": "TEST_ORIGINAL_DESC_12345",
            "normalized_name": "TEST NORMALIZED NAME"
        }
        response = requests.post(f"{BASE_URL}/api/comparatore/map-product", json=data)
        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        assert result["original"] == data["original_description"]
        assert result["normalized"] == data["normalized_name"].upper()
    
    def test_exclude_supplier(self):
        """Test POST /api/comparatore/exclude-supplier endpoint"""
        # Exclude supplier
        data = {"supplier_name": "TEST_EXCLUDED_SUPPLIER", "exclude": True}
        response = requests.post(f"{BASE_URL}/api/comparatore/exclude-supplier", json=data)
        assert response.status_code == 200
        assert response.json()["success"] is True
        
        # Re-include supplier
        data = {"supplier_name": "TEST_EXCLUDED_SUPPLIER", "exclude": False}
        response = requests.post(f"{BASE_URL}/api/comparatore/exclude-supplier", json=data)
        assert response.status_code == 200
        assert response.json()["success"] is True


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    
    def test_root_endpoint(self):
        """Test root endpoint"""
        response = requests.get(f"{BASE_URL}/")
        assert response.status_code == 200


# Cleanup fixture
@pytest.fixture(scope="class", autouse=True)
def cleanup_test_data():
    """Cleanup test data after tests"""
    yield
    # Cleanup cart items with TEST_ prefix
    try:
        response = requests.delete(f"{BASE_URL}/api/comparatore/cart")
        print(f"Cart cleanup: {response.status_code}")
    except Exception as e:
        print(f"Cleanup error: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
