"""
Test Iteration 32 - Gestione Riservata Features
Tests for:
1. Gestione Riservata Login (code 507488)
2. CRUD Movimenti (incassi/spese non fatturati)
3. Volume Affari Reale calculation
4. Upload multiplo PDF F24
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestGestioneRiservataLogin:
    """Test Gestione Riservata login with code 507488"""
    
    def test_login_valid_code(self):
        """Test login with valid code 507488"""
        response = requests.post(
            f"{BASE_URL}/api/gestione-riservata/login",
            json={"code": "507488"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["portal"] == "gestione_riservata"
        assert "message" in data
        print(f"✓ Login Gestione Riservata successful: {data}")
    
    def test_login_invalid_code(self):
        """Test login with invalid code"""
        response = requests.post(
            f"{BASE_URL}/api/gestione-riservata/login",
            json={"code": "123456"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "non valido" in data["detail"].lower()
        print(f"✓ Invalid code rejected correctly: {data}")
    
    def test_login_empty_code(self):
        """Test login with empty code"""
        response = requests.post(
            f"{BASE_URL}/api/gestione-riservata/login",
            json={"code": ""}
        )
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"✓ Empty code rejected correctly: {data}")


class TestGestioneRiservataMovimenti:
    """Test CRUD operations for movimenti non fatturati"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_movimento_id = None
    
    def test_create_movimento_incasso(self):
        """Test creating an incasso movimento"""
        payload = {
            "data": "2026-01-15",
            "tipo": "incasso",
            "descrizione": "TEST_Mance giornaliere test",
            "importo": 75.50,
            "categoria": "mance",
            "note": "Test incasso"
        }
        response = requests.post(
            f"{BASE_URL}/api/gestione-riservata/movimenti",
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert data["tipo"] == "incasso"
        assert data["importo"] == 75.50
        assert data["descrizione"] == "TEST_Mance giornaliere test"
        assert data["anno"] == 2026
        assert data["mese"] == 1
        assert "id" in data
        self.__class__.test_movimento_id = data["id"]
        print(f"✓ Created incasso movimento: {data['id']}")
        return data["id"]
    
    def test_create_movimento_spesa(self):
        """Test creating a spesa movimento"""
        payload = {
            "data": "2026-01-20",
            "tipo": "spesa",
            "descrizione": "TEST_Acquisto extra test",
            "importo": 30.00,
            "categoria": "acquisti",
            "note": "Test spesa"
        }
        response = requests.post(
            f"{BASE_URL}/api/gestione-riservata/movimenti",
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert data["tipo"] == "spesa"
        assert data["importo"] == 30.00
        assert "id" in data
        print(f"✓ Created spesa movimento: {data['id']}")
        return data["id"]
    
    def test_get_movimenti_list(self):
        """Test getting list of movimenti"""
        response = requests.get(
            f"{BASE_URL}/api/gestione-riservata/movimenti?anno=2026"
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} movimenti for 2026")
    
    def test_get_movimenti_filtered_by_tipo(self):
        """Test filtering movimenti by tipo"""
        response = requests.get(
            f"{BASE_URL}/api/gestione-riservata/movimenti?anno=2026&tipo=incasso"
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for mov in data:
            assert mov["tipo"] == "incasso"
        print(f"✓ Got {len(data)} incassi for 2026")
    
    def test_update_movimento(self):
        """Test updating a movimento"""
        # First create a movimento
        create_payload = {
            "data": "2026-02-01",
            "tipo": "incasso",
            "descrizione": "TEST_Update test original",
            "importo": 50.00,
            "categoria": "altro"
        }
        create_res = requests.post(
            f"{BASE_URL}/api/gestione-riservata/movimenti",
            json=create_payload
        )
        assert create_res.status_code == 200
        mov_id = create_res.json()["id"]
        
        # Update it
        update_payload = {
            "descrizione": "TEST_Update test modified",
            "importo": 75.00
        }
        update_res = requests.put(
            f"{BASE_URL}/api/gestione-riservata/movimenti/{mov_id}",
            json=update_payload
        )
        assert update_res.status_code == 200
        data = update_res.json()
        assert data["descrizione"] == "TEST_Update test modified"
        assert data["importo"] == 75.00
        print(f"✓ Updated movimento {mov_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/gestione-riservata/movimenti/{mov_id}")
    
    def test_delete_movimento(self):
        """Test soft-deleting a movimento"""
        # First create a movimento
        create_payload = {
            "data": "2026-02-05",
            "tipo": "spesa",
            "descrizione": "TEST_Delete test",
            "importo": 25.00,
            "categoria": "altro"
        }
        create_res = requests.post(
            f"{BASE_URL}/api/gestione-riservata/movimenti",
            json=create_payload
        )
        assert create_res.status_code == 200
        mov_id = create_res.json()["id"]
        
        # Delete it
        delete_res = requests.delete(
            f"{BASE_URL}/api/gestione-riservata/movimenti/{mov_id}"
        )
        assert delete_res.status_code == 200
        data = delete_res.json()
        assert data["success"] == True
        print(f"✓ Deleted movimento {mov_id}")
    
    def test_get_riepilogo(self):
        """Test getting riepilogo totali"""
        response = requests.get(
            f"{BASE_URL}/api/gestione-riservata/riepilogo?anno=2026"
        )
        assert response.status_code == 200
        data = response.json()
        assert "incassi" in data
        assert "spese" in data
        assert "saldo_netto" in data
        assert "totale" in data["incassi"]
        assert "count" in data["incassi"]
        print(f"✓ Riepilogo 2026: Incassi={data['incassi']['totale']}, Spese={data['spese']['totale']}, Saldo={data['saldo_netto']}")


class TestVolumeAffariReale:
    """Test Volume Affari Reale calculation"""
    
    def test_get_volume_affari_reale_2026(self):
        """Test getting volume affari reale for 2026"""
        response = requests.get(
            f"{BASE_URL}/api/gestione-riservata/volume-affari-reale?anno=2026"
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data["anno"] == 2026
        assert "fatturato_ufficiale" in data
        assert "corrispettivi" in data
        assert "totale_ufficiale" in data
        assert "incassi_non_fatturati" in data
        assert "spese_non_fatturate" in data
        assert "saldo_extra" in data
        assert "volume_affari_reale" in data
        
        # Verify calculation logic
        expected_totale_ufficiale = data["fatturato_ufficiale"] + data["corrispettivi"]
        assert data["totale_ufficiale"] == expected_totale_ufficiale
        
        expected_saldo_extra = data["incassi_non_fatturati"] - data["spese_non_fatturate"]
        assert data["saldo_extra"] == expected_saldo_extra
        
        expected_volume_reale = data["totale_ufficiale"] + data["saldo_extra"]
        assert data["volume_affari_reale"] == expected_volume_reale
        
        print(f"✓ Volume Affari Reale 2026:")
        print(f"  - Fatturato Ufficiale: €{data['fatturato_ufficiale']}")
        print(f"  - Corrispettivi: €{data['corrispettivi']}")
        print(f"  - Totale Ufficiale: €{data['totale_ufficiale']}")
        print(f"  - Incassi Extra: €{data['incassi_non_fatturati']}")
        print(f"  - Spese Extra: €{data['spese_non_fatturate']}")
        print(f"  - Volume Reale: €{data['volume_affari_reale']}")
    
    def test_volume_affari_reale_with_month(self):
        """Test volume affari reale filtered by month"""
        response = requests.get(
            f"{BASE_URL}/api/gestione-riservata/volume-affari-reale?anno=2026&mese=1"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["anno"] == 2026
        assert data["mese"] == 1
        print(f"✓ Volume Affari Reale Gennaio 2026: €{data['volume_affari_reale']}")
    
    def test_volume_affari_reale_missing_anno(self):
        """Test volume affari reale without required anno parameter"""
        response = requests.get(
            f"{BASE_URL}/api/gestione-riservata/volume-affari-reale"
        )
        # Should return 422 for missing required parameter
        assert response.status_code == 422
        print("✓ Missing anno parameter correctly rejected")


class TestF24UploadMultiple:
    """Test F24 multiple PDF upload endpoint"""
    
    def test_upload_multiple_endpoint_exists(self):
        """Test that upload-multiple endpoint exists (requires auth)"""
        # Without auth, should return 403
        response = requests.post(
            f"{BASE_URL}/api/f24/upload-multiple",
            files=[]
        )
        # Endpoint exists but requires authentication
        assert response.status_code in [403, 422]  # 403 = no auth, 422 = no files
        print(f"✓ Upload multiple endpoint exists (status: {response.status_code})")
    
    def test_f24_documents_list(self):
        """Test getting F24 documents list (requires auth)"""
        response = requests.get(f"{BASE_URL}/api/f24/documents")
        # Should require auth
        assert response.status_code in [200, 403]
        print(f"✓ F24 documents endpoint status: {response.status_code}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_movimenti(self):
        """Clean up TEST_ prefixed movimenti"""
        # Get all movimenti
        response = requests.get(
            f"{BASE_URL}/api/gestione-riservata/movimenti?anno=2026"
        )
        if response.status_code == 200:
            movimenti = response.json()
            deleted_count = 0
            for mov in movimenti:
                if mov.get("descrizione", "").startswith("TEST_"):
                    del_res = requests.delete(
                        f"{BASE_URL}/api/gestione-riservata/movimenti/{mov['id']}"
                    )
                    if del_res.status_code == 200:
                        deleted_count += 1
            print(f"✓ Cleaned up {deleted_count} test movimenti")
        else:
            print("✓ No cleanup needed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
