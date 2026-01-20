import shutil
import os
import time
from sentence_transformers import SentenceTransformer

MODEL_NAME = 'sentence-transformers/all-MiniLM-L6-v2'
CACHE_DIR = '/app/cache'

def clean_cache():
    print(f"🧹 Cleaning corrupted cache for {MODEL_NAME}...")
    try:
        # Delete the specific model folder if it exists
        repo_dir = os.path.join(CACHE_DIR, 'models--sentence-transformers--all-MiniLM-L6-v2')
        if os.path.exists(repo_dir):
            shutil.rmtree(repo_dir)
            print("   Deleted corrupted folder.")
    except Exception as e:
        print(f"   Warning: Could not delete cache: {e}")

def force_download():
    print("⬇️ Starting robust download. Do not close this window...")
    max_retries = 10
    for i in range(max_retries):
        try:
            print(f"   Attempt {i+1}/{max_retries}...")
            SentenceTransformer(MODEL_NAME, cache_folder=CACHE_DIR)
            print("✅ SUCCESS! Model downloaded and verified.")
            return True
        except Exception as e:
            print(f"   ❌ Failed: {e}")
            print("   ⏳ Waiting 5 seconds before retry...")
            time.sleep(5)
            # If it failed, clean cache to prevent "consistency check" errors on next run
            clean_cache()
    return False

if __name__ == "__main__":
    if force_download():
        print("🚀 You can now restart the backend!")
    else:
        print("💀 Download failed after multiple attempts.")
