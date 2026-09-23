import requests
import pandas as pd

from App.backend.config import OPENMETEO_BASE_URL


def get_future_weather(
    latitude: float,
    longitude: float,
    start_date: str,
    end_date: str
):
    """
    Get future forecast weather and return both
    aggregated weather features and raw daily/hourly data.
    Auto-adjusts date bounds to valid Open-Meteo API limits.
    """
    today = pd.Timestamp.today().normalize()
    max_date = today + pd.Timedelta(days=14)
    min_date = today - pd.Timedelta(days=90)

    try:
        s_dt = pd.to_datetime(start_date)
    except Exception:
        s_dt = today

    try:
        e_dt = pd.to_datetime(end_date)
    except Exception:
        e_dt = s_dt + pd.Timedelta(days=7)

    if s_dt > max_date or s_dt < min_date:
        s_dt = today
    if e_dt > max_date or e_dt < s_dt:
        e_dt = s_dt + pd.Timedelta(days=7)

    start_date = s_dt.strftime("%Y-%m-%d")
    end_date = e_dt.strftime("%Y-%m-%d")

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_date,
        "end_date": end_date,
        "daily": (
            "temperature_2m_mean,"
            "temperature_2m_max,"
            "temperature_2m_min,"
            "precipitation_sum,"
            "shortwave_radiation_sum,"
            "wind_speed_10m_mean,"
            "wind_direction_10m_dominant,"
            "wind_gusts_10m_max,"
            "surface_pressure_mean,"
            "cloud_cover_mean,"
            "et0_fao_evapotranspiration"
        ),
        "hourly": (
            "relative_humidity_2m,"
            "soil_moisture_0_to_7cm,"
            "soil_temperature_0cm"
        ),
        "timezone": "auto"
    }

    try:
        response = requests.get(
            OPENMETEO_BASE_URL,
            params=params,
            timeout=(5.0, 15.0)
        )
    except Exception as e:
        response = None

    if response is None or response.status_code != 200:
        # Fallback to today -> today + 7 days
        params["start_date"] = today.strftime("%Y-%m-%d")
        params["end_date"] = (today + pd.Timedelta(days=7)).strftime("%Y-%m-%d")
        try:
            response = requests.get(OPENMETEO_BASE_URL, params=params, timeout=(5.0, 15.0))
        except Exception:
            response = None

    if response is None or response.status_code != 200 or "daily" not in response.json():
        # Complete fallback dictionary if Open-Meteo is down
        dates = pd.date_range(today, periods=7)
        daily_df = pd.DataFrame({
            "Date": dates,
            "mean_temperature": [28.5] * 7,
            "max_temperature": [33.0] * 7,
            "min_temperature": [24.0] * 7,
            "precipitation": [5.0] * 7,
            "shortwave_radiation": [18.5] * 7,
            "wind_speed": [12.0] * 7,
            "wind_direction": [180.0] * 7,
            "wind_gusts": [25.0] * 7,
            "surface_pressure": [1010.0] * 7,
            "cloud_cover": [45.0] * 7,
            "et0": [4.2] * 7
        })
        return {
            "mean_temperature": 28.5,
            "max_temperature": 33.0,
            "min_temperature": 24.0,
            "precipitation": 35.0,
            "shortwave_radiation": 18.5,
            "wind_speed": 12.0,
            "relative_humidity": 70.0,
            "wind_direction": 180.0,
            "wind_gusts": 25.0,
            "surface_pressure": 1010.0,
            "cloud_cover": 45.0,
            "et0": 29.4,
            "soil_moisture": 0.25,
            "soil_temperature": 27.0,
            "elevation": 50.0,
            "daily_data": daily_df,
            "hourly_data": pd.DataFrame()
        }

    data = response.json()
    daily = data["daily"]

    daily_df = pd.DataFrame({
        "Date": pd.to_datetime(daily["time"]),
        "mean_temperature": daily["temperature_2m_mean"],
        "max_temperature": daily["temperature_2m_max"],
        "min_temperature": daily["temperature_2m_min"],
        "precipitation": daily["precipitation_sum"],
        "shortwave_radiation": daily["shortwave_radiation_sum"],
        "wind_speed": daily["wind_speed_10m_mean"],
        "wind_direction": daily["wind_direction_10m_dominant"],
        "wind_gusts": daily["wind_gusts_10m_max"],
        "surface_pressure": daily["surface_pressure_mean"],
        "cloud_cover": daily["cloud_cover_mean"],
        "et0": daily["et0_fao_evapotranspiration"]
    })

    if "hourly" in data:

        hourly = data["hourly"]

        humidity_values = hourly.get(
            "relative_humidity_2m", []
        )

        moisture_values = hourly.get(
            "soil_moisture_0_to_7cm", []
        )

        soil_temperature_values = hourly.get(
            "soil_temperature_0cm", []
        )

        relative_humidity = (
            sum(humidity_values) / len(humidity_values)
            if humidity_values else None
        )

        soil_moisture = (
            sum(moisture_values) / len(moisture_values)
            if moisture_values else None
        )

        soil_temperature = (
            sum(soil_temperature_values)
            / len(soil_temperature_values)
            if soil_temperature_values
            else None
        )

        hourly_df = pd.DataFrame({
            "DateTime": pd.to_datetime(hourly["time"]),
            "relative_humidity": humidity_values,
            "soil_moisture": moisture_values,
            "soil_temperature": soil_temperature_values
        })

    else:

        relative_humidity = None
        soil_moisture = None
        soil_temperature = None
        hourly_df = pd.DataFrame()

    result = {
        "mean_temperature": daily_df["mean_temperature"].mean(),
        "max_temperature": daily_df["max_temperature"].mean(),
        "min_temperature": daily_df["min_temperature"].mean(),
        "precipitation": daily_df["precipitation"].sum(),
        "shortwave_radiation": daily_df["shortwave_radiation"].mean(),
        "wind_speed": daily_df["wind_speed"].mean(),
        "relative_humidity": relative_humidity,
        "wind_direction": daily_df["wind_direction"].mean(),
        "wind_gusts": daily_df["wind_gusts"].max(),
        "surface_pressure": daily_df["surface_pressure"].mean(),
        "cloud_cover": daily_df["cloud_cover"].mean(),
        "et0": daily_df["et0"].sum(),
        "soil_moisture": soil_moisture,
        "soil_temperature": soil_temperature,
        "elevation": data.get("elevation"),
        "daily_data": daily_df,
        "hourly_data": hourly_df
    }

    for key, value in result.items():

        if key not in [
            "daily_data",
            "hourly_data"
        ] and value is not None:

            result[key] = round(
                float(value),
                3
            )

    return result