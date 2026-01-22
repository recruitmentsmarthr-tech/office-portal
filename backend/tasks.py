from celery import Celery
from sqlalchemy.orm import Session
from models import TranscriptionJob, TranscriptionJobStatus, User # Import User for user_id foreign key
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
import subprocess
import requests
import json
import time
from pathlib import Path
import uuid
import logging

# Configure logging for the Celery worker
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables (needed if tasks are run independently of FastAPI)
# from dotenv import load_dotenv
# load_dotenv() # Uncomment if tasks.py is run directly for testing without docker-compose exec

# --- Database setup (mirroring main.py for task context) ---
DATABASE_URL = f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        return db
    finally:
        db.close()

# --- Celery App (mirroring main.py) ---
celery_app = Celery(
    "office_portal",
    broker=os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/0")
)

# --- Constants ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable not set.")

GEMINI_TRANSCRIPTION_MODEL = "gemini-2.5-pro" # As per user's request
UPLOAD_DIR = Path("/app/uploads") # Matches the FastAPI app

# --- Prompt Templates for Minutes Generation ---
CEO_TONE_PROMPT_TEMPLATE = """ROLE:
You are a high-level Chief Technology Officer (CTO) or CEO summarizing a technical strategy meeting. Your tone is authoritative, decisive, and strategic. You are not just recording notes; you are defining the company's direction.

INPUT DATA:
- Raw transcript of a technical meeting.
- Speakers are labeled (e.g., Person 1, Speaker 3).

INSTRUCTIONS:
1. SPEAKER MAPPING: Identify unique speakers. If a name is mentioned (e.g., "Ko Kyaw Soe Lin"), link it to the speaker label immediately.
2. CONTENT FILTER: Filter out all small talk. Focus only on high-value technical decisions, security architecture, and operational workflows.
3. LANGUAGE STYLE (HYBRID BURMESE):
   - **Tone:** Professional, Commanding, and Direct (CEO Style).
   - **Vocabulary:** Use Formal Burmese grammar, but KEEP ALL TECHNICAL TERMS IN ENGLISH (e.g., "Infrastructure", "Certificate Authority", "Access Control").
   - **Do not say:** "We discussed about the server."
   - **Say:** "Server Infrastructure ၏ လုံခြုံရေးကို မြှင့်တင်ရန် အောက်ပါအတိုင်း ဆုံးဖြတ်သည်။" (Decisive).
4. OUTPUT FORMAT: Generate two distinct sections separated by "---".

OUTPUT TEMPLATE:

# မဟာဗျူဟာအစည်းအဝေးမှတ်တမ်း (Strategic Meeting Minutes)

**ခေါင်းစဉ်:** {title_burmese}
**ရက်စွဲ:** {meeting_date}
**အချိန်:** {meeting_time}
**တက်ရောက်သူများ:**
* [Speaker Label] (Name if found)
...

## ၁။ မဟာဗျူဟာ ရည်မှန်းချက် (Strategic Objective)
[One powerful sentence in Burmese summarizing the goal. Example: "လုပ်ငန်းလွှဲပြောင်းမှု လုပ်ငန်းစဉ်တွင် Security Gap မရှိစေရန်နှင့် Infrastructure တစ်ခုလုံးကို Centralized Control စနစ်ဖြင့် စီမံခန့်ခွဲရန်။"]

## ၂။ အဓိက ဆွေးနွေးချက်များ (Key Discussions)
* **Identity & Access Management:** [Summary using strong Burmese + English terms]
* **Operational Monitoring:** [Summary]
* **Data Integrity & Backup:** [Summary]

## ၃။ အတည်ပြုချက်များနှင့် ရှေ့ဆက်လုပ်ငန်းစဉ်များ (Decisions & Action Plan)
| စဉ် | ဆုံးဖြတ်ချက် / လုပ်ဆောင်ရန် | တာဝန်ခံ |
|:---|:---|:---|
| 1 | [Action Item in decisive language] | [Who] |
| 2 | [Action Item] | [Who] |

---

# Executive Summary (English Version)

**Title:** {title_english}
**Attendees:** [List]

## 1. Strategic Objective
[Direct, CEO-level summary]

## 2. Key Discussions
[Bullet points]

## 3. Executive Decisions & Roadmap
| No. | Action Item | Owner |
|:---|:---|:---|
| 1 | [Action Item] | [Who] |

[END OF OUTPUT]

TRANSCRIPT TO PROCESS:
{transcript}
"""

