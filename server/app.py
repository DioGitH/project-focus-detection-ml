import eventlet
import eventlet.wsgi

from flask import Flask, request
from flask_socketio import SocketIO, emit, disconnect

import cv2
import numpy as np
import time
import torch

from models.scrfd import SCRFD
from models.mobilenetv2 import mobilenet_v2
import base64
import logging
from utils.general import compute_euler_angles_from_rotation_matrices, draw_axis, pre_process, expand_bbox, draw_info
from utils.session import start_session, update_unfocused, log_unfocused_recovery, end_session, get_session_data, delete_session


# Set up logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*", ping_timeout=60, ping_interval=25)

# Track active clients
active_clients = set()
focus_start_times = {}
admin_clients =set()
usernames = {}
focus_warnings={}


device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
logger.info(f"Using device: {device}")
    
try:
    face_detector = SCRFD(model_path="./weights/det_10g.onnx")
    logger.info("Face Detection model weights loaded.")
except Exception as e:
    logger.error(f"Exception occurred while loading pre-trained weights of face detection model. Exception: {e}")
    
try:
    head_pose = mobilenet_v2(num_classes=6, pretrained=False)
    state_dict = torch.load("./weights/hpe_mobilenetv2.pt", map_location=device)
    head_pose.load_state_dict(state_dict)
    logger.info("Head Pose Estimation model weights loaded.")
except Exception as e:
    logger.error(f"Exception occurred while loading pre-trained weights of head pose estimation model. Exception: {e}")

head_pose.to(device)
head_pose.eval()

@app.route('/')
def index():
    return "Flask WebSocket Running"

@socketio.on('connect')
def handle_connect():
    client_id = request.sid
    active_clients.add(client_id)
    logger.info(f"Client connected: {client_id}. Total clients: {len(active_clients)}")

@socketio.on('disconnect')
def handle_disconnect():
    client_id = request.sid
    
    # user = usernames.get(client_id, "Unknown")
    # summary = end_session(client_id, username=user)
    # if "error" not in summary:
    #     print("Summary (from disconnect):", summary)
    delete_session(client_id)
    
    active_clients.discard(client_id)          
    admin_clients.discard(client_id)           
    focus_start_times.pop(client_id, None)    
    usernames.pop(client_id, None) 
    
    for admin_id in admin_clients:
        emit("user_disconnected", {
            "client_id": client_id
        }, to=admin_id)

    logger.info(f"Client disconnected: {client_id}. Total clients: {len(active_clients)}")


@socketio.on("stop_camera")
def handle_stop_camera(data):
    client_id = request.sid
    user = usernames.get(client_id, "Unknown")
    summary = end_session(client_id, username=user)
    if "error" not in summary:
        emit("session_summary", summary, to=client_id)
    logger.info("Camera stop request received")
    return {'status': 'success'}
            
@socketio.on("register_username")
def handle_register_username(data):
    client_id = request.sid
    username = data.get("username")
    if username:
        usernames[client_id] = username
        if client_id not in get_session_data():
            start_session(client_id)
        logger.info(f"Username '{username}' set for client {client_id}")
    else:
        emit("error", {"message": "Username is required"})
    
            
@socketio.on("request_video_admin")
def handle_admin_request_video():
    client_id = request.sid
    admin_clients.add(client_id)
    logger.info(f"Admin {client_id} requested video stream.")

@socketio.on("stop_video_admin")
def handle_admin_stop_video():
    client_id = request.sid
    admin_clients.discard(client_id)
    logger.info(f"Admin {client_id} stopped receiving video.")
    
