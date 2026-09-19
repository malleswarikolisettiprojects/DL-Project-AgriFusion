import pandas as pd


def calculate_heat_index(temperature, humidity):

    temperature_f = (
        temperature * 9 / 5
    ) + 32

    heat_index_f = (
        -42.379
        + 2.04901523 * temperature_f
        + 10.14333127 * humidity
        - 0.22475541 * temperature_f * humidity
        - 0.00683783 * temperature_f ** 2
        - 0.05481717 * humidity ** 2
        + 0.00122874 * temperature_f ** 2 * humidity
        + 0.00085282 * temperature_f * humidity ** 2
        - 0.00000199 * temperature_f ** 2 * humidity ** 2
    )

    return (
        heat_index_f - 32
    ) * 5 / 9


def calculate_climate_features(weather):

    daily_df = weather["daily_data"].copy()
    hourly_df = weather["hourly_data"].copy()

    if daily_df.empty:
        raise ValueError(
            "Daily weather data is empty."
        )

    daily_df["Date"] = (
        daily_df["Date"].dt.date
    )

    # Use hourly data for per-day humidity if available;
    # fall back to the aggregated humidity value from the weather dict.
    if not hourly_df.empty and "DateTime" in hourly_df.columns:
        hourly_df["Date"] = (
            hourly_df["DateTime"].dt.date
        )
        humidity_df = (
            hourly_df
            .groupby("Date")["relative_humidity"]
            .mean()
            .reset_index()
        )
        daily_df = daily_df.merge(
            humidity_df,
            on="Date",
            how="left"
        )
        daily_df["relative_humidity"] = (
            daily_df["relative_humidity"]
            .fillna(weather.get("relative_humidity") or 70.0)
        )
    else:
        # Fallback: use the aggregated humidity scalar for every day
        daily_df["relative_humidity"] = (
            weather.get("relative_humidity") or 70.0
        )

    daily_df["Heat_Index"] = daily_df.apply(
        lambda row: calculate_heat_index(
            row["mean_temperature"],
            row["relative_humidity"]
        ),
        axis=1
    )

    daily_df["Rainfall_Last_7_Days"] = (
        daily_df["precipitation"]
        .rolling(7, min_periods=1)
        .sum()
    )

    daily_df["Rainfall_Last_30_Days"] = (
        daily_df["precipitation"]
        .rolling(30, min_periods=1)
        .sum()
    )

    dry = (
        daily_df["precipitation"] < 1.0
    )

    daily_df["Consecutive_Dry_Days"] = (
        dry
        .groupby((~dry).cumsum())
        .cumsum()
    )

    base_temperature = 10

    daily_df["Growing_Degree_Days"] = (
        (
            daily_df["max_temperature"]
            + daily_df["min_temperature"]
        ) / 2
        - base_temperature
    ).clip(lower=0)

    latest = daily_df.iloc[-1]

    return {
        "Heat_Index": round(
            float(latest["Heat_Index"]),
            3
        ),

        "Rainfall_Last_7_Days": round(
            float(
                latest["Rainfall_Last_7_Days"]
            ),
            3
        ),

        "Rainfall_Last_30_Days": round(
            float(
                latest["Rainfall_Last_30_Days"]
            ),
            3
        ),

        "Consecutive_Dry_Days": int(
            latest["Consecutive_Dry_Days"]
        ),

        "Growing_Degree_Days": round(
            float(
                latest["Growing_Degree_Days"]
            ),
            3
        )
    }