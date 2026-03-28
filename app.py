from flask import Flask, render_template, request, jsonify
from predict import UberPredictor
from datetime import datetime

app = Flask(__name__)

# Initialize the predictor once when the server starts
# This loads your .pkl files into memory
predictor = UberPredictor()

@app.route('/')
def index():
    """Renders the main dashboard page."""
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def get_prediction():
    """
    API endpoint that receives location data and returns 
    demand forecasts and hotspot recommendations.
    """
    try:
        data = request.get_json()
        
        location = data.get('location')
        
        # Use provided time/day or default to 'now' if they are missing
        now = datetime.now()
        hour = int(data.get('hour', now.hour))
        weekday = int(data.get('weekday', now.weekday())) 
        month = int(data.get('month', now.month))

        if not location:
            return jsonify({'status': 'error', 'message': 'Location is required'}), 400

        # Call the ML Engine
        result = predictor.predict(
            location_name=location,
            hour=hour,
            weekday=weekday,
            month=month
        )

        if 'error' in result:
            return jsonify({'status': 'error', 'message': result['error']}), 404

        return jsonify(result)

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    # Set debug=True during development to see errors clearly
    app.run(debug=True, port=5000)