#for page test camera 
@socketio.on("send_frame")
def process_frame(data):
    client_id = request.sid
    username = usernames.get(client_id, "Unknown")

    focus_start_times.setdefault(client_id, None)
    focus_warnings.setdefault(client_id, False)

    def emit_frame_to_admins(focused, frame_base64):
        for admin_id in admin_clients:
            emit("receive_all_frame", {
                "client_id": client_id,
                "username": username,
                "frame": frame_base64,
                "focused": focused
            }, to=admin_id)

    def handle_unfocused(reason):
        now = time.time()
        if focus_start_times[client_id] is None:
            focus_start_times[client_id] = now
            focus_warnings[client_id] = False
        elif now - focus_start_times[client_id] >= 10 and not focus_warnings[client_id]:
            update_unfocused(client_id)
            emit("not_focused_warning", {
                "message": f"{reason} for more than 10 seconds!"
            }, to=client_id)
            focus_warnings[client_id] = True

    def reset_focus_timer():
        if focus_start_times[client_id] is not None or focus_warnings[client_id]:
            log_unfocused_recovery(client_id)
        focus_start_times[client_id] = None
        focus_warnings[client_id] = False

    try:
        if not data or "frame" not in data:
            emit("error", {"message": "Invalid frame data"})
            return

        frame_data = data["frame"].split(",")[1]
        frame = np.frombuffer(base64.b64decode(frame_data), np.uint8)
        frame = cv2.imdecode(frame, cv2.IMREAD_COLOR)

        if frame is None:
            emit("error", {"message": "Failed to decode frame"})
            return

        bboxes, keypoints = face_detector.detect(frame)
        if len(bboxes) == 0:
            _, buffer = cv2.imencode('.jpg', frame)
            frame_base64 = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')
            emit("receive_frame", {
                "angles": {"yaw": 0, "pitch": 0, "roll": 0},
                "frame": frame_base64,
                "focused": False
            })
            emit_frame_to_admins(False, frame_base64)
            handle_unfocused("No face detected")
            return

        bbox = bboxes[0]
        x_min, y_min, x_max, y_max = map(int, bbox[:4])
        x_min, y_min, x_max, y_max = expand_bbox(x_min, y_min, x_max, y_max)

        if x_min >= x_max or y_min >= y_max or x_min < 0 or y_min < 0 or \
           x_max > frame.shape[1] or y_max > frame.shape[0]:
            logger.warning(f"Invalid bounding box: {x_min}, {y_min}, {x_max}, {y_max}")
            _, buffer = cv2.imencode('.jpg', frame)
            frame_base64 = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')
            emit("receive_frame", {
                "angles": {"yaw": 0, "pitch": 0, "roll": 0},
                "frame": frame_base64,
                "focused": False
            })
            emit_frame_to_admins(False, frame_base64)
            handle_unfocused("Invalid bounding box")
            return

        cropped_image = frame[y_min:y_max, x_min:x_max]
        image = pre_process(cropped_image).to(device)

        with torch.no_grad():
            rotation_matrix = head_pose(image)
            euler = np.degrees(compute_euler_angles_from_rotation_matrices(rotation_matrix))
            p_pred_deg = euler[:, 0].cpu().item()
            y_pred_deg = euler[:, 1].cpu().item()
            r_pred_deg = euler[:, 2].cpu().item()

        is_focused = -15 <= y_pred_deg <= 15 and -15 <= p_pred_deg <= 15 and -15 <= r_pred_deg <= 15

        if not is_focused:
            handle_unfocused("Head pose out of range")
        else:
            reset_focus_timer()

        draw_axis(frame, y_pred_deg, p_pred_deg, r_pred_deg, bbox=[x_min, y_min, x_max, y_max], size_ratio=0.5)
        draw_info(frame, y_pred_deg, p_pred_deg, r_pred_deg)
        

        angles = {
            "yaw": y_pred_deg,
            "pitch": p_pred_deg,
            "roll": r_pred_deg
        }

        _, buffer = cv2.imencode('.jpg', frame)
        frame_base64 = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')

        response = {
            "angles": angles,
            "frame": frame_base64,
            "focused": is_focused,
        }

        emit("receive_frame", response)
        emit_frame_to_admins(is_focused, frame_base64)

    except Exception as e:
        logger.exception("Error while processing frame")
        try:
            emit("error", {"message": str(e)})
        except:
            logger.exception("Failed to emit error message")

            
