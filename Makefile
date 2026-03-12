SHELL := /bin/zsh

.PHONY: setup dev build start lint typecheck check pdf-test pdf-test-nuevo-ingreso

setup:
	npm install

dev:
	npm run dev

build:
	npm run build

start:
	npm run start

lint:
	npm run lint

typecheck:
	npm run typecheck

check:
	npm run check

pdf-test:
	npm run pdf:test

pdf-test-nuevo-ingreso:
	npm run pdf:test:nuevo-ingreso
