import requests

def convert_currency(amount, from_currency, to_currency):

    from_currency = from_currency.strip().upper()
    to_currency = to_currency.strip().upper()

    # Same currency → no conversion
    if from_currency == to_currency:
        return round(amount, 2)

    try:
        url = f"https://open.er-api.com/v6/latest/{from_currency}"

        response = requests.get(url, timeout=5)
        data = response.json()

        if "rates" in data and to_currency in data["rates"]:
            rate = float(data["rates"][to_currency])
            return round(amount * rate, 2)

        print("API missing rate:", data)
        return amount

    except Exception as e:
        print("Currency API error:", e)
        return amount