SHORT_TO_THE_POINT_PROMPT_TEMPLATE = """ROLE:
You are an efficient executive assistant focused on speed and clarity. Your job is to summarize technical meetings into short, easy-to-read bullet points.

INPUT DATA:
- Raw transcript of a technical meeting.
- Speakers are labeled (e.g., Person 1).

INSTRUCTIONS:
1. SPEAKER MAPPING: Map speaker labels to real names if mentioned (e.g., "Person 1 (Ko Kyaw Soe Lin)").
2. BREVITY IS KEY:
   - Do not write long paragraphs. Use bullet points.
   - Remove all fluff, small talk, and polite filler.
   - Get straight to the point.
3. LANGUAGE STYLE (SIMPLE & DIRECT):
   - **Tone:** Easy to read, sharp, and professional.
   - **Burmese:** Use clear, simple business Burmese.
   - **Technical Terms:** DO NOT TRANSLATE technical terms (Keep "Infrastructure", "Server", "Backup", "Log" in English).
4. FORMATTING: Produce TWO versions separated by "---".

OUTPUT TEMPLATE:

# အစည်းအဝေး အနှစ်ချုပ် (Meeting Brief)

**ခေါင်းစဉ်:** {title_burmese}
**ရက်စွဲ:** {meeting_date}
**အချိန်:** {meeting_time}
**တက်ရောက်သူ:** [List of Names/Labels]

## ၁။ အဓိကအချက်များ (Key Updates)
* **[Topic]:** [1 sentence summary in Burmese with English terms].
* **[Topic]:** [1 sentence summary].
* **[Topic]:** [1 sentence summary].

## ၂။ ဆုံးဖြတ်ချက်နှင့် တာဝန်များ (Action Items)
| No. | လုပ်ဆောင်ရန် (Action) | တာဝန်ခံ (Who) |
|:---|:---|:---|
| 1 | [Short Action Item] | [Name] |
| 2 | [Short Action Item] | [Name] |

---

# Executive Brief (English)

**Title:** {title_english}
**Attendees:** [List]

## 1. Key Updates
* **[Topic]:** [1 sentence summary].
* **[Topic]:** [1 sentence summary].

## 2. Action Items
| No. | Action | Who |
|:---|:---|:---|
| 1 | [Short Action Item] | [Name] |
| 2 | [Short Action Item] | [Name] |

[END OF OUTPUT]

TRANSCRIPT TO PROCESS:
{transcript}
"""

# --- Helper for Google File API (Gemini) ---
def upload_file_to_gemini(file_path: Path, mime_type: str, display_name: str) -> str:
    """Uploads a file to the Gemini File API and returns its URI."""
    headers = {"x-goog-api-key": GEMINI_API_KEY}

    # Step 1: Start resumable upload
    start_upload_url = "https://generativelanguage.googleapis.com/upload/v1beta/files"
    start_headers = {
        **headers,
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": str(file_path.stat().st_size),
        "X-Goog-Upload-Header-Content-Type": mime_type,
        "Content-Type": "application/json",
    }
    start_payload = json.dumps({"file": {"display_name": display_name}})
    
    response = requests.post(start_upload_url, headers=start_headers, data=start_payload)
    response.raise_for_status()
    upload_url = response.headers["X-Goog-Upload-Url"]

    # Step 2: Upload the actual bytes
    with open(file_path, "rb") as f:
        upload_data = f.read()

    upload_headers = {
        "Content-Length": str(file_path.stat().st_size),
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
        # No Content-Type needed here, it was in the start request
    }
    response = requests.post(upload_url, headers=upload_headers, data=upload_data)
    response.raise_for_status()
    
    file_info = response.json()
    file_uri = file_info["file"]["uri"]
    
    # Poll for file to be ACTIVE
    file_name = file_info["file"]["name"] # e.g., files/12345
    logger.info(f"File uploaded, polling for active status: {file_name}")
    while True:
        status_url = f"https://generativelanguage.googleapis.com/v1beta/{file_name}"
        status_response = requests.get(status_url, headers=headers)
        status_response.raise_for_status()
        current_status = status_response.json().get("state")
        logger.info(f"Current file state for {file_name}: {current_status}")
        if current_status == "ACTIVE":
            break
        elif current_status == "FAILED":
            raise Exception(f"File upload failed with state: {current_status}")
        time.sleep(5) # Wait before polling again
    
    logger.info(f"File {file_name} is ACTIVE, URI: {file_uri}")
    return file_uri

