# 🚕 NYC Taxi Data Analytics App

This project is a full-stack data analytics application built with Flask and MySQL.
It processes NYC taxi data, performs cleaning and feature engineering, and provides analytics via a web interface.

---

## 📌 Features

* Data cleaning and normalization
* Feature engineering (trip duration, speed, fare per mile)
* MySQL database integration
* REST API endpoints for analytics
* Interactive frontend (charts + tables)

---
## Link to deployed app
https://nyc-taxi.ineza.tech/

## Demo video 
(https://youtu.be/RWP4Bv2zUxk)
## ⚙️ Requirements

* Python 3.10+
* MySQL Server
* pip

---

## 🚀 Setup Instructions

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd backend
```

---

### 2. Create virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

---

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

---

### 4. Setup MySQL Database

Login to MySQL:

```bash
mysql -u root -p
```
create new user

```bash
CREATE USER 'kevin'@'localhost' IDENTIFIED BY '1234';
GRANT ALL PRIVILEGES ON NYC_Taxi.* TO 'kevin'@'localhost';
FLUSH PRIVILEGES;
```

Create database:

```sql
CREATE DATABASE NYC_Taxi;
```

---

### 5. Create tables

Run:

```bash
mysql -u root -p NYC_Taxi < database/schema.sql
```

---

### 6. Configure environment variables

Create `.env` file:

```
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=NYC_Taxi
DB_PORT=3306
```

---

### 7. Insert data

```bash
cd database

python3 insert_cleaned_trips.py \
  --host localhost \
  --user your_username \
  --password your_password \
  --database NYC_Taxi \
  --file ../data/yellow_tripdata_2019-01.csv \
  --batch 500
```

---

### 8. Run the app

```bash
cd ..
python3 app.py
```

---

### 9. Open in browser

```
http://localhost:5000
```

---

## API Endpoints

### Price Summary

```
GET /analytics/price-summary
```

### Trips Data

```
GET /analytics/trips
```

### Zones

```
GET /analytics/zones
```

---
