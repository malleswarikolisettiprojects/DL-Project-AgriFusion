import time
from io import BytesIO

import numpy as np
import rasterio
import requests

# Reuses the existing Open-Meteo based geocoder already in this
# api folder instead of duplicating geocoding logic here.
# Adjust to `from .location import get_location` if this package
# uses relative imports.
from .location import get_location

# ============================================================
# SOILGRIDS WCS
# ============================================================

BASE_URL = "https://maps.isric.org/mapserv"

SOIL_PROPERTIES = {
    "soil_ph":         {"map": "phh2o",    "coverage": "phh2o_0-5cm_Q0.5",    "scale": 10},
    "organic_carbon":  {"map": "soc",      "coverage": "soc_0-5cm_Q0.5",      "scale": 10},
    "cec":             {"map": "cec",      "coverage": "cec_0-5cm_Q0.5",      "scale": 10},
    "clay":            {"map": "clay",     "coverage": "clay_0-5cm_Q0.5",     "scale": 10},
    "sand":            {"map": "sand",     "coverage": "sand_0-5cm_Q0.5",     "scale": 10},
    "silt":            {"map": "silt",     "coverage": "silt_0-5cm_Q0.5",     "scale": 10},
    "bulk_density":    {"map": "bdod",     "coverage": "bdod_0-5cm_Q0.5",     "scale": 100},
    "nitrogen":        {"map": "nitrogen", "coverage": "nitrogen_0-5cm_Q0.5", "scale": 100},
    "field_capacity":  {"map": "wv0033",   "coverage": "wv0033_0-5cm_Q0.5",   "scale": 10},
    "wilting_point":   {"map": "wv1500",   "coverage": "wv1500_0-5cm_Q0.5",   "scale": 10},
}

DEFAULTS = {
    "soil_ph": 6.5,
    "organic_carbon": 1.2,
    "nitrogen": 0.15,
    "clay": 25.0,
    "sand": 45.0,
    "silt": 30.0,
    "cec": 15.0,
    "bulk_density": 1.3,
    "field_capacity": 28.0,
    "wilting_point": 14.0,
    "available_water": 14.0,
    "soil_type": "Loam Soil",
}

TITLE_MAPPING = {
    "soil_ph": "Soil_pH",
    "organic_carbon": "Organic_Carbon",
    "nitrogen": "Nitrogen",
    "clay": "Clay",
    "sand": "Sand",
    "silt": "Silt",
    "cec": "CEC",
    "bulk_density": "Bulk_Density",
    "field_capacity": "Field_Capacity",
    "wilting_point": "Wilting_Point",
    "available_water": "Available_Water",
    "soil_type": "Soil_Type",
    "phosphorus_estimated": "Phosphorus_Estimated",
    "potassium_estimated": "Potassium_Estimated",
}


# ============================================================
# SOIL TYPE CLASSIFICATION
# ============================================================

def classify_soil_type(sand, silt, clay):
    """Simple USDA-style soil texture classification."""

    if sand is None or silt is None or clay is None:
        return None

    total = sand + silt + clay
    if total <= 0:
        return None

    sand = sand / total * 100
    silt = silt / total * 100
    clay = clay / total * 100

    if clay >= 40 and silt >= 40:
        return "Silty Clay Soil"
    if clay >= 40 and sand >= 45:
        return "Sandy Clay Soil"
    if clay >= 40:
        return "Clay Soil"
    if clay >= 27 and 20 <= sand < 45:
        return "Clay Loam Soil"
    if clay >= 27 and sand >= 45:
        return "Sandy Clay Loam Soil"
    if silt >= 50 and clay < 27:
        return "Silt Loam Soil"
    if sand >= 70 and clay < 20:
        return "Sandy Soil"
    if 43 <= sand < 70 and clay < 27:
        return "Sandy Loam Soil"
    if 20 <= clay < 27:
        return "Loam Soil"
    if silt >= 28 and sand < 52 and clay < 27:
        return "Loam Soil"

    return "Loam Soil"


# ============================================================
# PHOSPHORUS / POTASSIUM PEDOTRANSFER ESTIMATION
# ============================================================
#
# SoilGrids does NOT publish global available-P or exchangeable-K
# layers (they require lab extraction methods like Olsen/Bray/
# Mehlich that vary by region and aren't mapped globally). Rather
# than depend on a third-party API that may not have global
# coverage or reliable uptime, these are estimated from properties
# already retrieved (organic carbon, CEC, clay, pH) using standard
# agronomic pedotransfer relationships.
#
# These are APPROXIMATIONS, not lab-measured soil-test values.
# ============================================================