#for real testing camera
@socketio.on("frame_camera")
def process_frame_camera(data):
    client_id = request.sid
    username = usernames.get(client_id, "Unknown")
    
    # Inisialisasi state
    focus_start_times.setdefault(client_id, None)
    focus_warnings.setdefault(client_id, False)

    def emit_frame_to_admins(focused, frame):
        _, buffer = cv2.imencode('.jpg', frame)
        frame_base64 = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')
        for admin_id in admin_clients:
            emit("receive_all_frame", {
                "client_id": client_id,
                "username": username,
                "frame": frame_base64,
                "focused": focused
            }, to=admin_id)

    def handle_unfocused(reason):
        now = time.time()
        if focus_start_times[client_id] is None:
            focus_start_times[client_id] = now
            focus_warnings[client_id] = False
        elif now - focus_start_times[client_id] >= 10 and not focus_warnings[client_id]:
            update_unfocused(client_id)
            emit("not_focused_warning", {
                "message": f"{reason} for more than 10 seconds!"
            }, to=client_id)
            focus_warnings[client_id] = True

    def reset_focus_timer():
        if focus_start_times[client_id] is not None or focus_warnings[client_id]:
            log_unfocused_recovery(client_id)
        focus_start_times[client_id] = None
        focus_warnings[client_id] = False

    try:
        if not data or "frame" not in data:
            emit("error", {"message": "Invalid frame data"})
            return

        frame_data = data["frame"].split(",")[1]
        frame = np.frombuffer(base64.b64decode(frame_data), np.uint8)
        frame = cv2.imdecode(frame, cv2.IMREAD_COLOR)

        if frame is None:
            emit("error", {"message": "Failed to decode frame"})
            return

        # Detect face
        bboxes, keypoints = face_detector.detect(frame)
        if len(bboxes) == 0:
            emit("receive_status", {"focused": False})
            emit_frame_to_admins(False, frame)
            handle_unfocused("No face detected")
            return

        bbox, keypoint = bboxes[0], keypoints[0]
        x_min, y_min, x_max, y_max = map(int, bbox[:4])
        x_min, y_min, x_max, y_max = expand_bbox(x_min, y_min, x_max, y_max)

        # Validasi bounding box
        if x_min >= x_max or y_min >= y_max or x_min < 0 or y_min < 0 or \
           x_max > frame.shape[1] or y_max > frame.shape[0]:
            logger.warning(f"Invalid bounding box: {x_min}, {y_min}, {x_max}, {y_max}")
            emit("receive_status", {"focused": False})
            emit_frame_to_admins(False, frame)
            handle_unfocused("Invalid bounding box")
            return

        # Pre-process dan estimasi head pose
        cropped_image = frame[y_min:y_max, x_min:x_max]
        image = pre_process(cropped_image).to(device)

        with torch.no_grad():
            rotation_matrix = head_pose(image)
            euler = np.degrees(compute_euler_angles_from_rotation_matrices(rotation_matrix))
            p_pred_deg = euler[:, 0].cpu().item()
            y_pred_deg = euler[:, 1].cpu().item()
            r_pred_deg = euler[:, 2].cpu().item()

        is_focused = -15 <= y_pred_deg <= 15 and -15 <= p_pred_deg <= 15 and -15 <= r_pred_deg <= 15

        if not is_focused:
            handle_unfocused("Head pose out of range")
        else:
            reset_focus_timer()

        emit("receive_status", {"focused": is_focused})

        # Tambahkan visualisasi
        draw_axis(frame, y_pred_deg, p_pred_deg, r_pred_deg, [x_min, y_min, x_max, y_max], size_ratio=0.5)
        draw_info(frame, y_pred_deg, p_pred_deg, r_pred_deg)
        emit_frame_to_admins(is_focused, frame)

    except Exception as e:
        logger.exception("Error while processing frame")
        try:
            emit("error", {"message": str(e)})
        except:
            logger.exception("Failed to emit error message")

    


if __name__ == "__main__":
    socketio.run(app, engineio_logger=True)