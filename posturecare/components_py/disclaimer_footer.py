"""
Python Equivalent of /src/components/DisclaimerFooter.tsx
Contains wellness & medical disclaimers, on-device privacy policy, and system versioning.
"""
from typing import Dict, Any


class DisclaimerFooterComponent:
    """
    Component delivering medical disclaimers and privacy assurances.
    """

    APP_NAME: str = "PostureCare"
    APP_VERSION: str = "v1.0 Python Edition"

    DISCLAIMER_TEXT: str = (
        "Wellness & Medical Disclaimer: PostureCare is designed strictly as an ergonomic "
        "habit-building and posture-awareness tool. It does not provide medical diagnoses, "
        "treatment recommendations, or clinical assessments. If you experience persistent spinal, "
        "neck, or muscular pain, please consult a qualified physician or physical therapist."
    )

    PRIVACY_ASSURANCE: str = (
        "Zero Video Telemetry: 100% of computer vision skeletal landmark calculations "
        "are performed strictly on-device in local memory. Video feeds never touch external clouds."
    )

    @classmethod
    def get_footer_info(cls) -> Dict[str, Any]:
        return {
            "appName": cls.APP_NAME,
            "version": cls.APP_VERSION,
            "disclaimer": cls.DISCLAIMER_TEXT,
            "privacy": cls.PRIVACY_ASSURANCE
        }
