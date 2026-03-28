"""
HotspotAI — app.py
Flask application entry point.
"""
import os
from flask import Flask, render_template, request, jsonify
from predict import predict

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__,
    static_folder=os.path.join(BASE_DIR, 'static'),
    template_folder=os.path.join(BASE_DIR, 'templates')
)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/predict', methods=['POST'])
def predict_route():
    data     = request.get_json()
    location = data.get('location', '').strip()
    hour     = int(data.get('hour', 12))
    weekday  = int(data.get('weekday', 4))
    month    = int(data.get('month', 4))

    if not location:
        return jsonify({'error': 'Location is required.'}), 400

    result = predict(
        location_name=location,
        hour=hour,
        weekday=weekday,
        month=month
    )

    if result is None:
        return jsonify({
            'error': f"Could not find '{location}'. Try a specific NYC area like 'Times Square' or 'Brooklyn'."
        }), 400

    return jsonify(result)


if __name__ == '__main__':
    app.run(debug=True)