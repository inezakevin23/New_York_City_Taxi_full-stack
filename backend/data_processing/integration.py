import pandas as pd
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = (BASE_DIR / ".." / "data").resolve()

taxi_zone_lookup = DATA_DIR / "taxi_zone_lookup.csv"
trip_data = DATA_DIR / "yellow_tripdata_2019-01.csv"
taxi_zones_geojson = DATA_DIR / "taxi_zones.geojson"

# Data loading functions
def load_trip_data(trip_data):
    df = pd.read_csv(trip_data)
    print(f"Loaded trip data from {trip_data}")
    return df

def load_taxi_zone_lookup(taxi_zone_lookup):
    df = pd.read_csv(taxi_zone_lookup)
    print(f"Loaded taxi zone lookup from {taxi_zone_lookup}")
    return df

def load_taxi_zones_geojson(geojson_path):
    with open(geojson_path, 'r') as f:
        data = json.load(f)
    print(f"Loaded taxi zones GeoJSON from {geojson_path}")
    return data

# Data integration function
def integrate_data(trips, zones):
    # Merge on pickup location
    zones_pu = zones[["LocationID", "Borough", "Zone", "service_zone"]].copy()
    trips = trips.merge(
        zones_pu,
        left_on="PULocationID",
        right_on="LocationID",
        how="left"
    )
    trips = trips.rename(columns={
        "Borough": "PU_Borough",
        "Zone": "PU_Zone",
        "service_zone": "PU_Service_Zone"
    })
    trips = trips.drop(columns=["LocationID"])
    
    # Merge on dropoff location
    zones_do = zones[["LocationID", "Borough", "Zone", "service_zone"]].copy()
    zones_do = zones_do.rename(columns={
        "Borough": "DO_Borough",
        "Zone": "DO_Zone",
        "service_zone": "DO_Service_Zone"
    })
    trips = trips.merge(
        zones_do,
        left_on="DOLocationID",
        right_on="LocationID",
        how="left"
    )
    trips = trips.drop(columns=["LocationID"])
    
    print("Integrated trip data with zone information")
    return trips

if __name__ == "__main__":
    trips = load_trip_data(trip_data)
    zones = load_taxi_zone_lookup(taxi_zone_lookup)
    geojson = load_taxi_zones_geojson(taxi_zones_geojson)
    
    integrated_trips = integrate_data(trips, zones)
    print(integrated_trips.head())
    print(integrated_trips.columns)
    