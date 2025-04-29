from flask import Flask, request, jsonify, render_template, Response
from flask_socketio import SocketIO, emit
import cv2
import numpy as np
import torch
from torchvision import transforms
from typing import List
from models.scrfd import SCRFD
from models.mobilenetv2 import mobilenet_v2
import base64
import logging
import argparse
import warnings
import time

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
try:
    face_detector = SCRFD(model_path="./weights/det_10g.onnx")
    logging.info("Face Detection model weights loaded.")
except Exception as e:
    logging.info(f"Exception occured while loading pre-trained weights of face detection model. Exception: {e}")
    
try:
    head_pose = mobilenet_v2(num_classes=6, pretrained=False)
    state_dict = torch.load("./weights/hpe.pt", map_location=device)
    head_pose.load_state_dict(state_dict)
    logging.info("Head Pose Estimation model weights loaded.")
except Exception as e:
    logging.info(
        f"Exception occured while loading pre-trained weights of head pose estimation model. Exception: {e}")

head_pose.to(device)
head_pose.eval()

def compute_euler_angles_from_rotation_matrices(rotation_matrices):
    """
    Computes the Euler angles (x, y, z) from a batch of 3x3 rotation matrices.

    Args:
        rotation_matrices (torch.Tensor): A tensor of shape (batch_size, 3, 3) containing  the rotation matrices.

    Returns:
        torch.Tensor: A tensor of shape (batch_size, 3) containing the Euler angles (x, y, z) for each rotation matrix in the batch.
    """
    batch_size = rotation_matrices.shape[0]
    R = rotation_matrices
    sy = torch.sqrt(R[:, 0, 0]**2 + R[:, 1, 0]**2)

    is_singular = sy < 1e-6

    x_angle = torch.atan2(R[:, 2, 1], R[:, 2, 2])
    y_angle = torch.atan2(-R[:, 2, 0], sy)
    z_angle = torch.atan2(R[:, 1, 0], R[:, 0, 0])

    x_angle_singular = torch.atan2(-R[:, 1, 2], R[:, 1, 1])
    y_angle_singular = torch.atan2(-R[:, 2, 0], sy)
    z_angle_singular = torch.zeros_like(z_angle)

    euler_angles = torch.zeros(batch_size, 3)

    euler_angles[:, 0] = x_angle * (~is_singular) + x_angle_singular * is_singular
    euler_angles[:, 1] = y_angle * (~is_singular) + y_angle_singular * is_singular
    euler_angles[:, 2] = z_angle * (~is_singular) + z_angle_singular * is_singular

    return euler_angles

def pre_process(image):
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    transform = transforms.Compose([
        transforms.ToPILImage(),
        transforms.Resize(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    image = transform(image)
    image_batch = image.unsqueeze(0)
    return image_batch


def expand_bbox(x_min, y_min, x_max, y_max, factor=0.2):
    """Expand the bounding box by a given factor."""
    width = x_max - x_min
    height = y_max - y_min

    x_min_new = x_min - int(factor * height)
    y_min_new = y_min - int(factor * width)
    x_max_new = x_max + int(factor * height)
    y_max_new = y_max + int(factor * width)

    return max(0, x_min_new), max(0, y_min_new), x_max_new, y_max_new

def draw_axis(image: np.ndarray, yaw: float, pitch: float, roll: float, bbox: List[int], size_ratio: float = 0.5) -> None:
    """
    Draws 3D coordinate axes on a 2D image based on yaw, pitch, and roll angles.
    """
    yaw, pitch, roll = np.radians([-yaw, pitch, roll])
    x_min, y_min, x_max, y_max = bbox
    tdx = int(x_min + (x_max - x_min) * 0.5)
    tdy = int(y_min + (y_max - y_min) * 0.5)
    bbox_size = min(x_max - x_min, y_max - y_min)
    size = bbox_size * size_ratio

    cos_yaw, sin_yaw = np.cos(yaw), np.sin(yaw)
    cos_pitch, sin_pitch = np.cos(pitch), np.sin(pitch)
    cos_roll, sin_roll = np.cos(roll), np.sin(roll)

    x1 = int(size * (cos_yaw * cos_roll) + tdx)
    y1 = int(size * (cos_pitch * sin_roll + cos_roll * sin_pitch * sin_yaw) + tdy)
    x2 = int(size * (-cos_yaw * sin_roll) + tdx)
    y2 = int(size * (cos_pitch * cos_roll - sin_pitch * sin_yaw * sin_roll) + tdy)
    x3 = int(size * sin_yaw + tdx)
    y3 = int(size * (-cos_yaw * sin_pitch) + tdy)

    cv2.line(image, (tdx, tdy), (x1, y1), (0, 0, 255), 2)  # Red (X-axis)
    cv2.line(image, (tdx, tdy), (x2, y2), (0, 255, 0), 2)  # Green (Y-axis)
    cv2.line(image, (tdx, tdy), (x3, y3), (255, 0, 0), 2)  # Blue (Z-axis)

@socketio.on("send_frame")
def process_frame(data):

    # Decode Base64 frame
    frame_data = data["frame"].split(",")[1]
    frame = np.frombuffer(base64.b64decode(frame_data), np.uint8)
    frame = cv2.imdecode(frame, cv2.IMREAD_COLOR)

    # Perform face detection
    bboxes, keypoints = face_detector.detect(frame)
    for bbox, keypoint in zip(bboxes, keypoints):
        x_min, y_min, x_max, y_max = map(int, bbox[:4])

        # Expand bounding box
        x_min, y_min, x_max, y_max = expand_bbox(x_min, y_min, x_max, y_max)

        # Pre-process the cropped image
        cropped_image = frame[y_min:y_max, x_min:x_max]
        image = pre_process(cropped_image)
        image = image.to(device)

        # Perform head pose estimation
        with torch.no_grad():
            rotation_matrix = head_pose(image)
            euler = np.degrees(compute_euler_angles_from_rotation_matrices(rotation_matrix))
            p_pred_deg = euler[:, 0].cpu()
            y_pred_deg = euler[:, 1].cpu()
            r_pred_deg = euler[:, 2].cpu()

        # Draw axis on the frame
        draw_axis(
            frame,
            y_pred_deg.item(),
            p_pred_deg.item(),
            r_pred_deg.item(),
            bbox=[x_min, y_min, x_max, y_max],
            size_ratio=0.5
        )
        # Prepare angles to return
        angles = {
            "yaw": y_pred_deg.item(),
            "pitch": p_pred_deg.item(),
            "roll": r_pred_deg.item()
        }

        # Encode the frame back to JPEG format
        _, buffer = cv2.imencode('.jpg', frame)
        
        # Encode the frame to Base64
        frame_base64 = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')

        # Combine the angles and the frame in the response
        response = {
        "angles": angles,
        "frame": frame_base64
        }
        
        emit("receive_frame", response)


@app.route("/")
def index():
    return render_template("page.html")

if __name__ == "__main__":
    socketio.run(app, debug=True)