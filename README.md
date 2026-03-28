🚕 Uber Demand AnalyzerA real-time predictive dashboard for optimizing NYC driver routes using Machine Learning.📖 OverviewThe Uber Demand Analyzer is a full-stack data product designed to solve the "where to go next" problem for ride-share drivers. By analyzing historical NYC pickup data, the system predicts city-wide demand and identifies geographical hotspots.The Core ProblemDrivers often waste fuel and time idling in low-demand areas. This tool provides an Intelligent Recommendation Engine that balances:Predicted Volume: How many rides are expected in a specific zone?Proximity: How far is the driver from that zone?🚀 Key Features🧠 Machine Learning EngineDemand Forecasting: A Linear Regression model predicts pickup volumes based on temporal features (Hour, Weekday, Month).Geospatial Clustering: KMeans Clustering segments NYC into 7 distinct service hubs, including Manhattan, JFK Airport, and Downtown Brooklyn.Weighted Scoring: A custom algorithm ranks hotspots by calculating:$$Score = (Volume_{norm} \times 0.7) - (Distance_{norm} \times 0.3)$$💻 Modern Dashboard UIAdaptive UX: Seamlessly toggle between Light and Dark Mode with persistent theme settings.Digital Clock Engine: Custom-built time picker that translates 12h human time into 24h model inputs.Smart Search: Autocomplete location bar limited to 10 verified NYC landmarks to ensure coordinate accuracy.Live Mapping: Interactive Leaflet.js map with dynamic "Surge Heat" markers and customized map tiles.🛠️ Tech StackCategoryToolsBackendPython, FlaskMachine LearningScikit-learn, Pandas, NumPy, JoblibFrontendJavaScript (ES6+), HTML5, CSS3 (Custom Variables)GeospatialLeaflet.js, Geopy (Nominatim API)📦 Installation & SetupClone the RepoBashgit clone https://github.com/ewwhamza/Uber-Demand-Analyzer.git
cd Uber-Demand-Analyzer
Initialize EnvironmentBashpython -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
Launch the DashboardBashpython app.py
Visit http://127.0.0.1:5000 in your browser.📁 Project StructurePlaintext.
├── static/
│   ├── style.css         # Adaptive UI & Custom variables
│   └── script.js         # Map logic, Clock engine & API Fetch
├── templates/
│   └── index.html        # Dashboard structure
├── app.py                # Flask Bridge & API Routes
├── predict.py            # ML Inference Class (The Engine)
├── uber_model.pkl        # Regression Weights
├── uber_kmeans.pkl       # Clustering Logic
└── requirements.txt      # Project Dependencies
