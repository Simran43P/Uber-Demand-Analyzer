import joblib
import pandas as pd
import math
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut

class UberPredictor:
    def __init__(self):
        # 1. Load all 5 components once during initialization
        print("Loading ML models and lookup tables...")
        self.kmeans = joblib.load('uber_kmeans.pkl')
        self.model = joblib.load('uber_model.pkl')
        self.cluster_labels = joblib.load('uber_cluster_labels.pkl')
        self.share_table = joblib.load('uber_share_table.pkl')
        self.surge_lookup = joblib.load('uber_surge_lookup.pkl')
        
        # Hardcoded from your training data analysis
        self.avg_demand = 1530 
        self.geolocator = Nominatim(user_agent="uber_demand_analyzer")

    def haversine(self, lat1, lon1, lat2, lon2):
        """Calculates the great-circle distance between two points in kilometers."""
        R = 6371 # Earth radius in km
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        
        a = math.sin(dphi/2)**2 + \
            math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
        
        return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    def get_coordinates(self, location_name):
        try:
            # We append New York City to keep results localized to your training data
            location = self.geolocator.geocode(location_name + ", New York City")
            if location:
                return location.latitude, location.longitude
            return None, None
        except GeocoderTimedOut:
            return None, None

    def predict(self, location_name, hour, weekday, month=4):
        # 1. Get Lat/Lon from User Input
        lat, lon = self.get_coordinates(location_name)
        if lat is None:
            return {"error": f"Could not find coordinates for '{location_name}'"}

        # 2. Identify Driver's Current Cluster
        coords_df = pd.DataFrame([[lat, lon]], columns=['Lat', 'Lon'])
        driver_cluster = int(self.kmeans.predict(coords_df)[0])
        driver_zone = self.cluster_labels[driver_cluster]

        # 3. Predict Total City-Wide Demand
        features = pd.DataFrame([[hour, weekday, month]], columns=['Hour', 'Weekday', 'Month'])
        total_predicted = self.model.predict(features)[0]

        # 4. Analyze All Hotspots
        predictions = []
        for cluster_id, zone_name in self.cluster_labels.items():
            center_lat = self.kmeans.cluster_centers_[cluster_id][0]
            center_lon = self.kmeans.cluster_centers_[cluster_id][1]

            # Find the historical 'share' of rides for this cluster at this time
            match = self.share_table[
                (self.share_table['Hour'] == hour) &
                (self.share_table['Weekday'] == weekday) &
                (self.share_table['cluster'] == cluster_id)
            ]
            
            share = float(match['share'].values[0]) if not match.empty else 0.2
            cluster_rides = int(total_predicted * share)
            dist = self.haversine(lat, lon, center_lat, center_lon)

            predictions.append({
                'hotspot_name': zone_name,
                'rides': max(0, cluster_rides), # Ensure no negative rides
                'distance_km': dist
            })

        # 5. Calculate Recommendation Scores
        pred_df = pd.DataFrame(predictions)
        max_rides = pred_df['rides'].max() if pred_df['rides'].max() > 0 else 1
        max_dist = pred_df['distance_km'].max() if pred_df['distance_km'].max() > 0 else 1
        
        # Your custom scoring formula
        pred_df['score'] = (
            (pred_df['rides'] / max_rides) * 0.7 -
            (pred_df['distance_km'] / max_dist) * 0.3
        )

        best = pred_df.sort_values('score', ascending=False).iloc[0]
        current_zone_data = pred_df[pred_df['hotspot_name'] == driver_zone].iloc[0]

        # 6. Determine Surge Level
        surge_row = self.surge_lookup[
            (self.surge_lookup['Hour'] == hour) & 
            (self.surge_lookup['Weekday'] == weekday)
        ]
        total_actual = int(surge_row['total_pickups'].values[0]) if not surge_row.empty else self.avg_demand
        
        surge_val = round(min(max(total_actual / self.avg_demand, 1.0), 2.5), 1)
        
        if   surge_val >= 2.0: level = "PEAK"
        elif surge_val >= 1.5: level = "HIGH"
        elif surge_val >= 1.2: level = "MODERATE"
        else:                  level = "LOW"

        # Final Response Object
        return {
            'status': 'success',
            'input_location': location_name,
            'coords': {'lat': lat, 'lon': lon},
            'your_zone': driver_zone,
            'current_rides': int(current_zone_data['rides']),
            'best_hotspot': best['hotspot_name'],
            'distance_km': round(float(best['distance_km']), 1),
            'hotspot_rides': int(best['rides']),
            'surge': surge_val,
            'level': level
        }