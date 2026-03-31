.PHONY: up down logs ps setup

up: setup
	docker compose up

setup:
	./setup.sh

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps
