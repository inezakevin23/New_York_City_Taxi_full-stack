# script to convert Shapefile to GeoJSON
from pathlib import Path
import sys
import geopandas as gpd

# locate data directory relative to this script (works from any CWD)
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = (BASE_DIR / ".." / "data").resolve()
SHAPEFILE = DATA_DIR / "taxi_zones.shp"
GEOJSON = DATA_DIR / "taxi_zones.geojson"

def convert_shapefile_to_geojson(shapefile, geojson):
    try:
        gdf = gpd.read_file(shapefile)
        gdf.to_file(geojson, driver='GeoJSON')
        print(f"Successfully converted {shapefile} to {geojson}")
    except Exception as e:
        print(f"Error converting shapefile: {e}")

if __name__ == "__main__":
    convert_shapefile_to_geojson(SHAPEFILE, GEOJSON)
    print(f"successfully converted {SHAPEFILE} to {GEOJSON}")