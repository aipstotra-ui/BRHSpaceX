.PHONY: install api web dev test data

PY := .venv/bin/python
PIP := .venv/bin/pip

install:
	python3 -m venv .venv
	$(PIP) install -U pip
	$(PIP) install -e "./starmind-physics[dev,api]"
	npm install

data:
	$(PY) -m starmind_physics.scripts.export_demo_data --out web/public/data

api:
	.venv/bin/uvicorn starmind_physics.api:app --host 127.0.0.1 --port 8000

web:
	npm run dev -w 3rok-web

dev:
	bash scripts/dev.sh

test:
	cd starmind-physics && ../.venv/bin/pytest
	npm run typecheck -w @3rok/cesium-plugin
	npm run build -w @3rok/cesium-plugin
	npm run typecheck -w 3rok-web
	npm run build -w 3rok-web
