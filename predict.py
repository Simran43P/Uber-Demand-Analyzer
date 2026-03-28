"""
HotspotAI — predict.py
Loads trained models and exposes a single predict() function.
"""

import math
import warnings
import joblib
import numpy as np
import pandas as pd
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut

warnings.filterwarnings("ignore")


# ── Load all 5 pkl model files ──────────────────────
kmeans         = joblib.load("uber_kmeans.pkl")
linear_model   = joblib.load("uber_model.pkl")
share_table    = joblib.load("uber_share_table.pkl")
surge_lookup   = joblib.load("uber_surge_lookup.pkl")
cluster_labels = joblib.load("uber_cluster_labels.pkl")

# Derived constant used for surge normalisation
avg_demand = surge_lookup['total_pickups'].mean()

# ── Geolocator ──────────────────────────────────────
geolocator = Nominatim(user_agent="uber_demand_predictor")


# ── Helpers ─────────────────────────────────────────
def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return the great-circle distance (km) between two lat/lon points."""
    R = 6371
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_coordinates(location_name: str):
    """Geocode a location string to (lat, lon). Returns (None, None) on failure."""
    try:
        location = geolocator.geocode(location_name + ", New York City")
        if location:
            return location.latitude, location.longitude
        return None, None
    except GeocoderTimedOut:
        return None, None


# ── Main prediction function ─────────────────────────
def predict(location_name: str, hour: int, weekday: int, month: int = 4):
    """
    Predict ride demand and surge for the given location and time.

    Parameters
    ----------
    location_name : str   e.g. "Times Square"
    hour          : int   0–23
    weekday       : int   0 = Monday … 6 = Sunday
    month         : int   e.g. 4 for April

    Returns
    -------
    dict with prediction results, or None if geocoding fails.
    """
    lat, lon = get_coordinates(location_name)
    if lat is None:
        return None

    day_names  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    hour_label = f"{hour % 12 or 12} {'AM' if hour < 12 else 'PM'}"
    day_label  = day_names[weekday]

    # Which cluster is the driver currently in?
    driver_cluster = int(
        kmeans.predict(pd.DataFrame([[lat, lon]], columns=['Lat', 'Lon']))[0]
    )
    driver_zone = cluster_labels[driver_cluster]

    # Total predicted rides for this time slot
    total_predicted = linear_model.predict(
        pd.DataFrame([[hour, weekday, month]], columns=['Hour', 'Weekday', 'Month'])
    )[0]

    # Build per-cluster predictions
    predictions = []
    for cluster_id, zone_name in cluster_labels.items():
        center_lat = kmeans.cluster_centers_[cluster_id][0]
        center_lon = kmeans.cluster_centers_[cluster_id][1]

        match = share_table[
            (share_table['Hour']    == hour) &
            (share_table['Weekday'] == weekday) &
            (share_table['cluster'] == cluster_id)
        ]
        share         = float(match['share'].values[0]) if len(match) else 0.2
        cluster_rides = int(total_predicted * share)
        dist          = haversine(lat, lon, center_lat, center_lon)

        predictions.append({
            'hotspot_name': zone_name,
            'rides':        cluster_rides,
            'distance_km':  dist
        })

    pred_df   = pd.DataFrame(predictions)
    max_rides = pred_df['rides'].max()
    max_dist  = pred_df['distance_km'].max()

    # Score = 70 % demand, 30 % proximity
    pred_df['score'] = (
        (pred_df['rides'] / max_rides) * 0.7 -
        (pred_df['distance_km'] / max_dist) * 0.3
    )

    best         = pred_df.sort_values('score', ascending=False).iloc[0]
    current_zone = pred_df[pred_df['hotspot_name'] == driver_zone].iloc[0]

    # Surge multiplier
    surge_row    = surge_lookup[
        (surge_lookup['Hour'] == hour) & (surge_lookup['Weekday'] == weekday)
    ]
    total_actual = int(surge_row['total_pickups'].values[0]) if len(surge_row) else avg_demand
    surge        = round(min(max(total_actual / avg_demand, 1.0), 2.5), 1)

    if   surge >= 2.0: level = "PEAK"
    elif surge >= 1.5: level = "HIGH"
    elif surge >= 1.2: level = "MODERATE"
    else:              level = "LOW"

    # Helper: get cluster centre for a zone name
    def centre(zone):
        cid = [k for k, v in cluster_labels.items() if v == zone][0]
        return (
            round(float(kmeans.cluster_centers_[cid][0]), 5),
            round(float(kmeans.cluster_centers_[cid][1]), 5)
        )

    best_lat, best_lon = centre(best['hotspot_name'])

    return {
        'driver_lat':    round(lat, 5),
        'driver_lon':    round(lon, 5),
        'hour_label':    hour_label,
        'day_label':     day_label,
        'your_zone':     driver_zone,
        'current_rides': int(current_zone['rides']),
        'best_hotspot':  best['hotspot_name'],
        'best_lat':      best_lat,
        'best_lon':      best_lon,
        'distance_km':   round(float(best['distance_km']), 1),
        'hotspot_rides': int(best['rides']),
        'surge':         surge,
        'level':         level,
        'all_hotspots':  (
            pred_df
            .sort_values('score', ascending=False)
            [['hotspot_name', 'rides', 'distance_km']]
            .round({'distance_km': 1})
            .to_dict(orient='records')
        )
    }