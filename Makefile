
build: components index.js
	@rm -rf build.js
	@component build --dev -o .

components: component.json
	@component install --dev

clean:
	rm -fr build components template.js

.PHONY: clean
