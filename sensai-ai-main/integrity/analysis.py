# integrity/analysis.py

import difflib

def check_similarity(answer, previous_answers):
    for prev in previous_answers:
        similarity = difflib.SequenceMatcher(None, answer, prev).ratio()
        if similarity > 0.8:
            return True, similarity, f"Similar to previous answer: {prev[:50]}"
    return False, 0, ""

def check_style_drift(answer, previous_answers):
    if not previous_answers:
        return False, 0, ""
    prev = previous_answers[-1]
    if abs(len(answer) - len(prev)) > 100:
        return True, 0.7, "Significant length change"
    return False, 0, ""
