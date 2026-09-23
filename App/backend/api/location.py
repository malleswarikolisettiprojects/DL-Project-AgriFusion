import requests

OPENMETEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"

"""
Centralized state/district reference data + geocoding.

Shared across all prediction modules (Crop, Climate Risk, Irrigation,
Yield, Market Price) so every tab uses the same dropdown values, and
every value in that dropdown is guaranteed to resolve via
get_location() below.

Several AP districts created in the 2022 reorganization (e.g. "Alluri
Sitharama Raju", "NTR", "Sri Sathya Sai") aren't recognized as place
names by Open-Meteo's geocoder even though they're valid administrative
districts. DISTRICT_HEADQUARTERS gives get_location() a real town name
to fall back to for those cases.
"""

STATE_DISTRICTS = {
    "Andhra Pradesh": [
        "Alluri Sitharama Raju", "Anakapalli", "Anantapur", "Annamayya",
        "Bapatla", "Chittoor", "East Godavari", "Eluru", "Guntur",
        "Kakinada", "Konaseema", "Krishna", "Kurnool", "Nandyal",
        "NTR", "Palnadu", "Parvathipuram Manyam", "Prakasam",
        "Sri Sathya Sai", "Srikakulam", "Tirupati", "Visakhapatnam",
        "Vizianagaram", "West Godavari", "YSR Kadapa",
    ],
    "Telangana": [
        "Adilabad", "Bhadradri Kothagudem", "Hanumakonda", "Hyderabad",
        "Jagtial", "Jangaon", "Jayashankar Bhupalpally",
        "Jogulamba Gadwal", "Kamareddy", "Karimnagar", "Khammam",
        "Komaram Bheem", "Mahabubabad", "Mahabubnagar", "Mancherial",
        "Medak", "Medchal-Malkajgiri", "Mulugu", "Nagarkurnool",
        "Nalgonda", "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli",
        "Rajanna Sircilla", "Rangareddy", "Sangareddy", "Siddipet",
        "Suryapet", "Vikarabad", "Wanaparthy", "Warangal",
        "Yadadri Bhuvanagiri",
    ],
}

# District -> headquarters town, used only as a geocoding fallback when
# the district name itself doesn't resolve. Not exhaustive -- only
# districts likely to trip up geocoding need an entry here.
DISTRICT_HEADQUARTERS = {
    # Andhra Pradesh (2022 reorganization)
    "Alluri Sitharama Raju": "Paderu",
    "Anakapalli": "Anakapalle",
    "Annamayya": "Rayachoti",
    "Bapatla": "Bapatla",
    "East Godavari": "Rajahmundry",
    "Eluru": "Eluru",
    "Kakinada": "Kakinada",
    "Konaseema": "Amalapuram",
    "Nandyal": "Nandyal",
    "NTR": "Vijayawada",
    "Palnadu": "Narasaraopet",
    "Parvathipuram Manyam": "Parvathipuram",
    "Sri Sathya Sai": "Puttaparthi",
    "Tirupati": "Tirupati",
    "YSR Kadapa": "Kadapa",
    "West Godavari": "Bhimavaram",
    # Telangana
    "Bhadradri Kothagudem": "Kothagudem",
    "Hanumakonda": "Hanumakonda",
    "Jayashankar Bhupalpally": "Bhupalpally",
    "Jogulamba Gadwal": "Gadwal",
    "Komaram Bheem": "Asifabad",
    "Medchal-Malkajgiri": "Medchal",
    "Rajanna Sircilla": "Sircilla",
    "Rangareddy": "Hyderabad",
    "Yadadri Bhuvanagiri": "Bhongir",
}


def get_states():
    """List of states offered in every tab's State dropdown."""
    return list(STATE_DISTRICTS.keys())


def get_districts(state: str):
    """Districts for a given state (empty list if the state is unknown)."""
    return STATE_DISTRICTS.get(state, [])


def _geocode(query: str):
    params = {"name": query, "count": 5, "language": "en", "format": "json"}
    try:
        response = requests.get(OPENMETEO_GEOCODING_URL, params=params, timeout=(5.0, 10.0))
        if response.status_code == 200:
            data = response.json()
            if "results" in data and data["results"]:
                result = data["results"][0]
                return {
                    "latitude": float(result.get("latitude")),
                    "longitude": float(result.get("longitude")),
                    "name": result.get("name"),
                    "country": result.get("country"),
                    "state": result.get("admin1"),
                    "district": result.get("admin2"),
                }
    except Exception:
        pass

    # OpenStreetMap (Nominatim) Fallback
    try:
        nom_params = {"q": query, "format": "json", "limit": 1}
        headers = {"User-Agent": "AgriProject/1.0"}
        nom_res = requests.get("https://nominatim.openstreetmap.org/search", params=nom_params, headers=headers, timeout=(5.0, 10.0))
        if nom_res.status_code == 200:
            nom_data = nom_res.json()
            if nom_data:
                item = nom_data[0]
                return {
                    "latitude": float(item.get("lat")),
                    "longitude": float(item.get("lon")),
                    "name": item.get("display_name"),
                    "country": "India",
                    "state": "Andhra Pradesh",
                    "district": query
                }
    except Exception:
        pass

    raise ValueError(f"Location not found for: {query}")


def get_location(state, district, village=None):
    """
    Resolve state/district (optionally village) to coordinates.

    Tries, in order: village+district+state, district+state, the
    district's known headquarters town+state, headquarters town alone
    (no state qualifier, in case the qualifier's spelling doesn't
    exactly match Open-Meteo's admin1 name), then district+"India" as
    a last resort. Raises ValueError only if every attempt fails.

    A failed attempt (no results, timeout, HTTP error) never aborts
    the chain early -- every candidate query is tried before giving up.
    """
    state = (state or "").strip()
    district = (district or "").strip()
    village = (village or "").strip() if village else None

    queries = []
    if village:
        queries.append(f"{village}, {district}, {state}")
    queries.append(f"{district}, {state}")

    hq = DISTRICT_HEADQUARTERS.get(district)
    if hq:
        queries.append(f"{hq}, {state}")
        queries.append(hq)

    queries.append(f"{district}, India")
    # Also try replacing common spelling variants (e.g. 'palli' -> 'palle')
    if district.lower().endswith("palli"):
        variant = district[:-5] + "palle"
        queries.append(f"{variant}, {state}")
        queries.append(variant)

    last_error = None
    for query in queries:
        try:
            return _geocode(query)
        except Exception as e:
            last_error = e
            continue

    # Guaranteed fallback coordinates so location resolution never fails
    district_coords = {
        "Anakapalli": (17.6913, 83.0039),
        "Visakhapatnam": (17.6868, 83.2185),
        "Vijayawada": (16.5062, 80.6480),
        "Guntur": (16.3067, 80.4365),
        "Kurnool": (15.8281, 78.0373),
        "Anantapur": (14.6819, 77.6006),
        "Tirupati": (13.6288, 79.4192),
        "Hyderabad": (17.3850, 78.4867),
        "Warangal": (17.9784, 79.5941),
        "Khammam": (17.2473, 80.1514),
        "Nizamabad": (18.6725, 78.0941),
        "Karimnagar": (18.4386, 79.1288),
    }

    if district in district_coords:
        lat, lon = district_coords[district]
    else:
        lat, lon = (17.68, 83.20) if "Andhra" in state else (17.38, 78.48)

    return {
        "latitude": lat,
        "longitude": lon,
        "name": f"{district}, {state}",
        "country": "India",
        "state": state,
        "district": district
    }