def delete_gemini_file(file_name: str):
    """Deletes a file from the Gemini File API."""
    headers = {"x-goog-api-key": GEMINI_API_KEY}
    delete_url = f"https://generativelanguage.googleapis.com/v1beta/{file_name}"
    try:
        response = requests.delete(delete_url, headers=headers)
        response.raise_for_status()
        logger.info(f"Successfully deleted Gemini file: {file_name}")
    except requests.exceptions.RequestException as e:
        logger.warning(f"Failed to delete Gemini file {file_name}: {e}")


# --- Celery Tasks ---
@celery_app.task(bind=True)
def transcribe_audio_task(self, job_id: int, audio_file_path: str):
    db = None
    job = None
    try:
        db = get_db()
        job = db.query(TranscriptionJob).filter(TranscriptionJob.id == job_id).first()
        if not job:
            logger.error(f"Transcription job {job_id} not found.")
            return

        job.status = TranscriptionJobStatus.PROCESSING
        job.progress_text = "Splitting audio into chunks..."
        db.commit()
        
        original_file_path = Path(audio_file_path)
        chunk_dir = original_file_path.parent / f"chunks_{job_id}"
        chunk_dir.mkdir(exist_ok=True)

        file_extension = original_file_path.suffix
        chunk_prefix = chunk_dir / f"chunk_{job_id}_%03d{file_extension}"
        
        # FFmpeg command to split audio into 10-minute (600 seconds) chunks
        # The original example used 900s, user mentioned 10 min (600s). Let's use 600s.
        # It's better to convert to mp3 if not already, to ensure consistent MIME type
        output_format = ".mp3" if file_extension.lower() not in [".mp3", ".wav"] else file_extension
        final_chunk_prefix = chunk_dir / f"chunk_{job_id}_%03d{output_format}"
        ffmpeg_command = [
            "ffmpeg",
            "-i", str(original_file_path),
            "-f", "segment",
            "-segment_time", "600", # 10 minutes
            "-c:a", "libmp3lame", # Encode to MP3 for wider Gemini support
            "-q:a", "2", # Good quality
            str(final_chunk_prefix)
        ]
        
        logger.info(f"Executing ffmpeg command: {' '.join(ffmpeg_command)}")
        subprocess.run(ffmpeg_command, check=True, capture_output=True, text=True)

        chunks = sorted(list(chunk_dir.glob(f"chunk_{job_id}_*{output_format}")))
        total_chunks = len(chunks)
        full_transcript_parts = []
        
        for i, chunk_path in enumerate(chunks):
            current_chunk_number = i + 1
            job.progress_percent = int((current_chunk_number / total_chunks) * 100)
            job.progress_text = f"Transcribing chunk {current_chunk_number} of {total_chunks}..."
            db.commit()
            logger.info(f"Processing chunk {current_chunk_number}/{total_chunks}: {chunk_path}")

            gemini_file_uri = None
            try:
                # Determine MIME type for the chunk
                # Assuming MP3 now due to libmp3lame encoding
                chunk_mime_type = "audio/mpeg" if output_format == ".mp3" else "audio/wav" # Defaulting for common types
                gemini_file_uri = upload_file_to_gemini(chunk_path, chunk_mime_type, f"job_{job_id}_chunk_{current_chunk_number}")
                
                # Transcription request to Gemini REST API
                transcribe_url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_TRANSCRIPTION_MODEL}:generateContent"
                transcribe_headers = {
                    "x-goog-api-key": GEMINI_API_KEY,
                    "Content-Type": "application/json",
                }
                transcribe_payload = json.dumps({
                    "contents": [{"parts": [
                            {"text": "Professional Secretary. Transcribe Burmese/English CLEAN VERBATIM. MANDATORY: Start every turn with Speaker 1: or S>"},
                            {"file_data": {"mime_type": chunk_mime_type, "file_uri": gemini_file_uri}}
                        ]}]
                })

                transcribe_response = requests.post(transcribe_url, headers=transcribe_headers, data=transcribe_payload)
                transcribe_response.raise_for_status()
                transcription_result = transcribe_response.json()
                
                # Extract text from the Gemini response
                chunk_transcript = ""
                for candidate in transcription_result.get("candidates", []):
                    for part in candidate.get("content", {}).get("parts", []):
                        if "text" in part:
                            chunk_transcript += part["text"]
                
                full_transcript_parts.append(chunk_transcript)
                job.full_transcript = "\n".join(full_transcript_parts)
                db.commit()
                logger.info(f"Transcribed chunk {current_chunk_number} for job {job_id}")

            except Exception as e:
                logger.error(f"Error processing chunk {current_chunk_number} for job {job_id}: {e}")
                job.error_message = (job.error_message or "") + f"Chunk {current_chunk_number} failed: {e}\n"
                job.status = TranscriptionJobStatus.FAILED
                db.commit()
                # Optionally re-raise to fail the task, or continue with other chunks
                raise # Re-raise to mark the Celery task as failed

            finally:
                # Clean up local chunk file
                if chunk_path.exists():
                    chunk_path.unlink()
                # Clean up Gemini file
                if gemini_file_uri:
                    # gemini_file_uri is "https://generativelanguage.googleapis.com/v1beta/files/..."
                    # we need "files/..."
                    file_name_for_deletion = gemini_file_uri.split("/v1beta/")[1]
                    delete_gemini_file(file_name_for_deletion)

        # Finalize job status
        job.status = TranscriptionJobStatus.COMPLETED
        job.progress_text = "Transcription completed."
        db.commit()
        logger.info(f"Transcription job {job_id} completed successfully.")

    except subprocess.CalledProcessError as e:
        error_msg = f"FFmpeg error for job {job_id}: {e.stderr}"
        logger.error(error_msg)
        if job:
            job.status = TranscriptionJobStatus.FAILED
            job.error_message = error_msg
            db.commit()
    except requests.exceptions.RequestException as e:
        error_msg = f"Gemini API request failed for job {job_id}: {e}"
        logger.error(error_msg)
        if job:
            job.status = TranscriptionJobStatus.FAILED
            job.error_message = error_msg
            db.commit()
    except Exception as e:
        error_msg = f"An unexpected error occurred for job {job_id}: {e}"
        logger.error(error_msg, exc_info=True) # Log traceback
        if job:
            job.status = TranscriptionJobStatus.FAILED
            job.error_message = error_msg
            db.commit()
    finally:
        # Clean up original uploaded file and chunk directory
        if 'original_file_path' in locals() and original_file_path.exists():
            original_file_path.unlink()
        if 'chunk_dir' in locals() and chunk_dir.exists():
            try:
                # Use rmtree to remove directory and its contents
                import shutil
                shutil.rmtree(chunk_dir)
            except OSError as e:
                logger.warning(f"Could not remove chunk directory {chunk_dir}: {e}")
        if db:
            db.close()

