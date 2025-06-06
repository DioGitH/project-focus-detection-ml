import time
import logging

session_data = {}

# Set up logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def start_session(username):
    if username not in session_data:
        session_data[username] = {
            "session_start_time": time.time(),
            "unfocused_count": 0,
            "total_unfocused_duration": 0.0,
            "last_unfocused_time": None,
            "unfocused_timestamps": []
        }
    else:
        # Reset hanya client_id jika dibutuhkan, tanpa menghapus data lama
        session_data[username]["session_start_time"] = time.time()

def update_unfocused(username):
    if username in session_data:
        session_data[username]["unfocused_count"] += 1
        session_data[username]["last_unfocused_time"] = time.time()

def log_unfocused_recovery(username):
    if username in session_data and session_data[username]["last_unfocused_time"] is not None:
        end_time = time.time()
        start_time = session_data[username]["last_unfocused_time"]
        duration = end_time - start_time
        session_data[username]["total_unfocused_duration"] += duration
        session_data[username]["unfocused_timestamps"].append({
            "start": start_time,
            "end": end_time,
            "duration": duration
        })
        session_data[username]["last_unfocused_time"] = None

def end_session(username):
    if username not in session_data:
        return {"error": f"No session found for username {username}"}
    
    if username in session_data and session_data[username]["last_unfocused_time"] is not None:
        end_time = time.time()
        start_time = session_data[username]["last_unfocused_time"]
        duration = end_time - start_time
        session_data[username]["total_unfocused_duration"] += duration
        session_data[username]["unfocused_timestamps"].append({
            "start": start_time,
            "end": end_time,
            "duration": duration
        })
        session_data[username]["last_unfocused_time"] = None
    
    session_data[username]["session_end_time"] = time.time()
    total_time = session_data[username]["session_end_time"] - session_data[username]["session_start_time"]
    
    summary = {
        "username": username,
        "duration": total_time,
        "unfocused_count": session_data[username]["unfocused_count"],
        "total_unfocused_duration": session_data[username]["total_unfocused_duration"],
        "unfocused_timestamps": session_data[username]["unfocused_timestamps"]
    }
    
    return summary

def delete_session(username):
    if username in session_data:
        del session_data[username]
        return {"status": "success"}
    else:
        return {"error": f"No session found for username {username}"}

def get_session_data():
    return session_data
