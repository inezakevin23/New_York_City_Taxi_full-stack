from flask import Flask, jsonify, request, render_template
import mysql.connector
from mysql.connector import pooling

app = Flask(__name__)

# MySQL Configuration
db_config = {
    "host": "localhost",
    "user": "root",
    "password": "YOUR_PASSWORD",
    "database": "nyc_taxi",
    "port": 3306
}

# Connection Pool
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
    vendor    = request.args.get("vendor")
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

        if from_zone:
            joins.append("JOIN taxi_zones pu ON t.PULocationID = pu.LocationID")
            wheres.append("pu.service_zone = %s")
            params.append(from_zone)

        if to_zone:
            joins.append("JOIN taxi_zones do ON t.DOLocationID = do.LocationID")
            wheres.append("do.service_zone = %s")
            params.append(to_zone)

        if joins:
            query += " " + " ".join(joins)

        query += " WHERE " + " AND ".join(wheres)

        if vendor:
            query += " AND t.VendorID = %s"
            params.append(vendor)

        query += " GROUP BY t.VendorID"

        cursor.execute(query, params)
        results = cursor.fetchall()

    finally:
        cursor.close()
        conn.close()

    return jsonify(results)


# Trips Table Data (for the results table)
@app.route("/analytics/trips")
def trips():
    vendor    = request.args.get("vendor")
    min_price = request.args.get("min_price", 0,      type=float)
    max_price = request.args.get("max_price", 999999, type=float)
    from_zone = request.args.get("from_zone")
    to_zone   = request.args.get("to_zone")
    limit     = request.args.get("limit",  100, type=int)
    offset    = request.args.get("offset", 0,   type=int)

    conn   = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        query = """
            SELECT
                t.VendorID,
                t.tpep_pickup_datetime,
                t.tpep_dropoff_datetime,
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
            joins.append("JOIN taxi_zones pu ON t.PULocationID = pu.LocationID")
            wheres.append("pu.service_zone = %s")
            params.append(from_zone)

        if to_zone:
            joins.append("JOIN taxi_zones do ON t.DOLocationID = do.LocationID")
            wheres.append("do.service_zone = %s")
            params.append(to_zone)

        if joins:
            query += " " + " ".join(joins)

        query += " WHERE " + " AND ".join(wheres)

        if vendor:
            query += " AND t.VendorID = %s"
            params.append(vendor)

        query += " ORDER BY t.tpep_pickup_datetime DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])

        cursor.execute(query, params)
        results = cursor.fetchall()

        # Convert datetime objects to strings for JSON serialisation
        for row in results:
            if row.get("tpep_pickup_datetime"):
                row["tpep_pickup_datetime"] = str(row["tpep_pickup_datetime"])
            if row.get("tpep_dropoff_datetime"):
                row["tpep_dropoff_datetime"] = str(row["tpep_dropoff_datetime"])

    finally:
        cursor.close()
        conn.close()

    return jsonify(results)


if __name__ == "__main__":
    app.run(debug=True)