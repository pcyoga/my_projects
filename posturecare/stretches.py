"""
PostureCare Python - Desk Stretches & Ergonomic Library
Provides guided desk exercises, instructions, and posture tips.
"""
from models import StretchExercise

DESK_STRETCHES = [
    StretchExercise(
        id="neck_roll",
        title="Upper Trapezius & Neck Release",
        target_area="Cervical Spine & Neck",
        duration_seconds=30,
        rep_count="3 reps per side",
        instructions=[
            "Sit tall with your shoulders relaxed downward.",
            "Gently tilt your right ear toward your right shoulder.",
            "Hold for 15 seconds, feeling a gentle stretch along the left side of your neck.",
            "Repeat on the left side."
        ]
    ),
    StretchExercise(
        id="chest_opener",
        title="Doorway / Seated Chest Opener",
        target_area="Pectorals & Anterior Shoulders",
        duration_seconds=45,
        rep_count="2 reps",
        instructions=[
            "Interlace your fingers behind your lower back.",
            "Gently squeeze your shoulder blades together and lift your chest.",
            "Take 3 deep diaphragmatic breaths.",
            "Release gently without snapping shoulders."
        ]
    ),
    StretchExercise(
        id="seated_twist",
        title="Seated Spinal Twist",
        target_area="Thoracic Spine & Lumbar",
        duration_seconds=40,
        rep_count="2 reps per side",
        instructions=[
            "Sit upright with both feet flat on the ground.",
            "Place your right hand on the back of your chair and left hand on your right knee.",
            "Gently rotate your torso toward the right, looking over your right shoulder.",
            "Hold for 20 seconds, then switch sides."
        ]
    ),
    StretchExercise(
        id="chin_tuck",
        title="Ergonomic Chin Tucks",
        target_area="Deep Neck Flexors",
        duration_seconds=30,
        rep_count="10 reps (3s hold)",
        instructions=[
            "Look straight ahead with relaxed jaw.",
            "Draw your chin straight backward as if making a double chin.",
            "Hold for 3 seconds, feeling the lengthening at the base of your skull.",
            "Release back to neutral position."
        ]
    )
]

def get_stretches():
    return DESK_STRETCHES
