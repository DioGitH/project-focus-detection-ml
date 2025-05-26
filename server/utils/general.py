import torch
import numpy as np
import cv2
from typing import List
from torchvision import transforms

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
    
def draw_info(image: np.ndarray, yaw: float, pitch: float, roll: float,
              threshold: tuple = (-15, 15)) -> None:
    """
    Tambahkan informasi yaw, pitch, roll, dan status fokus ke frame (pojok kiri atas).
    Menentukan fokus berdasarkan apakah yaw, pitch, dan roll berada dalam rentang threshold.
    """
    font_scale = 0.4
    thickness = 1
    line_height = 20
    start_x, start_y = 10, 20

    # Warna teks per komponen
    yaw_color = (0, 255, 0)    # hijau
    pitch_color = (255, 0, 255)  # ungu
    roll_color = (0, 0, 255)   # merah

    # Cek apakah masing-masing sudut berada dalam threshold
    is_yaw_ok = threshold[0] <= yaw <= threshold[1]
    is_pitch_ok = threshold[0] <= pitch <= threshold[1]
    is_roll_ok = threshold[0] <= roll <= threshold[1]
    is_focused = is_yaw_ok and is_pitch_ok and is_roll_ok

    # Gambar teks untuk yaw, pitch, dan roll
    cv2.putText(image, f"Yaw: {yaw:.2f}", (start_x, start_y), cv2.FONT_HERSHEY_SIMPLEX, font_scale, yaw_color, thickness)
    cv2.putText(image, f"Pitch: {pitch:.2f}", (start_x, start_y + line_height), cv2.FONT_HERSHEY_SIMPLEX, font_scale, pitch_color, thickness)
    cv2.putText(image, f"Roll: {roll:.2f}", (start_x, start_y + 2 * line_height), cv2.FONT_HERSHEY_SIMPLEX, font_scale, roll_color, thickness)

    # Gambar status fokus
    focus_color = (0, 255, 0) if is_focused else (0, 0, 255)
    focus_text = "FOKUS" if is_focused else "TIDAK FOKUS"
    cv2.putText(image, f"Status: {focus_text}", (start_x, start_y + 3 * line_height), cv2.FONT_HERSHEY_SIMPLEX, font_scale, focus_color, thickness)



    
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