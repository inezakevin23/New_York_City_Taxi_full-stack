# data cleaning script for integrated taxi trip data
import pandas as pd
import json
from pathlib import Path
from datetime import datetime
from integration import load_trip_data, load_taxi_zone_lookup, integrate_data
import numpy as np

def clean_data(df):

    issue_counts = {}
    original_count = len(df)
    print(f"Original record count: {original_count}")
    
    #removing duplicates
    before = len(df)
    df = df.drop_duplicates()
    issue_counts['duplicates'] = before - len(df)

    # Removing rows with missing critical values
    before = len(df)
    critical = ['VendorID', 'tpep_pickup_datetime', 'tpep_dropoff_datetime', 'PULocationID', 'DOLocationID', 'trip_distance', 'fare_amount']
    df = df.dropna(subset=critical)
    issue_counts['missing_critical'] = before - len(df)

    # converting datetimes
    df['tpep_pickup_datetime'] = pd.to_datetime(df['tpep_pickup_datetime'], errors='coerce')
    df['tpep_dropoff_datetime'] = pd.to_datetime(df['tpep_dropoff_datetime'], errors='coerce')

    # ensuring numeric types
    numeric_cols = ['VendorID', 'trip_distance', 'fare_amount', 'passenger_count', 'PULocationID', 'DOLocationID', 'total_amount', 'tip_amount', 'extra', 'mta_tax', 'tolls_amount']
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # removing logical outliers
    before = len(df)
    df = df[df['trip_distance'] > 0]
    issue_counts['nonpositive_trip_distance'] = before - len(df)

    before = len(df)
    df = df[df['fare_amount'] > 0]
    issue_counts['negative_fare_amount'] = before - len(df)

    before = len(df)
    df = df[df['tpep_dropoff_datetime'] > df['tpep_pickup_datetime']]
    issue_counts['dropoff_before_pickup'] = before - len(df)

    before = len(df)
    df = df[df['passenger_count'] > 0]
    issue_counts['nonpositive_passenger_count'] = before - len(df)

    # upper bounds
    before = len(df)
    df = df[df['trip_distance'] < 200]
    issue_counts['huge_trip_distance'] = before - len(df)

    before = len(df)
    df = df[df['fare_amount'] < 1000]
    issue_counts['huge_fare_amount'] = before - len(df)

    cleaned_count = len(df)
    issue_counts['cleaned_count'] = cleaned_count
    issue_counts['removed_total'] = original_count - cleaned_count

    print(f"Cleaned record count: {cleaned_count} (removed {original_count - cleaned_count} records)")

    with open(Path(__file__).resolve().parent / ".." /".." / "cleaning_report.txt", "w") as f:
        for issue, count in issue_counts.items():
            f.write(f"{issue}: {count}\n")
    return df, issue_counts


# finding derived features
def find_derived_features(df):
    # trip duration in minutes
    df['trip_duration'] = (df['tpep_dropoff_datetime'] - df['tpep_pickup_datetime']).dt.total_seconds() / 60
    # fare per mile
    df['fare_per_mile'] = np.where(df['trip_distance'] > 0, df['fare_amount'] / df['trip_distance'], np.nan)
    # trip speed in miles per hour
    df['trip_speed'] = np.where(df['trip_duration'] > 0, df['trip_distance'] / (df['trip_duration'] / 60), np.nan)
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
    cleaned_trips, issue_counts = clean_data(integrated_trips)
    print("data cleaning completed")
    # finding derived features
    final_trips = find_derived_features(cleaned_trips)
    print("derived features added")