def estimate_phosphorus(organic_carbon, soil_ph, clay):
    """
    Rough pedotransfer estimate of plant-available phosphorus
    (ppm, Olsen-P-like scale).

    Basis:
      - Organic carbon is a major source of mineralizable P, so
        higher OC generally correlates with higher available P.
      - P availability peaks near neutral pH (~6.5) and drops off
        in acidic soils (Fe/Al fixation) and alkaline soils (Ca
        fixation).
      - Higher clay content increases P fixation onto Fe/Al oxide
        surfaces, reducing what's actually plant-available.
    """

    if organic_carbon is None or soil_ph is None or clay is None:
        return None

    base_p = organic_carbon * 8.0

    if soil_ph < 5.5:
        ph_factor = 0.6
    elif soil_ph <= 7.5:
        ph_factor = 1.0
    else:
        ph_factor = 0.7

    clay_factor = max(0.5, 1 - (clay / 100.0) * 0.5)

    p_estimate = base_p * ph_factor * clay_factor
    return round(max(0.0, p_estimate), 2)


def estimate_potassium(cec, clay):
    """
    Rough pedotransfer estimate of exchangeable potassium (ppm).

    Basis:
      - Exchangeable K sits on cation exchange sites, so it scales
        with CEC.
      - Typical agricultural soils hold roughly 2-5% of their CEC
        as exchangeable K; clay-rich soils (more 2:1 clay minerals)
        hold K more tightly and in higher proportion.
      - cmol(+)/kg is converted to ppm using K's equivalent weight
        (atomic weight 39, charge +1 -> 1 cmol(+)/kg = ~391 ppm).
    """

    if cec is None or clay is None:
        return None

    k_fraction = 0.03 + (clay / 100.0) * 0.02
    k_cmol = cec * k_fraction
    k_ppm = k_cmol * 391

    return round(max(0.0, k_ppm), 2)


# ============================================================
# GET ONE SOIL VALUE
# ============================================================

def get_soil_value(latitude, longitude, property_name):
    config = SOIL_PROPERTIES[property_name]
    map_name, coverage, scale = config["map"], config["coverage"], config["scale"]

    buffer = 0.01
    min_lon, max_lon = longitude - buffer, longitude + buffer
    min_lat, max_lat = latitude - buffer, latitude + buffer

    url = f"{BASE_URL}?map=/map/{map_name}.map"
    params = {
        "SERVICE": "WCS",
        "VERSION": "2.0.1",
        "REQUEST": "GetCoverage",
        "COVERAGEID": coverage,
        "FORMAT": "GEOTIFF_INT16",
        "SUBSETTINGCRS": "http://www.opengis.net/def/crs/EPSG/0/4326",
        "OUTPUTCRS": "http://www.opengis.net/def/crs/EPSG/0/4326",
        "SUBSET": [f"X({min_lon},{max_lon})", f"Y({min_lat},{max_lat})"],
    }

    # --------------------------------------------------------
    # Request with retry
    # --------------------------------------------------------
    response = None
    for attempt in range(3):
        try:
            response = requests.get(url, params=params, timeout=120)
            break
        except requests.exceptions.ConnectionError as e:
            print(f"{property_name}: Connection failed (attempt {attempt + 1}/3)")
            if attempt == 2:
                raise e
            time.sleep(3)

    print(f"{property_name} STATUS: {response.status_code}")
    print(f"{property_name} CONTENT TYPE: {response.headers.get('Content-Type')}")
    print(f"{property_name} SIZE: {len(response.content)}")

    response.raise_for_status()

    # Status code 200 does not guarantee TIFF -- SoilGrids can
    # return HTML/XML errors with status 200.
    content_type = response.headers.get("Content-Type", "").lower()
    if "tiff" not in content_type and "geotiff" not in content_type:
        print(f"\nSoilGrids did not return a TIFF for {property_name}.")
        print("Content-Type:", content_type)
        print("Response:", response.text[:1000])
        raise ValueError(
            f"SoilGrids returned {content_type} instead of TIFF for {property_name}"
        )

    # --------------------------------------------------------
    # Read TIFF from memory
    # --------------------------------------------------------
    try:
        with rasterio.MemoryFile(BytesIO(response.content)) as memfile:
            with memfile.open() as src:
                raster = src.read(1)
                row, col = src.index(longitude, latitude)

                if row < 0 or row >= src.height or col < 0 or col >= src.width:
                    raise ValueError(
                        f"Coordinate is outside returned raster for {property_name}"
                    )

                raw_value = raster[row, col]
                nodata = src.nodata

                def is_invalid(val):
                    if val is None or not np.isfinite(val):
                        return True
                    if nodata is not None and val == nodata:
                        return True
                    if val == 0:
                        return True
                    return False

                # Nodata / zero -> search surrounding pixels
                if is_invalid(raw_value):
                    for radius in [3, 7, 15, 30]:
                        r_min, r_max = max(0, row - radius), min(src.height, row + radius + 1)
                        c_min, c_max = max(0, col - radius), min(src.width, col + radius + 1)

                        window = raster[r_min:r_max, c_min:c_max]
                        valid_mask = (window != 0) & np.isfinite(window)
                        if nodata is not None:
                            valid_mask &= window != nodata

                        valid_vals = window[valid_mask]
                        if len(valid_vals) > 0:
                            raw_value = float(np.mean(valid_vals))
                            print(
                                f"{property_name}: Extracted non-zero mean "
                                f"({raw_value:.2f}) from surrounding {radius}px area."
                            )
                            break

                if is_invalid(raw_value):
                    raise ValueError(
                        f"No valid non-zero data returned for {property_name} "
                        f"in target or surrounding area."
                    )

                raw_value = float(raw_value)

    except Exception as e:
        raise ValueError(f"Could not read SoilGrids {property_name} raster: {e}")

    return round(raw_value / scale, 3)


