"""
Test Iteration 28 - Contabilità Analitica Features
Tests for:
- Centri di Costo page and endpoints
- Ricette page (90 ricette)
- Magazzino Doppia Verità (5338 prodotti)
- Utile Obiettivo (2024 data)
- Ribaltamento CDC endpoint
- Collega vendite-ricette endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCentriCosto:
    """Test Centri di Costo endpoints"""
    
    def test_list_centri_costo(self):
        """Test GET /api/centri-costo/centri-costo returns list of CDC"""
        response = requests.get(f"{BASE_URL}/api/centri-costo/centri-costo")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one centro di costo"
        
        # Verify structure of first CDC
        first_cdc = data[0]
        assert "codice" in first_cdc, "CDC should have codice"
        assert "nome" in first_cdc, "CDC should have nome"
        assert "tipo" in first_cdc, "CDC should have tipo"
        print(f"✓ Found {len(data)} centri di costo")
        
        # Check for expected CDC types
        tipi = set(c.get("tipo") for c in data)
        print(f"✓ CDC types found: {tipi}")
    
    def test_mapping_categorie(self):
        """Test GET /api/centri-costo/mapping-categorie"""
        response = requests.get(f"{BASE_URL}/api/centri-costo/mapping-categorie")
        assert response.status_code == 200
        
        data = response.json()
        assert "categoria_to_cdc" in data, "Should have categoria_to_cdc mapping"
        assert "fornitore_to_cdc" in data, "Should have fornitore_to_cdc mapping"
        assert "cdc_standard" in data, "Should have cdc_standard"
        print(f"✓ Mapping categorie: {len(data['categoria_to_cdc'])} categorie, {len(data['fornitore_to_cdc'])} fornitori")
    
    def test_ribaltamento_chiavi(self):
        """Test GET /api/centri-costo/ribaltamento/chiavi"""
        response = requests.get(f"{BASE_URL}/api/centri-costo/ribaltamento/chiavi")
        assert response.status_code == 200
        
        data = response.json()
        assert "chiavi" in data, "Should have chiavi"
        assert "centri_supporto" in data, "Should have centri_supporto"
        assert "centri_operativi" in data, "Should have centri_operativi"
        print(f"✓ Chiavi ribaltamento: {len(data['chiavi'])} chiavi configurate")
    
    def test_ribaltamento_calcola_2024(self):
        """Test POST /api/centri-costo/ribaltamento/calcola?anno=2024"""
        response = requests.post(f"{BASE_URL}/api/centri-costo/ribaltamento/calcola?anno=2024")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "anno" in data, "Should have anno"
        assert data["anno"] == 2024, "Anno should be 2024"
        assert "ribaltamenti" in data, "Should have ribaltamenti"
        assert "margini_per_cdc" in data, "Should have margini_per_cdc"
        assert "sintesi" in data, "Should have sintesi"
        
        print(f"✓ Ribaltamento 2024 calcolato:")
        print(f"  - Ribaltamenti: {len(data['ribaltamenti'])}")
        print(f"  - Margini CDC: {len(data['margini_per_cdc'])}")
        if data.get("sintesi"):
            print(f"  - Ricavi totali: €{data['sintesi'].get('ricavi_totali', 0):,.2f}")
            print(f"  - Costi diretti: €{data['sintesi'].get('costi_diretti_totali', 0):,.2f}")


class TestUtileObiettivo:
    """Test Utile Obiettivo endpoints"""
    
    def test_get_utile_obiettivo_2024(self):
        """Test GET /api/centri-costo/utile-obiettivo?anno=2024"""
        response = requests.get(f"{BASE_URL}/api/centri-costo/utile-obiettivo?anno=2024")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "anno" in data, "Should have anno"
        assert data["anno"] == 2024, "Anno should be 2024"
        assert "target" in data, "Should have target"
        assert "reale" in data, "Should have reale"
        assert "analisi" in data, "Should have analisi"
        
        print(f"✓ Utile Obiettivo 2024:")
        print(f"  - Target utile annuo: €{data['target'].get('utile_target_annuo', 0):,.2f}")
        print(f"  - Ricavi totali: €{data['reale'].get('ricavi_totali', 0):,.2f}")
        print(f"  - Costi totali: €{data['reale'].get('costi_totali', 0):,.2f}")
        print(f"  - Utile corrente: €{data['reale'].get('utile_corrente', 0):,.2f}")
        print(f"  - % Raggiungimento: {data['analisi'].get('percentuale_raggiungimento', 0):.1f}%")
    
    def test_utile_obiettivo_per_cdc_2024(self):
        """Test GET /api/centri-costo/utile-obiettivo/per-cdc?anno=2024"""
        response = requests.get(f"{BASE_URL}/api/centri-costo/utile-obiettivo/per-cdc?anno=2024")
        assert response.status_code == 200
        
        data = response.json()
        assert "anno" in data, "Should have anno"
        assert "centri_costo" in data, "Should have centri_costo"
        assert "totali" in data, "Should have totali"
        
        print(f"✓ Utile per CDC 2024: {len(data['centri_costo'])} centri")
    
    def test_utile_obiettivo_suggerimenti_2024(self):
        """Test GET /api/centri-costo/utile-obiettivo/suggerimenti?anno=2024"""
        response = requests.get(f"{BASE_URL}/api/centri-costo/utile-obiettivo/suggerimenti?anno=2024")
        assert response.status_code == 200
        
        data = response.json()
        assert "anno" in data, "Should have anno"
        assert "suggerimenti" in data, "Should have suggerimenti"
        assert "priorita" in data, "Should have priorita"
        
        print(f"✓ Suggerimenti 2024: {len(data['suggerimenti'])} suggerimenti, priorità: {data['priorita']}")


class TestRicette:
    """Test Ricette endpoints - should have 90 ricette"""
    
    def test_list_ricette(self):
        """Test GET /api/ricette returns 90 ricette"""
        response = requests.get(f"{BASE_URL}/api/ricette")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "ricette" in data, "Should have ricette key"
        assert "totale" in data, "Should have totale key"
        
        totale = data.get("totale", 0)
        assert totale == 90, f"Expected 90 ricette, got {totale}"
        
        print(f"✓ Ricette totali: {totale}")
        if data.get("per_categoria"):
            print(f"  - Per categoria: {data['per_categoria']}")
    
    def test_ricette_categorie(self):
        """Test GET /api/ricette/categorie"""
        response = requests.get(f"{BASE_URL}/api/ricette/categorie")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Should return list of categories"
        print(f"✓ Categorie ricette: {data}")
    
    def test_ricette_search(self):
        """Test ricette search functionality"""
        response = requests.get(f"{BASE_URL}/api/ricette?search=torta")
        assert response.status_code == 200
        
        data = response.json()
        ricette = data.get("ricette", [])
        print(f"✓ Search 'torta': {len(ricette)} risultati")


class TestMagazzinoDoppiaVerita:
    """Test Magazzino Doppia Verità - should have 5338 prodotti"""
    
    def test_list_prodotti(self):
        """Test GET /api/magazzino-dv/prodotti returns products"""
        response = requests.get(f"{BASE_URL}/api/magazzino-dv/prodotti?limit=200")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "prodotti" in data, "Should have prodotti key"
        assert "statistiche" in data, "Should have statistiche key"
        
        stats = data.get("statistiche", {})
        totale = stats.get("totale_prodotti", 0)
        
        # Should have 5338 products
        assert totale == 5338, f"Expected 5338 prodotti, got {totale}"
        
        print(f"✓ Magazzino DV prodotti: {totale}")
        print(f"  - Valore teorico: €{stats.get('valore_teorico', 0):,.2f}")
        print(f"  - Valore reale: €{stats.get('valore_reale', 0):,.2f}")
        print(f"  - Differenza: €{stats.get('differenza_valore', 0):,.2f}")
    
    def test_prodotti_con_differenze(self):
        """Test filtering products with differences"""
        response = requests.get(f"{BASE_URL}/api/magazzino-dv/prodotti?solo_differenze=true&limit=50")
        assert response.status_code == 200
        
        data = response.json()
        prodotti = data.get("prodotti", [])
        print(f"✓ Prodotti con differenze: {len(prodotti)}")
    
    def test_prodotti_scorte_basse(self):
        """Test filtering products with low stock"""
        response = requests.get(f"{BASE_URL}/api/magazzino-dv/prodotti?solo_scorte_basse=true&limit=50")
        assert response.status_code == 200
        
        data = response.json()
        prodotti = data.get("prodotti", [])
        print(f"✓ Prodotti scorte basse: {len(prodotti)}")


class TestCorrispettiviCollegamento:
    """Test collegamento vendite-ricette"""
    
    def test_collega_vendite_ricette_2024(self):
        """Test POST /api/corrispettivi/collega-vendite-ricette"""
        response = requests.post(
            f"{BASE_URL}/api/corrispettivi/collega-vendite-ricette",
            params={"data_da": "2024-01-01", "data_a": "2024-12-31"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "periodo" in data, "Should have periodo"
        assert "totale_incasso" in data, "Should have totale_incasso"
        assert "corrispettivi_count" in data, "Should have corrispettivi_count"
        
        print(f"✓ Collegamento vendite-ricette 2024:")
        print(f"  - Periodo: {data['periodo']}")
        print(f"  - Totale incasso: €{data.get('totale_incasso', 0):,.2f}")
        print(f"  - Corrispettivi: {data.get('corrispettivi_count', 0)}")
        print(f"  - Porzioni stimate: {data.get('porzioni_totali_stimate', 0)}")
    
    def test_corrispettivi_list_2024(self):
        """Test GET /api/corrispettivi with 2024 date filter"""
        response = requests.get(
            f"{BASE_URL}/api/corrispettivi",
            params={"data_da": "2024-01-01", "data_a": "2024-12-31", "limit": 100}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Should return list"
        print(f"✓ Corrispettivi 2024: {len(data)} records")


class TestHealthAndBasics:
    """Basic health checks"""
    
    def test_api_health(self):
        """Test API is responding"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print("✓ API health check passed")
    
    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats?anno=2024")
        assert response.status_code == 200
        
        data = response.json()
        print(f"✓ Dashboard stats 2024 retrieved")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
