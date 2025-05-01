from models.mobilenetv2 import mobilenet_v2
from models.efficientnet import efficientnet_b0
from models.scrfd import SCRFD

__all__ = ["get_model", "SCRFD"]


def get_model(arch, num_classes=6, pretrained=False):
    """Return the model based on the specified architecture."""
    if arch == "mobilenetv2":
        model = mobilenet_v2(pretrained=pretrained, num_classes=num_classes)
    elif arch == "efficientnetb0":
        model = efficientnet_b0(pretrained=pretrained, num_classes=num_classes)
    else:
        raise ValueError(f"Please choose available model architecture, currently chosen: {arch}")
    return model