# ============================================================
# GET ALL SOIL DATA (BY LAT/LONG)
# ============================================================

def get_soil(latitude, longitude):
    """Retrieve soil properties automatically from SoilGrids."""

    print("\nRetrieving SoilGrids data...")
    print(f"Latitude: {latitude}")
    print(f"Longitude: {longitude}")

    soil_data = {}

    # --------------------------------------------------------
    # 1. Retrieve SoilGrids properties
    # --------------------------------------------------------
    for property_name in SOIL_PROPERTIES:
        val = None
        coords_to_try = [
            (latitude, longitude),
            (latitude + 0.02, longitude),
            (latitude - 0.02, longitude),
            (latitude, longitude + 0.02),
            (latitude, longitude - 0.02),
            (latitude + 0.05, longitude + 0.05),
            (latitude - 0.05, longitude - 0.05),
        ]
        for lat_try, lon_try in coords_to_try:
            try:
                v = get_soil_value(lat_try, lon_try, property_name)
                if v is not None and v > 0:
                    val = v
                    break
            except Exception:
                continue

        soil_data[property_name] = val

    # --------------------------------------------------------
    # 2. Soil type
    # --------------------------------------------------------
    sand, silt, clay = soil_data.get("sand"), soil_data.get("silt"), soil_data.get("clay")
    soil_data["soil_type"] = classify_soil_type(sand, silt, clay)

    # --------------------------------------------------------
    # 3. Available water
    # --------------------------------------------------------
    field_capacity = soil_data.get("field_capacity")
    wilting_point = soil_data.get("wilting_point")

    if field_capacity and wilting_point:
        soil_data["available_water"] = round(max(0.0, field_capacity - wilting_point), 3)
    else:
        soil_data["available_water"] = None

    # --------------------------------------------------------
    # 4. Fallback defaults for missing/zero values
    # --------------------------------------------------------
    for key, def_val in DEFAULTS.items():
        if not soil_data.get(key):
            soil_data[key] = def_val

    if not soil_data.get("soil_type"):
        soil_data["soil_type"] = (
            classify_soil_type(soil_data.get("sand"), soil_data.get("silt"), soil_data.get("clay"))
            or "Loam Soil"
        )

    # --------------------------------------------------------
    # 5. Phosphorus / potassium (pedotransfer estimates)
    # --------------------------------------------------------
    # SoilGrids has no global P/K layers, so these are derived
    # from properties already fetched above. They are estimates,
    # not lab soil-test values -- see `npk_estimate_note` below.
    soil_data["phosphorus_estimated"] = estimate_phosphorus(
        organic_carbon=soil_data.get("organic_carbon"),
        soil_ph=soil_data.get("soil_ph"),
        clay=soil_data.get("clay"),
    )
    soil_data["potassium_estimated"] = estimate_potassium(
        cec=soil_data.get("cec"),
        clay=soil_data.get("clay"),
    )
    soil_data["npk_estimate_note"] = (
        "phosphorus_estimated and potassium_estimated are pedotransfer-based "
        "approximations derived from organic carbon, CEC, clay, and pH -- not "
        "lab-measured Olsen-P / exchangeable-K soil test results. Treat as a "
        "rough planning signal only; if a downstream model was trained on real "
        "N-P-K soil-test data, feeding it these estimated values will degrade "
        "its accuracy."
    )

    # --------------------------------------------------------
    # 6. Title_Case keys for legacy/pickle schema compatibility
    # --------------------------------------------------------
    for key, title_key in TITLE_MAPPING.items():
        soil_data[title_key] = soil_data[key]

    print("\nFINAL SOIL DATA (with spatial surrounding search & non-zero fallbacks):")
    for key, value in soil_data.items():
        print(f"{key}: {value}")

    return soil_data


# ============================================================
# GET ALL SOIL DATA (BY STATE / DISTRICT)
# ============================================================

def get_soil_by_location(state, district, village=None):
    """
    Convenience wrapper: resolves a state/district/village into
    coordinates using the shared get_location() geocoder, then
    retrieves soil data for that location exactly as get_soil()
    would.

    Example:
        get_soil_by_location("Telangana", "Hyderabad")
        get_soil_by_location("Telangana", "Hyderabad", "Gachibowli")
    """

    location = get_location(state, district, village)

    latitude = location["latitude"]
    longitude = location["longitude"]

    if latitude is None or longitude is None:
        raise ValueError(
            f"get_location() did not return coordinates for "
            f"state='{state}', district='{district}', village='{village}'"
        )

    soil_data = get_soil(latitude, longitude)

    # Record what was resolved (including whatever the geocoder
    # normalized the names to), so callers can see exactly which
    # location and coordinates the soil data came from.
    soil_data["location"] = location
    soil_data["latitude"] = latitude
    soil_data["longitude"] = longitude

    return soil_data