#!/usr/bin/env python3
"""
Backend API Testing Suite - Post Refactoring
Tests all main APIs after the router refactoring that eliminated 58 duplicate files.
"""

import requests
import json
import sys
from datetime import datetime
from typing import Dict, Any, List

# Backend URL from frontend .env
BACKEND_URL = "https://invoice-flow-64.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.results = {}
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
    
    def log_result(self, test_name: str, success: bool, response_data: Any = None, error: str = None):
        """Log test result"""
        self.results[test_name] = {
            'success': success,
            'timestamp': datetime.now().isoformat(),
            'response_data': response_data,
            'error': error
        }
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if error:
            print(f"   Error: {error}")
        if response_data and isinstance(response_data, dict):
            if 'count' in response_data:
                print(f"   Count: {response_data['count']}")
            elif isinstance(response_data, list):
                print(f"   Items: {len(response_data)}")
    
    def test_api_endpoint(self, endpoint: str, test_name: str, expected_fields: List[str] = None, min_count: int = None):
        """Generic API endpoint tester"""
        try:
            url = f"{BACKEND_URL}{endpoint}"
            print(f"\n🔍 Testing: {url}")
            
            response = self.session.get(url, timeout=30)
            
            if response.status_code != 200:
                self.log_result(test_name, False, None, f"HTTP {response.status_code}: {response.text}")
                return False
            
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                self.log_result(test_name, False, None, f"Invalid JSON response: {e}")
                return False
            
            # Check expected fields if provided
            if expected_fields and isinstance(data, dict):
                missing_fields = [field for field in expected_fields if field not in data]
                if missing_fields:
                    self.log_result(test_name, False, data, f"Missing fields: {missing_fields}")
                    return False
            
            # Check minimum count if provided
            if min_count is not None:
                if isinstance(data, list):
                    actual_count = len(data)
                elif isinstance(data, dict) and 'data' in data:
                    actual_count = len(data['data']) if isinstance(data['data'], list) else 0
                elif isinstance(data, dict) and 'dipendenti' in data:
                    actual_count = len(data['dipendenti']) if isinstance(data['dipendenti'], list) else 0
                else:
                    actual_count = 0
                
                if actual_count < min_count:
                    self.log_result(test_name, False, data, f"Expected at least {min_count} items, got {actual_count}")
                    return False
            
            self.log_result(test_name, True, data)
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, None, f"Request failed: {e}")
            return False
        except Exception as e:
            self.log_result(test_name, False, None, f"Unexpected error: {e}")
            return False
    
    def run_all_tests(self):
        """Run all backend API tests"""
        print("=" * 80)
        print("🚀 BACKEND API TESTING SUITE - POST REFACTORING")
        print("=" * 80)
        
        # 1. Dipendenti API - Should return 22 employees
        self.test_api_endpoint(
            "/dipendenti",
            "Dipendenti API",
            min_count=22
        )
        
        # 2. Fatture API - 2025 invoices
        self.test_api_endpoint(
            "/invoices?anno=2025",
            "Fatture API 2025"
        )
        
        # 3. Prima Nota - Cassa 2025
        self.test_api_endpoint(
            "/prima-nota/cassa?anno=2025",
            "Prima Nota Cassa 2025"
        )
        
        # 4. Prima Nota - Banca 2025
        self.test_api_endpoint(
            "/prima-nota/banca?anno=2025",
            "Prima Nota Banca 2025"
        )
        
        # 5. Estratto Conto 2025 - Correct endpoint
        self.test_api_endpoint(
            "/estratto-conto-movimenti/movimenti?anno=2025",
            "Estratto Conto 2025"
        )
        
        # 6. Operazioni da Confermare 2025 - Should return statistics (correct method)
        self.test_api_endpoint(
            "/operazioni-da-confermare/lista?anno=2025",
            "Operazioni da Confermare 2025"
        )
        
        # 7. Previsioni Acquisti - Statistiche 2025
        self.test_api_endpoint(
            "/previsioni-acquisti/statistiche?anno=2025",
            "Previsioni Acquisti Statistiche 2025"
        )
        
        # 8. Previsioni Acquisti - Previsioni 2025
        self.test_api_endpoint(
            "/previsioni-acquisti/previsioni?anno_riferimento=2025",
            "Previsioni Acquisti Previsioni 2025"
        )
        
        # 9. Assegni API
        self.test_api_endpoint(
            "/assegni",
            "Assegni API"
        )
        
        # 10. HACCP Temperature - Correct endpoint (requires auth, test without auth first)
        self.test_api_endpoint(
            "/haccp/temperatures",
            "HACCP Temperature"
        )
        
        # 11. F24 API - Test public models endpoint
        self.test_api_endpoint(
            "/f24-public/models",
            "F24 Public Models"
        )
        
        # Additional health checks
        self.test_api_endpoint(
            "/health",
            "Health Check"
        )
        
        print("\n" + "=" * 80)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.results)
        passed_tests = sum(1 for result in self.results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n🔍 FAILED TESTS:")
            for test_name, result in self.results.items():
                if not result['success']:
                    print(f"  ❌ {test_name}: {result['error']}")
        
        print("\n" + "=" * 80)
        
        return failed_tests == 0

def main():
    """Main test runner"""
    tester = BackendTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/test_results_backend.json', 'w') as f:
        json.dump(tester.results, f, indent=2, default=str)
    
    print(f"\n📄 Detailed results saved to: /app/test_results_backend.json")
    
    if success:
        print("🎉 ALL TESTS PASSED! Backend APIs are working correctly after refactoring.")
        sys.exit(0)
    else:
        print("⚠️  SOME TESTS FAILED! Check the results above for details.")
        sys.exit(1)

if __name__ == "__main__":
    main()