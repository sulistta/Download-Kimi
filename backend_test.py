#!/usr/bin/env python3

import requests
import json
import time
import os
from datetime import datetime

# Get base URL from environment
def get_base_url():
    """Read NEXT_PUBLIC_BASE_URL from .env file"""
    env_path = "/app/.env"
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if line.startswith('NEXT_PUBLIC_BASE_URL='):
                    return line.split('=', 1)[1].strip()
    return "http://localhost:3000"  # fallback

BASE_URL = get_base_url()
API_BASE = f"{BASE_URL}/api"

print(f"Testing KimiTV Backend APIs at: {API_BASE}")
print("=" * 60)

def test_releases_endpoint():
    """Test the main /api/releases endpoint"""
    print("\n🧪 Testing GET /api/releases")
    print("-" * 40)
    
    try:
        # First request - should fetch from GitHub
        print("📡 Making first request to /api/releases...")
        response = requests.get(f"{API_BASE}/releases", timeout=30)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        try:
            data = response.json()
        except json.JSONDecodeError as e:
            print(f"❌ FAILED: Invalid JSON response: {e}")
            return False
        
        # Validate response structure
        print("📊 Validating response structure...")
        required_fields = ['releases', 'fromCache', 'rateLimited']
        for field in required_fields:
            if field not in data:
                print(f"❌ FAILED: Missing required field '{field}'")
                return False
        
        # Check releases array
        releases = data.get('releases', [])
        if not isinstance(releases, list):
            print("❌ FAILED: 'releases' should be an array")
            return False
        
        if len(releases) < 5:
            print(f"❌ FAILED: Expected at least 5 releases, got {len(releases)}")
            return False
        
        print(f"✅ Found {len(releases)} releases")
        
        # Check latest release version
        if releases:
            latest_release = releases[0]  # Assuming sorted by latest first
            tag_name = latest_release.get('tag_name', '')
            print(f"📋 Latest release: {tag_name}")
            
            if tag_name != 'v0.1.13':
                print(f"⚠️  WARNING: Expected latest version v0.1.13, got {tag_name}")
            
            # Check release structure
            required_release_fields = ['tag_name', 'published_at', 'body', 'assets']
            for field in required_release_fields:
                if field not in latest_release:
                    print(f"❌ FAILED: Latest release missing field '{field}'")
                    return False
            
            # Check assets
            assets = latest_release.get('assets', [])
            if not isinstance(assets, list):
                print("❌ FAILED: 'assets' should be an array")
                return False
            
            print(f"📦 Found {len(assets)} assets in latest release")
            
            # Check asset structure
            for i, asset in enumerate(assets[:3]):  # Check first 3 assets
                if 'browser_download_url' not in asset:
                    print(f"❌ FAILED: Asset {i+1} missing 'browser_download_url'")
                    return False
        
        # Check cache status on first request
        from_cache = data.get('fromCache', False)
        print(f"🗄️  From cache: {from_cache}")
        
        # Wait a moment and make second request to test caching
        print("\n⏳ Waiting 2 seconds and making second request to test caching...")
        time.sleep(2)
        
        response2 = requests.get(f"{API_BASE}/releases", timeout=30)
        if response2.status_code == 200:
            data2 = response2.json()
            from_cache2 = data2.get('fromCache', False)
            print(f"🗄️  Second request from cache: {from_cache2}")
            
            if not from_cache2:
                print("⚠️  WARNING: Second request should be served from cache within 5 minutes")
        
        print("✅ /api/releases endpoint working correctly")
        return True
        
    except requests.exceptions.Timeout:
        print("❌ FAILED: Request timed out")
        return False
    except requests.exceptions.ConnectionError:
        print("❌ FAILED: Connection error - is the server running?")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error: {e}")
        return False

def test_health_endpoint():
    """Test the /api/health endpoint"""
    print("\n🧪 Testing GET /api/health")
    print("-" * 40)
    
    try:
        print("📡 Making request to /api/health...")
        response = requests.get(f"{API_BASE}/health", timeout=10)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        try:
            data = response.json()
        except json.JSONDecodeError as e:
            print(f"❌ FAILED: Invalid JSON response: {e}")
            return False
        
        # Validate response structure
        print("📊 Validating response structure...")
        if 'status' not in data:
            print("❌ FAILED: Missing 'status' field")
            return False
        
        if 'timestamp' not in data:
            print("❌ FAILED: Missing 'timestamp' field")
            return False
        
        if data['status'] != 'ok':
            print(f"❌ FAILED: Expected status 'ok', got '{data['status']}'")
            return False
        
        # Validate timestamp format
        try:
            timestamp = data['timestamp']
            # Try to parse ISO format timestamp
            datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            print(f"⏰ Timestamp: {timestamp}")
        except ValueError:
            print(f"❌ FAILED: Invalid timestamp format: {data['timestamp']}")
            return False
        
        print("✅ /api/health endpoint working correctly")
        return True
        
    except requests.exceptions.Timeout:
        print("❌ FAILED: Request timed out")
        return False
    except requests.exceptions.ConnectionError:
        print("❌ FAILED: Connection error - is the server running?")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error: {e}")
        return False

def test_invalid_path():
    """Test invalid path should return 404"""
    print("\n🧪 Testing GET /api/invalid-path")
    print("-" * 40)
    
    try:
        print("📡 Making request to /api/invalid-path...")
        response = requests.get(f"{API_BASE}/invalid-path", timeout=10)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 404:
            print(f"❌ FAILED: Expected status 404, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        try:
            data = response.json()
            print(f"📄 Response data: {data}")
            
            # Should contain error field
            if 'error' not in data:
                print("⚠️  WARNING: 404 response should contain 'error' field")
            
        except json.JSONDecodeError:
            print("⚠️  WARNING: 404 response should be valid JSON")
        
        print("✅ /api/invalid-path correctly returns 404")
        return True
        
    except requests.exceptions.Timeout:
        print("❌ FAILED: Request timed out")
        return False
    except requests.exceptions.ConnectionError:
        print("❌ FAILED: Connection error - is the server running?")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error: {e}")
        return False

def main():
    """Run all backend API tests"""
    print("🚀 Starting KimiTV Backend API Tests")
    print(f"📍 Base URL: {BASE_URL}")
    print(f"🔗 API Base: {API_BASE}")
    
    results = {}
    
    # Test all endpoints
    results['releases'] = test_releases_endpoint()
    results['health'] = test_health_endpoint()
    results['invalid_path'] = test_invalid_path()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    total_tests = len(results)
    passed_tests = sum(results.values())
    
    for endpoint, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{endpoint:20} {status}")
    
    print("-" * 60)
    print(f"Total: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All tests passed! Backend API is working correctly.")
        return True
    else:
        print("⚠️  Some tests failed. Please check the issues above.")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)