CREATE DATABASE IF NOT EXISTS NYC_Taxi;
USE NYC_Taxi;

DROP TABLE IF EXISTS zones;

CREATE TABLE zones (
    LocationID INT PRIMARY KEY,
    Borough VARCHAR(50),
    Zone VARCHAR(100),
    service_zone VARCHAR(50)
);

DROP TABLE IF EXISTS trips;

CREATE TABLE trips (
    trip_id INT AUTO_INCREMENT PRIMARY KEY,

    VendorID INT,
    pickup_datetime DATETIME,
    dropoff_datetime DATETIME,

    passenger_count INT,
    trip_distance FLOAT,
    trip_duration INT,
    trip_speed FLOAT,
    fare_per_mile FLOAT,

    fare_amount FLOAT,
    extra FLOAT,
    mta_tax FLOAT,
    tip_amount FLOAT,
    tolls_amount FLOAT,
    total_amount FLOAT,

    PULocationID INT,
    DOLocationID INT,

    FOREIGN KEY (PULocationID) REFERENCES zones(LocationID),
    FOREIGN KEY (DOLocationID) REFERENCES zones(LocationID)
);

CREATE INDEX idx_pickup_time ON trips(pickup_datetime);
CREATE INDEX idx_pu_location ON trips(PULocationID);
CREATE INDEX idx_do_location ON trips(DOLocationID);
CREATE INDEX idx_trip_duration ON trips(trip_duration);