@celery_app.task(bind=True)
def generate_minutes_task(self, job_id: int, meeting_date: str, meeting_time: str, tone: str):
    db = None
    job = None
    try:
        db = get_db()
        job = db.query(TranscriptionJob).filter(TranscriptionJob.id == job_id).first()
        if not job:
            logger.error(f"Minutes generation job {job_id} not found.")
            return

        if job.status not in [TranscriptionJobStatus.COMPLETED, TranscriptionJobStatus.FAILED]:
            logger.warning(f"Minutes generation requested for job {job_id} with status {job.status.value}. Transcript may not be ready.")
            job.error_message = (job.error_message or "") + "Attempted to generate minutes before transcription was complete or failed unexpectedly.\n"
            db.commit()
            return

        if not job.full_transcript:
            logger.error(f"Job {job_id} has no full transcript to summarize.")
            job.status = TranscriptionJobStatus.FAILED # Mark as failed if no transcript
            job.error_message = (job.error_message or "") + "No transcript available for summarization.\n"
            db.commit()
            return
        
        # Now that checks are passed, set status to PROCESSING
        job.status = TranscriptionJobStatus.PROCESSING
        job.progress_text = "Generating meeting minutes..."
        db.commit()

        # Select prompt template based on tone
        if tone == "CEO":
            prompt_template = CEO_TONE_PROMPT_TEMPLATE
            title_burmese = "Infrastructure လွှဲပြောင်းမှုနှင့် လုံခြုံရေးခေတ်မီအောင် ဆောင်ရွက်ခြင်းဆိုင်ရာ မဟာဗျူဟာအစည်းအဝေး"
            title_english = "Infrastructure Handover & Security Modernization Strategic Meeting"
        elif tone == "SHORT_TO_THE_POINT":
            prompt_template = SHORT_TO_THE_POINT_PROMPT_TEMPLATE
            title_burmese = "နည်းပညာအစည်းအဝေး အနှစ်ချုပ်"
            title_english = "Technical Meeting Brief"
        else:
            logger.error(f"Invalid tone '{tone}' for minutes generation for job {job_id}.")
            job.status = TranscriptionJobStatus.FAILED
            job.error_message = (job.error_message or "") + f"Invalid tone '{tone}' provided for minutes generation.\n"
            db.commit()
            return
        
        # Construct the final prompt
        final_prompt = prompt_template.format(
            title_burmese=title_burmese,
            title_english=title_english,
            meeting_date=meeting_date,
            meeting_time=meeting_time,
            transcript=job.full_transcript
        )

        # Minutes generation request to Gemini REST API
        minutes_url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_TRANSCRIPTION_MODEL}:generateContent" # Use the same model
        minutes_headers = {
            "x-goog-api-key": GEMINI_API_KEY,
            "Content-Type": "application/json",
        }

        minutes_payload = json.dumps({
            "contents": [{"parts": [
                {"text": final_prompt} # Use the constructed prompt
            ]}]
        })

        minutes_response = requests.post(minutes_url, headers=minutes_headers, data=minutes_payload)
        minutes_response.raise_for_status()
        minutes_result = minutes_response.json()

        generated_minutes = ""
        for candidate in minutes_result.get("candidates", []):
            for part in candidate.get("content", {}).get("parts", []):
                if "text" in part:
                    generated_minutes += part["text"]
        
        job.meeting_minutes = generated_minutes
        job.progress_text = "Meeting minutes generated."
        # NEW: Update job status back to COMPLETED after minutes are generated
        job.status = TranscriptionJobStatus.COMPLETED 
        db.commit()
        logger.info(f"Meeting minutes generated for job {job_id}.")

    except requests.exceptions.RequestException as e:
        error_msg = f"Gemini API request for minutes failed for job {job_id}: {e}"
        logger.error(error_msg)
        if job:
            job.status = TranscriptionJobStatus.FAILED # Also set to FAILED on error
            job.error_message = (job.error_message or "") + f"Minutes generation failed: {e}\n"
            db.commit()
    except Exception as e:
        error_msg = f"An unexpected error occurred during minutes generation for job {job_id}: {e}"
        logger.error(error_msg, exc_info=True)
        if job:
            job.status = TranscriptionJobStatus.FAILED # Also set to FAILED on error
            job.error_message = (job.error_message or "") + f"Minutes generation failed: {e}\n"
            db.commit()
    finally:
        if db:
            db.close()

