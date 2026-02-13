# data cleaning script for integrated taxi trip data
import pandas as pd
import json
from pathlib import Path
from datetime import datetime
from integration import load_trip_data, load_taxi_zone_lookup, integrate_data

def clean_data(df):
    original_count = len(df)
    print(f"Original record count: {original_count}")
    #removing duplicates
    df = df.drop_duplicates()
    # removing rows with missing critical values
    df = df.dropna(subset=['VendorID', 'tpep_pickup_datetime', 'tpep_dropoff_datetime', 'PULocationID', 'DOLocationID', 'trip_distance', 'fare_amount'])
    
    # Converting datetimes
    df['tpep_pickup_datetime'] = pd.to_datetime(df['tpep_pickup_datetime'], errors='coerce')
    df['tpep_dropoff_datetime'] = pd.to_datetime(df['tpep_dropoff_datetime'], errors='coerce')
    
    # removing logical outliers
    df = df[df['trip_distance'] > 0]
    df = df[df['fare_amount'] >= 0]
    df = df[df['tpep_dropoff_datetime'] > df['tpep_pickup_datetime']]
    df = df[df['passenger_count'] > 0]
    df = df[df['trip_distance'] < 200]
    df = df[df['fare_amount'] < 1000]
    cleaned_count = len(df)
    print(f"Cleaned record count: {cleaned_count} (removed {original_count - cleaned_count} records)")
    
    return df

if __name__ == "__main__":
    # loading data
    trip_data = Path(__file__).resolve().parent / ".." / "data" / "yellow_tripdata_2019-01.csv"
    taxi_zone_lookup = Path(__file__).resolve().parent / ".." / "data" / "taxi_zone_lookup.csv"
    trips = load_trip_data(trip_data)
    zones = load_taxi_zone_lookup(taxi_zone_lookup)
    # integrating data
    integrated_trips = integrate_data(trips, zones)
    # cleaning data
    cleaned_trips = clean_data(integrated_trips)
    print("data cleaning completed")