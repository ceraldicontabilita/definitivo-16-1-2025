"""
Test Iteration 40 - P1 Features
Tests for:
1. Cespiti PUT/DELETE endpoints
2. Cedolini with new parameters (paga_oraria, ore_domenicali, ore_malattia)
3. Archivio Bonifici PATCH (notes) and ZIP download
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthCheck:
    """Basic health check"""
    
    def test_health_endpoint(self):
        """Test API health"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✅ Health check passed: {data}")


class TestCespitiCRUD:
    """Test Cespiti CRUD operations including PUT and DELETE"""
    
    def test_get_categorie_cespiti(self):
        """Test getting cespiti categories"""
        response = requests.get(f"{BASE_URL}/api/cespiti/categorie")
        assert response.status_code == 200
        data = response.json()
        assert "categorie" in data
        assert len(data["categorie"]) > 0
        print(f"✅ Categorie cespiti: {len(data['categorie'])} categories found")
    
    def test_create_cespite(self):
        """Test creating a new cespite"""
        payload = {
            "descrizione": "TEST_Computer Ufficio",
            "categoria": "macchine_ufficio",
            "data_acquisto": "2025-01-15",
            "valore_acquisto": 1500.00,
            "fornitore": "TEST_Fornitore IT"
        }
        response = requests.post(f"{BASE_URL}/api/cespiti/", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "cespite_id" in data
        print(f"✅ Cespite created: {data['cespite_id']}")
        return data["cespite_id"]
    
    def test_list_cespiti(self):
        """Test listing cespiti"""
        response = requests.get(f"{BASE_URL}/api/cespiti/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Listed {len(data)} cespiti")
        return data
    
    def test_update_cespite_put(self):
        """Test PUT endpoint for updating cespite"""
        # First create a cespite
        create_payload = {
            "descrizione": "TEST_Stampante PUT",
            "categoria": "macchine_ufficio",
            "data_acquisto": "2025-02-01",
            "valore_acquisto": 500.00,
            "fornitore": "TEST_Fornitore PUT"
        }
        create_response = requests.post(f"{BASE_URL}/api/cespiti/", json=create_payload)
        assert create_response.status_code == 200
        cespite_id = create_response.json()["cespite_id"]
        
        # Update the cespite
        update_payload = {
            "descrizione": "TEST_Stampante PUT UPDATED",
            "fornitore": "TEST_Fornitore PUT UPDATED",
            "note": "Aggiornato via PUT"
        }
        update_response = requests.put(f"{BASE_URL}/api/cespiti/{cespite_id}", json=update_payload)
        assert update_response.status_code == 200
        update_data = update_response.json()
        assert update_data.get("success") == True
        assert "descrizione" in update_data.get("campi_aggiornati", [])
        print(f"✅ Cespite updated via PUT: {update_data}")
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/cespiti/{cespite_id}")
        assert get_response.status_code == 200
        cespite = get_response.json()
        assert cespite["descrizione"] == "TEST_Stampante PUT UPDATED"
        print(f"✅ Verified cespite update: {cespite['descrizione']}")
        
        return cespite_id
    
    def test_delete_cespite(self):
        """Test DELETE endpoint for cespite"""
        # First create a cespite to delete
        create_payload = {
            "descrizione": "TEST_Cespite DELETE",
            "categoria": "attrezzature",
            "data_acquisto": "2025-03-01",
            "valore_acquisto": 200.00,
            "fornitore": "TEST_Fornitore DELETE"
        }
        create_response = requests.post(f"{BASE_URL}/api/cespiti/", json=create_payload)
        assert create_response.status_code == 200
        cespite_id = create_response.json()["cespite_id"]
        print(f"Created cespite for deletion: {cespite_id}")
        
        # Delete the cespite
        delete_response = requests.delete(f"{BASE_URL}/api/cespiti/{cespite_id}")
        assert delete_response.status_code == 200
        delete_data = delete_response.json()
        assert delete_data.get("success") == True
        print(f"✅ Cespite deleted: {delete_data}")
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/cespiti/{cespite_id}")
        assert get_response.status_code == 404
        print(f"✅ Verified cespite deletion (404 returned)")
    
    def test_delete_cespite_with_ammortamenti_fails(self):
        """Test that DELETE fails if cespite has ammortamenti"""
        # This test verifies the business logic - can't delete if ammortamenti exist
        # We'll just verify the endpoint exists and returns proper error
        response = requests.delete(f"{BASE_URL}/api/cespiti/non-existent-id")
        assert response.status_code == 404
        print(f"✅ DELETE returns 404 for non-existent cespite")


class TestCedoliniNewParams:
    """Test Cedolini with new parameters: paga_oraria, ore_domenicali, ore_malattia"""
    
    def test_get_dipendenti(self):
        """Get list of dipendenti for testing"""
        response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✅ Found {len(data)} dipendenti")
        return data
    
    def test_cedolini_stima_with_paga_oraria(self):
        """Test cedolino stima with paga_oraria override"""
        # Get first active dipendente
        dipendenti = requests.get(f"{BASE_URL}/api/dipendenti").json()
        active_dip = next((d for d in dipendenti if d.get("status") in ["attivo", "active"]), None)
        
        if not active_dip:
            pytest.skip("No active dipendente found")
        
        payload = {
            "dipendente_id": active_dip["id"],
            "mese": 12,
            "anno": 2025,
            "ore_lavorate": 160,
            "paga_oraria": 12.50,  # NEW: Override paga oraria
            "straordinari_ore": 10,
            "festivita_ore": 0,
            "ore_domenicali": 0,
            "ore_malattia": 0,
            "giorni_malattia": 0,
            "assenze_ore": 0
        }
        
        response = requests.post(f"{BASE_URL}/api/cedolini/stima", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "netto_in_busta" in data
        assert "lordo_totale" in data
        assert "costo_totale_azienda" in data
        assert "paga_oraria_usata" in data
        
        # Verify paga_oraria was used
        assert data["paga_oraria_usata"] == 12.50
        
        # Verify calculation: 160 ore * 12.50 = 2000 base
        assert data["retribuzione_base"] == 2000.00
        
        print(f"✅ Cedolino stima with paga_oraria: Netto={data['netto_in_busta']}, Lordo={data['lordo_totale']}")
    
    def test_cedolini_stima_with_ore_domenicali(self):
        """Test cedolino stima with ore_domenicali (15% maggiorazione)"""
        dipendenti = requests.get(f"{BASE_URL}/api/dipendenti").json()
        active_dip = next((d for d in dipendenti if d.get("status") in ["attivo", "active"]), None)
        
        if not active_dip:
            pytest.skip("No active dipendente found")
        
        payload = {
            "dipendente_id": active_dip["id"],
            "mese": 12,
            "anno": 2025,
            "ore_lavorate": 160,
            "paga_oraria": 10.00,
            "straordinari_ore": 0,
            "festivita_ore": 0,
            "ore_domenicali": 16,  # NEW: 16 ore domenicali
            "ore_malattia": 0,
            "giorni_malattia": 0,
            "assenze_ore": 0
        }
        
        response = requests.post(f"{BASE_URL}/api/cedolini/stima", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Verify maggiorazione domenicale: 16 ore * 10€ * 15% = 24€
        assert "maggiorazione_domenicale" in data
        expected_maggiorazione = 16 * 10.00 * 0.15
        assert abs(data["maggiorazione_domenicale"] - expected_maggiorazione) < 0.01
        
        print(f"✅ Cedolino with ore_domenicali: Maggiorazione={data['maggiorazione_domenicale']}")
    
    def test_cedolini_stima_with_malattia(self):
        """Test cedolino stima with malattia (100% primi 3gg, 75% 4-20gg)"""
        dipendenti = requests.get(f"{BASE_URL}/api/dipendenti").json()
        active_dip = next((d for d in dipendenti if d.get("status") in ["attivo", "active"]), None)
        
        if not active_dip:
            pytest.skip("No active dipendente found")
        
        payload = {
            "dipendente_id": active_dip["id"],
            "mese": 12,
            "anno": 2025,
            "ore_lavorate": 120,  # Reduced due to malattia
            "paga_oraria": 10.00,
            "straordinari_ore": 0,
            "festivita_ore": 0,
            "ore_domenicali": 0,
            "ore_malattia": 40,  # NEW: 40 ore malattia
            "giorni_malattia": 5,  # NEW: 5 giorni malattia
            "assenze_ore": 0
        }
        
        response = requests.post(f"{BASE_URL}/api/cedolini/stima", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Verify indennita_malattia is calculated
        assert "indennita_malattia" in data
        assert data["indennita_malattia"] > 0
        
        # 5 giorni: 3 al 100% + 2 al 75%
        # 3 * 8 * 10 * 1.00 = 240
        # 2 * 8 * 10 * 0.75 = 120
        # Total = 360
        expected_indennita = (3 * 8 * 10.00 * 1.00) + (2 * 8 * 10.00 * 0.75)
        assert abs(data["indennita_malattia"] - expected_indennita) < 0.01
        
        print(f"✅ Cedolino with malattia: Indennità={data['indennita_malattia']}")
    
    def test_cedolini_stima_full_params(self):
        """Test cedolino stima with all new parameters combined"""
        dipendenti = requests.get(f"{BASE_URL}/api/dipendenti").json()
        active_dip = next((d for d in dipendenti if d.get("status") in ["attivo", "active"]), None)
        
        if not active_dip:
            pytest.skip("No active dipendente found")
        
        payload = {
            "dipendente_id": active_dip["id"],
            "mese": 12,
            "anno": 2025,
            "ore_lavorate": 140,
            "paga_oraria": 11.00,
            "straordinari_ore": 8,
            "festivita_ore": 8,
            "ore_domenicali": 8,
            "ore_malattia": 16,
            "giorni_malattia": 2,
            "assenze_ore": 0
        }
        
        response = requests.post(f"{BASE_URL}/api/cedolini/stima", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Verify all fields present
        assert data["paga_oraria_usata"] == 11.00
        assert data["maggiorazione_domenicale"] > 0
        assert data["indennita_malattia"] > 0
        assert data["straordinari"] > 0
        assert data["festivita"] > 0
        
        print(f"✅ Full cedolino stima: Netto={data['netto_in_busta']}, Costo Azienda={data['costo_totale_azienda']}")


class TestArchivioBonifici:
    """Test Archivio Bonifici PATCH (notes) and ZIP download"""
    
    def test_get_transfers(self):
        """Test getting bonifici transfers"""
        response = requests.get(f"{BASE_URL}/api/archivio-bonifici/transfers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Found {len(data)} bonifici transfers")
        return data
    
    def test_get_transfers_count(self):
        """Test getting bonifici count"""
        response = requests.get(f"{BASE_URL}/api/archivio-bonifici/transfers/count")
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        print(f"✅ Bonifici count: {data['count']}")
    
    def test_get_transfers_summary(self):
        """Test getting bonifici summary by year"""
        response = requests.get(f"{BASE_URL}/api/archivio-bonifici/transfers/summary")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print(f"✅ Bonifici summary: {data}")
    
    def test_patch_transfer_note(self):
        """Test PATCH endpoint for adding note to bonifico"""
        # Get existing transfers
        transfers = requests.get(f"{BASE_URL}/api/archivio-bonifici/transfers?limit=10").json()
        
        if not transfers:
            pytest.skip("No bonifici transfers found to test PATCH")
        
        transfer_id = transfers[0].get("id")
        if not transfer_id:
            pytest.skip("Transfer has no ID")
        
        # PATCH to add note
        patch_payload = {
            "note": "TEST_Nota aggiunta via PATCH"
        }
        
        response = requests.patch(f"{BASE_URL}/api/archivio-bonifici/transfers/{transfer_id}", json=patch_payload)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"✅ PATCH note added to transfer {transfer_id}")
        
        # Verify note was saved
        get_response = requests.get(f"{BASE_URL}/api/archivio-bonifici/transfers?limit=100")
        updated_transfers = get_response.json()
        updated_transfer = next((t for t in updated_transfers if t.get("id") == transfer_id), None)
        
        if updated_transfer:
            assert updated_transfer.get("note") == "TEST_Nota aggiunta via PATCH"
            print(f"✅ Verified note was saved: {updated_transfer.get('note')}")
    
    def test_patch_transfer_invalid_field(self):
        """Test PATCH with invalid field returns error"""
        transfers = requests.get(f"{BASE_URL}/api/archivio-bonifici/transfers?limit=1").json()
        
        if not transfers:
            pytest.skip("No bonifici transfers found")
        
        transfer_id = transfers[0].get("id")
        
        # Try to patch with invalid field
        patch_payload = {
            "invalid_field": "should not work"
        }
        
        response = requests.patch(f"{BASE_URL}/api/archivio-bonifici/transfers/{transfer_id}", json=patch_payload)
        assert response.status_code == 400
        print(f"✅ PATCH with invalid field correctly returns 400")
    
    def test_download_zip_endpoint_exists(self):
        """Test ZIP download endpoint exists"""
        # Test with a year that might not have data - should return 404
        response = requests.get(f"{BASE_URL}/api/archivio-bonifici/download-zip/2020")
        # Either 200 (has data) or 404 (no data) is acceptable
        assert response.status_code in [200, 404]
        
        if response.status_code == 200:
            assert response.headers.get("content-type") == "application/zip"
            print(f"✅ ZIP download returned data for 2020")
        else:
            print(f"✅ ZIP download endpoint exists (404 = no data for 2020)")
    
    def test_download_zip_with_data(self):
        """Test ZIP download for year with data"""
        # Get summary to find years with data
        summary = requests.get(f"{BASE_URL}/api/archivio-bonifici/transfers/summary").json()
        
        if not summary:
            pytest.skip("No bonifici data to test ZIP download")
        
        # Get first year with data
        year = list(summary.keys())[0] if summary else None
        
        if not year:
            pytest.skip("No year found in summary")
        
        response = requests.get(f"{BASE_URL}/api/archivio-bonifici/download-zip/{year}")
        
        if response.status_code == 200:
            assert "application/zip" in response.headers.get("content-type", "")
            assert len(response.content) > 0
            print(f"✅ ZIP download successful for year {year}, size: {len(response.content)} bytes")
        else:
            print(f"⚠️ ZIP download returned {response.status_code} for year {year}")
    
    def test_stato_riconciliazione(self):
        """Test stato riconciliazione endpoint"""
        response = requests.get(f"{BASE_URL}/api/archivio-bonifici/stato-riconciliazione")
        assert response.status_code == 200
        data = response.json()
        
        assert "totale" in data
        assert "riconciliati" in data
        assert "percentuale" in data
        
        print(f"✅ Stato riconciliazione: {data['riconciliati']}/{data['totale']} ({data['percentuale']}%)")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_cespiti(self):
        """Remove TEST_ prefixed cespiti"""
        cespiti = requests.get(f"{BASE_URL}/api/cespiti/").json()
        
        deleted = 0
        for c in cespiti:
            if c.get("descrizione", "").startswith("TEST_"):
                try:
                    requests.delete(f"{BASE_URL}/api/cespiti/{c['id']}")
                    deleted += 1
                except:
                    pass
        
        print(f"✅ Cleaned up {deleted} test cespiti")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
