from flask import Flask, jsonify, request, render_template
import os
import mysql.connector
from mysql.connector import pooling
from decimal import Decimal

app = Flask(__name__)

# MySQL Configuration
db_config = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "kevin"),
    "password": os.getenv("DB_PASSWORD", "1234"),
    "database": os.getenv("DB_NAME", "NYC_Taxi"),
    "port": int(os.getenv("DB_PORT", 3306))
}

# Connection pool (created once at module import)
connection_pool = pooling.MySQLConnectionPool(
    pool_name="taxi_pool",
    pool_size=5,
    **db_config
)


def get_db_connection():
    return connection_pool.get_connection()


@app.route("/")
def home():
    return render_template("index.html")


# Price Summary Analytics (for charts)
@app.route("/analytics/price-summary")
def price_summary():
    # ensure vendor is parsed as integer when provided
    vendor    = request.args.get("vendor", type=int)
    min_price = request.args.get("min_price", 0,      type=float)
    max_price = request.args.get("max_price", 999999, type=float)
    from_zone = request.args.get("from_zone")
    to_zone   = request.args.get("to_zone")

    conn   = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        query = """
            SELECT
                t.VendorID,
                MIN(t.total_amount) AS min_price,
                AVG(t.total_amount) AS avg_price,
                MAX(t.total_amount) AS max_price
            FROM trips t
        """

        joins  = []
        wheres = ["t.total_amount BETWEEN %s AND %s"]
        params = [min_price, max_price]

        # NOTE: the DB table is `zones` in backend/database/schema.sql
        if from_zone:
            joins.append("JOIN zones pu ON t.PULocationID = pu.LocationID")
            wheres.append("pu.service_zone = %s")
            params.append(from_zone)

        if to_zone:
            joins.append("JOIN zones do ON t.DOLocationID = do.LocationID")
            wheres.append("do.service_zone = %s")
            params.append(to_zone)

        if joins:
            query += " " + " ".join(joins)

        query += " WHERE " + " AND ".join(wheres)

        if vendor is not None:
            query += " AND t.VendorID = %s"
            params.append(vendor)

        query += " GROUP BY t.VendorID"

        cursor.execute(query, params)
        results = cursor.fetchall()

        # convert Decimal (if any) to native types safe for JSON
        for r in results:
            if isinstance(r.get("min_price"), Decimal):
                r["min_price"] = float(r["min_price"])
            if isinstance(r.get("avg_price"), Decimal):
                r["avg_price"] = float(r["avg_price"])
            if isinstance(r.get("max_price"), Decimal):
                r["max_price"] = float(r["max_price"])
            # ensure VendorID is simple int
            if r.get("VendorID") is not None:
                r["VendorID"] = int(r["VendorID"])

    except mysql.connector.Error as e:
        # log and return a simple JSON error (avoid leaking DB internals)
        cursor.close()
        conn.close()
        return jsonify({"error": "database error"}), 500

    finally:
        cursor.close()
        conn.close()

    return jsonify(results)


@app.route('/analytics/zones')
def zones():
    """Return available `service_zone` values from the `zones` table.
    Front-end can use this to populate the From / To drop-downs.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT DISTINCT service_zone FROM zones ORDER BY service_zone")
        rows = cursor.fetchall()
        zones_list = [r[0] for r in rows if r and r[0]]
    except mysql.connector.Error:
        cursor.close()
        conn.close()
        return jsonify({"error": "database error"}), 500
    finally:
        cursor.close()
        conn.close()

    return jsonify(zones_list)


# Trips Table Data (for the results table)
@app.route("/analytics/trips")
def trips():
    # parse vendor as int (if provided)
    vendor    = request.args.get("vendor", type=int)
    min_price = request.args.get("min_price", 0,      type=float)
    max_price = request.args.get("max_price", 999999, type=float)
    from_zone = request.args.get("from_zone")
    to_zone   = request.args.get("to_zone")
    limit     = request.args.get("limit",  100, type=int)
    offset    = request.args.get("offset", 0,   type=int)

    # protect against excessively large limits
    limit = max(1, min(limit, 1000))
    offset = max(0, offset)

    conn   = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        query = """
            SELECT
                t.VendorID,
                t.pickup_datetime AS tpep_pickup_datetime,
                t.dropoff_datetime AS tpep_dropoff_datetime,
                t.PULocationID,
                t.DOLocationID,
                t.trip_distance,
                t.fare_amount
            FROM trips t
        """

        joins  = []
        wheres = ["t.total_amount BETWEEN %s AND %s"]
        params = [min_price, max_price]

        if from_zone:
            joins.append("JOIN zones pu ON t.PULocationID = pu.LocationID")
            wheres.append("pu.service_zone = %s")
            params.append(from_zone)

        if to_zone:
            joins.append("JOIN zones do ON t.DOLocationID = do.LocationID")
            wheres.append("do.service_zone = %s")
            params.append(to_zone)

        if joins:
            query += " " + " ".join(joins)

        query += " WHERE " + " AND ".join(wheres)

        if vendor is not None:
            query += " AND t.VendorID = %s"
            params.append(vendor)

        query += " ORDER BY t.pickup_datetime DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])

        cursor.execute(query, params)
        results = cursor.fetchall()

        # Normalize rows for JSON serialisation
        for row in results:
            if row.get("tpep_pickup_datetime"):
                dt = row["tpep_pickup_datetime"]
                row["tpep_pickup_datetime"] = dt.strftime("%Y-%m-%d %H:%M:%S") if hasattr(dt, 'strftime') else str(dt)

            if row.get("tpep_dropoff_datetime"):
                dt = row["tpep_dropoff_datetime"]
                row["tpep_dropoff_datetime"] = dt.strftime("%Y-%m-%d %H:%M:%S") if hasattr(dt, 'strftime') else str(dt)

            # ensure numeric types are JSON-serializable
            if row.get("trip_distance") is not None:
                row["trip_distance"] = float(row["trip_distance"])
            if row.get("fare_amount") is not None:
                row["fare_amount"] = float(row["fare_amount"])
            if row.get("VendorID") is not None:
                row["VendorID"] = int(row["VendorID"])

    except mysql.connector.Error:
        cursor.close()
        conn.close()
        return jsonify({"error": "database error"}), 500

    finally:
        cursor.close()
        conn.close()

    return jsonify(results)


if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "1") in ("1", "true", "True")
    port = int(os.getenv("PORT", 5000))
    # bind to 0.0.0.0 for container / remote access during development
    app.run(host="0.0.0.0", port=port, debug=debug)