# powerbi_integration.py
import webbrowser
from config import POWERBI

def open_report_in_new_tab():
    report_url = POWERBI.get("report_url")
    if not report_url:
        raise ValueError("POWERBI.report_url not configured in config.py or env.")
    webbrowser.open_new_tab(report_url)

# NOTE:
# - For local development: create your report in Power BI Desktop using the same MySQL DB,
#   then publish to Power BI Service and put the publish url here OR use 'Publish to web' (not secure).
# - For secure embedding, you'll need Azure + Power BI REST APIs to generate embed tokens (not included here).