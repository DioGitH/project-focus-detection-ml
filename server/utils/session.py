import time

session_data = {}

def start_session(client_id):
    session_data[client_id] = {
        "session_start_time": time.time(),
        "unfocused_count": 0,
        "total_unfocused_duration": 0.0,
        "last_unfocused_time": None,
        "unfocused_timestamps": []
    }

def update_unfocused(client_id):
    session_data[client_id]["unfocused_count"] += 1
    session_data[client_id]["last_unfocused_time"] = time.time()

def log_unfocused_recovery(client_id):
    if session_data[client_id]["last_unfocused_time"] is not None:
        end_time = time.time()
        start_time = session_data[client_id]["last_unfocused_time"]
        duration = end_time - start_time
        session_data[client_id]["total_unfocused_duration"] += duration
        session_data[client_id]["unfocused_timestamps"].append({
            "start": start_time,
            "end": end_time,
            "duration": duration
        })
        session_data[client_id]["last_unfocused_time"] = None

def end_session(client_id, username):
    session_data[client_id]["session_end_time"] = time.time()
    total_time = session_data[client_id]["session_end_time"] - session_data[client_id]["session_start_time"]
    
    summary = {
        "username": username,
        "duration": total_time,
        "unfocused_count": session_data[client_id]["unfocused_count"],
        "total_unfocused_duration": session_data[client_id]["total_unfocused_duration"],
        "unfocused_timestamps": session_data[client_id]["unfocused_timestamps"]
    }
    
    return summary

def get_session_data():
    return session_data
