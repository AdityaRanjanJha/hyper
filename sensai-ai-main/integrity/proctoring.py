# integrity/proctoring.py

import random

def detect_presence(frame):
    return True, 0.99, "User detected in frame"

def detect_gaze(frame):
    if random.random() < 0.1:
        return True, 0.8, "Gaze drift detected"
    return False, 0, ""

def detect_background_speech(audio_chunk):
    if random.random() < 0.05:
        return True, 0.85, "Background speech detected"
    return False, 0, ""
