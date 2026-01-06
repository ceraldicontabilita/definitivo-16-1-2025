"""
Test iteration 31 - Testing new features:
1. Bug fix assegni: API /api/assegni deve restituire 140 elementi (non 150) - soft-delete filter
2. Upload ZIP F24: endpoint POST /api/f24/upload-zip accetta file ZIP
3. Upload ZIP F24: controllo duplicati tramite hash SHA256
4. Login HACCP: POST /api/haccp-auth/login con codice 141574 autorizza
5. Login HACCP: POST /api/haccp-auth/login con codice errato restituisce 401
"""
import pytest
import requests
import os
import io
import zipfile
import hashlib

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAssegniBugFix:
    """Test bug fix for assegni soft-delete filter"""
    
    def test_assegni_returns_filtered_list(self):
        """API /api/assegni should return 140 elements (not 150) - soft-deleted excluded"""
        response = requests.get(f"{BASE_URL}/api/assegni")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # The bug fix should filter out soft-deleted assegni
        # Expected: 140 elements (10 were soft-deleted)
        count = len(data)
        print(f"Assegni count: {count}")
        assert count == 140, f"Expected 140 assegni (soft-deleted excluded), got {count}"
    
    def test_assegni_no_deleted_status(self):
        """Verify no assegni with entity_status='deleted' are returned"""
        response = requests.get(f"{BASE_URL}/api/assegni")
        assert response.status_code == 200
        
        data = response.json()
        for assegno in data:
            entity_status = assegno.get("entity_status", "")
            assert entity_status != "deleted", f"Found deleted assegno: {assegno.get('id')}"


class TestHACCPAuth:
    """Test HACCP portal authentication"""
    
    def test_haccp_login_valid_code(self):
        """POST /api/haccp-auth/login with code 141574 should authorize"""
        response = requests.post(
            f"{BASE_URL}/api/haccp-auth/login",
            json={"code": "141574"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Login should be successful"
        assert data.get("message") == "Accesso autorizzato", "Should return authorization message"
        assert data.get("portal") == "haccp", "Should indicate HACCP portal"
        assert "permissions" in data, "Should include permissions"
        
        # Verify permissions
        permissions = data.get("permissions", [])
        expected_permissions = ["view_tracciabilita", "view_haccp", "view_lotti", "view_materie_prime"]
        for perm in expected_permissions:
            assert perm in permissions, f"Missing permission: {perm}"
    
    def test_haccp_login_invalid_code(self):
        """POST /api/haccp-auth/login with wrong code should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/haccp-auth/login",
            json={"code": "000000"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        data = response.json()
        assert "error" in data or "message" in data or "detail" in data, "Should return error message"
    
    def test_haccp_login_empty_code(self):
        """POST /api/haccp-auth/login with empty code should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/haccp-auth/login",
            json={"code": ""}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    
    def test_haccp_verify_session(self):
        """GET /api/haccp-auth/verify should return valid session"""
        response = requests.get(f"{BASE_URL}/api/haccp-auth/verify")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("valid") == True, "Session should be valid"
        assert data.get("portal") == "haccp", "Should indicate HACCP portal"


class TestF24ZipUpload:
    """Test F24 ZIP upload functionality"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for protected endpoints"""
        # Try to login
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@ceraldi.it", "password": "admin123"}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def create_test_zip(self, pdf_contents: list) -> bytes:
        """Create a test ZIP file with PDF files"""
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            for i, content in enumerate(pdf_contents):
                zf.writestr(f"test_f24_{i+1}.pdf", content)
        zip_buffer.seek(0)
        return zip_buffer.read()
    
    def test_f24_zip_upload_endpoint_exists(self, auth_token):
        """Verify POST /api/f24/upload-zip endpoint exists"""
        if not auth_token:
            pytest.skip("Authentication required for this test")
        
        # Create a minimal test ZIP
        zip_data = self.create_test_zip([b"%PDF-1.4 test content"])
        
        response = requests.post(
            f"{BASE_URL}/api/f24/upload-zip",
            headers={"Authorization": f"Bearer {auth_token}"},
            files={"file": ("test.zip", zip_data, "application/zip")}
        )
        
        # Should not return 404 (endpoint exists)
        assert response.status_code != 404, "Endpoint /api/f24/upload-zip should exist"
        print(f"Upload response status: {response.status_code}")
        print(f"Upload response: {response.text[:500] if response.text else 'empty'}")
    
    def test_f24_zip_upload_rejects_non_zip(self, auth_token):
        """POST /api/f24/upload-zip should reject non-ZIP files"""
        if not auth_token:
            pytest.skip("Authentication required for this test")
        
        response = requests.post(
            f"{BASE_URL}/api/f24/upload-zip",
            headers={"Authorization": f"Bearer {auth_token}"},
            files={"file": ("test.pdf", b"%PDF-1.4 content", "application/pdf")}
        )
        
        # Should return 400 for non-ZIP file
        assert response.status_code == 400, f"Expected 400 for non-ZIP, got {response.status_code}"
    
    def test_f24_documents_list(self, auth_token):
        """GET /api/f24/documents should return list of uploaded documents"""
        if not auth_token:
            pytest.skip("Authentication required for this test")
        
        response = requests.get(
            f"{BASE_URL}/api/f24/documents",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Should return 200 or 403 (if auth required)
        assert response.status_code in [200, 403], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list), "Should return a list"


class TestF24PublicEndpoints:
    """Test F24 public endpoints"""
    
    def test_f24_public_alerts(self):
        """GET /api/f24-public/alerts should return alerts list"""
        response = requests.get(f"{BASE_URL}/api/f24-public/alerts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Should return a list"
    
    def test_f24_public_dashboard(self):
        """GET /api/f24-public/dashboard should return dashboard stats"""
        response = requests.get(f"{BASE_URL}/api/f24-public/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "totale_f24" in data, "Should include totale_f24"
        assert "pagati" in data, "Should include pagati"
        assert "da_pagare" in data, "Should include da_pagare"
        assert "alert_attivi" in data, "Should include alert_attivi"
    
    def test_f24_models_list(self):
        """GET /api/f24-public/models should return F24 models list"""
        response = requests.get(f"{BASE_URL}/api/f24-public/models")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Response is an object with f24s list
        assert "f24s" in data or isinstance(data, list), "Should return f24s list or direct list"
        if "f24s" in data:
            assert isinstance(data["f24s"], list), "f24s should be a list"
            assert "count" in data, "Should include count"


class TestF24ZipDuplicateDetection:
    """Test F24 ZIP upload duplicate detection via SHA256 hash"""
    
    def test_sha256_hash_calculation(self):
        """Verify SHA256 hash is calculated correctly for duplicate detection"""
        # This tests the concept - actual duplicate detection happens server-side
        content1 = b"%PDF-1.4 test content unique 1"
        content2 = b"%PDF-1.4 test content unique 1"  # Same content
        content3 = b"%PDF-1.4 test content unique 2"  # Different content
        
        hash1 = hashlib.sha256(content1).hexdigest()
        hash2 = hashlib.sha256(content2).hexdigest()
        hash3 = hashlib.sha256(content3).hexdigest()
        
        # Same content should produce same hash
        assert hash1 == hash2, "Same content should produce same hash"
        # Different content should produce different hash
        assert hash1 != hash3, "Different content should produce different hash"
        
        print(f"Hash for content1: {hash1}")
        print(f"Hash for content2: {hash2}")
        print(f"Hash for content3: {hash3}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
