from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import json
import base64

# the current directory definition
BASE_DIR = Path(__file__).resolve().parent

USERNAME = "WEB-APP"
PASSWORD = "12345"
database = "NYC_Taxi"


def check_auth(headers):
    auth = headers.get("Authorization")

    if not auth or not auth.startswith("Basic "):
        return False

    try:
        encoded = auth.split(" ")[1]
        decoded = base64.b64decode(encoded).decode("utf-8")
        username, password = decoded.split(":", 1)
    except Exception:
        return False

    return username == USERNAME and password == PASSWORD


class RequestHandler(BaseHTTPRequestHandler):
    def authanticate(self):
        if not check_auth(self.headers):
            self.send_response(401)
            self.send_header("www-auntanticate", "basic realm ='secure API'")
            self.end_headers()
            return False
        return True
    

    def do_GET(self):
        if not self.authanticate():
            return False
        
        if self.path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(__place_for_file)).encode())
        elif self.startswith(""):
            tid = self.path.split("/")[-1]
            tid = self.path.split("/")[-1]
            tx = transaction_dict.get(tid)

            if tx:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(tx).encode())
            else:
                self.send_response(404)
                self.end_headers()

# Connect to the Database: Define your connection string (URI) containing the host, port, username, password, and database name.
# Define Your Models: Create Python classes that represent your database tables. Each attribute in the class corresponds to a column.
# Create API Endpoints: Use your web framework to define "routes" (e.g., /users or /tasks) that respond to HTTP GET requests.
# Query and Return Data: Inside your route function, use the ORM to fetch data (e.g., User.query.all()). Convert this data
#  to JSON format using jsonify or built-in Pydantic models in FastAPI.