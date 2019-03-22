build:
	rm -rf docker/build/dist
	mkdir docker/build/dist || true
	cp -r package.json package-lock.json src docker/build/dist
	cd docker && docker-compose build

start:
	cd docker && docker-compose up -d