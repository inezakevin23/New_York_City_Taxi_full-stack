import argparse
import sys
from pathlib import Path
import mysql.connector
import pandas as pd
import numpy as np

BASE_DIR = Path(__file__).resolve().parent
PROCESS_DIR = BASE_DIR.parent / "data_processing"

sys.path.append(str(PROCESS_DIR))

from cleaning import clean_data, find_derived_features
from integration import load_taxi_zone_lookup, integrate_data


def connect_db(host, user, password, database):
    return mysql.connector.connect(
        host=host,
        user=user,
        password=password,
        database=database
    )

# populating zones table first
def insert_zones(conn, zones_df):
    query = (
        "INSERT INTO zones (LocationID, Borough, Zone, service_zone) "
        "VALUES (%s, %s, %s, %s) "
        "ON DUPLICATE KEY UPDATE Borough=VALUES(Borough), Zone=VALUES(Zone), service_zone=VALUES(service_zone)"
    )
    rows = zones_df[["LocationID", "Borough", "Zone", "service_zone"]].values.tolist()

    cursor = conn.cursor()
    cursor.executemany(query, rows)
    conn.commit()

    return cursor.rowcount

def prepare_rows(df):
    rows = []

    for _, row in df.iterrows():
        rows.append((
            int(row["VendorID"]) if not pd.isna(row["VendorID"]) else None,
            pd.to_datetime(row["tpep_pickup_datetime"], errors="coerce").to_pydatetime() if not pd.isna(row["tpep_pickup_datetime"]) else None,
            pd.to_datetime(row["tpep_dropoff_datetime"], errors="coerce").to_pydatetime() if not pd.isna(row["tpep_dropoff_datetime"]) else None,
            int(row["passenger_count"]) if not pd.isna(row["passenger_count"]) else None,
            float(row["trip_distance"]) if not pd.isna(row["trip_distance"]) else None,
            float(row["trip_duration"]) if not pd.isna(row["trip_duration"]) else None,
            float(row["trip_speed"]) if not pd.isna(row["trip_speed"]) else None,
            float(row["fare_per_mile"]) if not pd.isna(row["fare_per_mile"]) else None,
            float(row["fare_amount"]) if not pd.isna(row["fare_amount"]) else None,
            float(row["extra"]) if not pd.isna(row["extra"]) else None,
            float(row["mta_tax"]) if not pd.isna(row["mta_tax"]) else None,
            float(row["tip_amount"]) if not pd.isna(row["tip_amount"]) else None,
            float(row["tolls_amount"]) if not pd.isna(row["tolls_amount"]) else None,
            float(row["total_amount"]) if not pd.isna(row["total_amount"]) else None,
            int(row["PULocationID"]) if not pd.isna(row["PULocationID"]) else None,
            int(row["DOLocationID"]) if not pd.isna(row["DOLocationID"]) else None
        ))

    return rows


def insert_batch(conn, rows):
    query = """
    INSERT INTO trips (
        VendorID, pickup_datetime, dropoff_datetime, passenger_count,
        trip_distance, trip_duration, trip_speed, fare_per_mile,
        fare_amount, extra, mta_tax, tip_amount,
        tolls_amount, total_amount, PULocationID, DOLocationID
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """

    cursor = conn.cursor()
    cursor.executemany(query, rows)
    conn.commit()

    return cursor.rowcount


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--user", default="root")
    parser.add_argument("--password", default="")
    parser.add_argument("--database", default="NYC_Taxi")
    parser.add_argument("--file", required=True)
    parser.add_argument("--batch", type=int, default=5000)
    parser.add_argument("--limit", type=int, default=None, 
                        help="Maximum number of rows to insert (optional, for testing)")

    args = parser.parse_args()

    # connecting to database
    conn = connect_db(args.host, args.user, args.password, args.database)

    # loading zones (use absolute path relative to repository layout)
    tz_path = BASE_DIR.parent / "data" / "taxi_zone_lookup.csv"
    if not tz_path.exists():
        conn.close()
        print(f"ERROR: zone lookup file not found: {tz_path}\nPlease generate `taxi_zone_lookup.csv` in the `backend/data` folder (see TESTING_GUIDE.md Step 3).")
        return
    zones = load_taxi_zone_lookup(str(tz_path))

    # insert zones into DB first
    try:
        inserted_zones = insert_zones(conn, zones)
        print(f"Inserted zones into zones table")
    except Exception as e:
        print(f"ERROR inserting zones: {e}")
        conn.close()
        return

    total_inserted = 0
    rows_processed = 0

    # reading large file in chunks
    for chunk in pd.read_csv(args.file, chunksize=args.batch):
        # respect the limit if specified
        if args.limit and rows_processed >= args.limit:
            break
        
        # trim chunk if it would exceed limit
        if args.limit and rows_processed + len(chunk) > args.limit:
            chunk = chunk.iloc[:args.limit - rows_processed]
        
        print(f"Processing {len(chunk)} rows...")

        # integrate + clean + feature engineering
        merged = integrate_data(chunk, zones)
        cleaned, _ = clean_data(merged)
        enriched = find_derived_features(cleaned)

        # preparing rows for DB
        rows = prepare_rows(enriched)

        # verify referenced zones exist in `zones` table and filter rows accordingly
        cur = conn.cursor()
        cur.execute("SELECT LocationID FROM zones")
        existing_zone_ids = set([r[0] for r in cur.fetchall()])
        cur.close()

        filtered_rows = []
        skipped = 0
        for r in rows:
            pu = r[14]
            do = r[15]
            if (pu is None or pu in existing_zone_ids) and (do is None or do in existing_zone_ids):
                filtered_rows.append(r)
            else:
                skipped += 1

        if skipped:
            print(f"Skipping {skipped} rows because PULocationID/DOLocationID not present in zones table")

        if filtered_rows:
            # inserting into DB
            inserted = insert_batch(conn, filtered_rows)
        else:
            inserted = 0

        total_inserted += inserted
        rows_processed += len(chunk)
        print(f"Inserted {inserted} rows (Total: {total_inserted})")
        
        if args.limit and rows_processed >= args.limit:
            print(f"Reached limit of {args.limit} rows. Stopping.")
            break

    conn.close()
    print("Done!")


if __name__ == "__main__":
    main()