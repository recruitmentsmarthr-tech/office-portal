import shutil
import os
import time
from sentence_transformers import SentenceTransformer

# Define path to the corrupted cache
CACHE_DIR = '/app/cache'
MODEL_NAME = 'sentence-transformers/all-MiniLM-L6-v2'
repo_path = os.path.join(CACHE_DIR, 'hub/models--sentence-transformers--all-MiniLM-L6-v2')

print(f"🔧 Starting Repair for: {MODEL_NAME}")

# 1. Surgically remove the corrupted folder
if os.path.exists(repo_path):
    print(f"🗑️ Deleting corrupted cache at: {repo_path}")
    shutil.rmtree(repo_path)
else:
    print("ℹ️ Cache folder not found (clean start).")

# 2. Download with Retries
print("⬇️ Downloading model (this may take time)...")
for i in range(5):
    try:
        model = SentenceTransformer(MODEL_NAME, cache_folder=CACHE_DIR)
        print("✅ SUCCESS! Model downloaded and verified.")
        break
    except Exception as e:
        print(f"⚠️ Attempt {i+1} failed: {e}")
        time.sleep(5)
