import csv
from flask import Flask, jsonify
from datetime import datetime

app = Flask(__name__)
trip_data = "sample_train_data.csv"

def load_trip_data():
    trips = []


    with open(trip_data, 'r') as csv_file:
        csv_reader = csv.DictReader(csv_file)
        
        for line in csv_reader:
            trip = {
                'id': line['id'],
                'vendor_id': int(line['vendor_id']),
                'pickup_datetime': datetime.strptime(line['pickup_datetime'], '%m/%d/%Y %H:%M'),
                'dropoff_datetime': datetime.strptime(line['dropoff_datetime'], '%m/%d/%Y %H:%M'),                   
                'passenger_count': int(line['passenger_count']),
                'trip_duration': float(line['trip_duration']),
                'pickup_longitude': float(line['pickup_longitude']),
                'pickup_latitude': float(line['pickup_latitude']),
                'dropoff_longitude': float(line['dropoff_longitude']),
                'dropoff_latitude': float(line['dropoff_latitude'])
            }
            trips.append(trip)
    return trips

@app.route('/trips')
def get_trips():
    trips = load_trip_data()
    return jsonify(trips)

if __name__ == '__main__':    
    app.run(debug=True)
            