from pydantic import BaseModel, Field


# =========================================================
# CROP RECOMMENDATION
# =========================================================

class CropRequest(BaseModel):

    nitrogen: float = Field(
        ...,
        description="Nitrogen in kg/ha"
    )

    phosphorus: float = Field(
        ...,
        description="Phosphorus in kg/ha"
    )

    potassium: float = Field(
        ...,
        description="Potassium in kg/ha"
    )

    temperature: float = Field(
        ...,
        description="Temperature in °C"
    )

    humidity: float = Field(
        ...,
        description="Relative humidity in %"
    )

    ph: float = Field(
        ...,
        description="Soil pH"
    )

    rainfall: float = Field(
        ...,
        description="Rainfall in mm"
    )


# =========================================================
# CLIMATE RISK
# =========================================================

class ClimateRequest(BaseModel):

    season: str

    soil_moisture: float
    soil_temperature: float
    soil_ph: float
    organic_carbon: float

    clay: float
    sand: float
    silt: float

    elevation: float

    heat_index: float

    rainfall_last_7_days: float
    rainfall_last_30_days: float

    consecutive_dry_days: float
    growing_degree_days: float

    crop: str


# =========================================================
# IRRIGATION
# =========================================================

class IrrigationRequest(BaseModel):

    kc_band: str

    state: str

    climate_risk: str

    growth_stage: str


# =========================================================
# YIELD
# =========================================================

class YieldRequest(BaseModel):

    state: str
    district: str

    latitude: float
    longitude: float

    year: int

    season: str
    crop: str

    area: float
    production: float

    mean_temperature: float
    max_temperature: float
    min_temperature: float

    precipitation: float

    shortwave_radiation: float
    wind_speed: float
    relative_humidity: float

    et0: float

    soil_moisture: float
    soil_temperature: float

    soil_ph: float
    organic_carbon: float

    clay: float
    sand: float
    silt: float

    elevation: float


# =========================================================
# MARKET PRICE
# =========================================================

class MarketRequest(BaseModel):

    commodity: str

    state: str
    district: str

    day: int
    month: int
    year: int

    quarter: int

    arrival_quantity: float