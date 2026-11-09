"""
Python Equivalent of /src/components/EmailInboxSimulatorModal.tsx
Inspects dispatched welcome emails, delivery logs, timestamps, and verification instructions.
"""
from typing import List, Dict, Any, Optional
from storage import storage


class EmailInboxSimulatorModalComponent:
    """
    Component for previewing simulated welcome emails dispatched upon user sign-up.
    """

    def __init__(self):
        self.is_open: bool = False
        self.selected_email_id: Optional[str] = None

    def open(self, highlight_email: Optional[str] = None) -> List[Dict[str, Any]]:
        self.is_open = True
        logs = storage.get_email_logs()
        if logs:
            if highlight_email:
                match = next((l for l in logs if l.get("recipientEmail", "").lower() == highlight_email.lower()), None)
                self.selected_email_id = match.get("id") if match else logs[0].get("id")
            else:
                self.selected_email_id = logs[0].get("id")
        return logs

    def close(self) -> None:
        self.is_open = False

    def get_emails(self) -> List[Dict[str, Any]]:
        """Returns all dispatched simulated emails from local storage."""
        return storage.get_email_logs()

    def get_selected_email(self) -> Optional[Dict[str, Any]]:
        """Returns the currently active email in preview."""
        emails = self.get_emails()
        if not emails:
            return None
        if not self.selected_email_id:
            return emails[0]
        return next((e for e in emails if e.get("id") == self.selected_email_id), emails[0])
