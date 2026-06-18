.PHONY: install data features train evaluate dashboard-data backend frontend all

PYTHON = .venv/bin/python

install:
	@if command -v uv >/dev/null 2>&1; then \
		echo "Installing Python packages with uv..."; \
		uv pip install -r requirements.txt; \
	else \
		echo "Installing Python packages with pip..."; \
		$(PYTHON) -m pip install -r requirements.txt || pip install -r requirements.txt; \
	fi
	@echo "Installing frontend npm packages..."
	cd dashboard && npm install

data:
	$(PYTHON) src/data/ingest_data.py
	$(PYTHON) src/data/merge_data.py

features:
	$(PYTHON) src/features/build_features.py
	$(PYTHON) src/models/physics_precursors.py

train:
	$(PYTHON) src/models/train_lstm.py

evaluate:
	$(PYTHON) src/models/ensemble_forecast.py

dashboard-data:
	$(PYTHON) src/data/create_dashboard_data.py

backend:
	$(PYTHON) backend/main.py

frontend:
	cd dashboard && npm run dev

all: data features train evaluate dashboard-data
