test := './test/*.test.js'
timeout := 10000
mocha := ./node_modules/.bin/mocha
istanbul := ./node_modules/.bin/istanbul
coverageMocha := ./node_modules/.bin/_mocha

test:
	$(mocha) --timeout $(timeout) $(test)

cov:
	$(istanbul) cover $(coverageMocha) -- -u exports $(test) --timeout $(timeout)

# 区分命令和文件名称
.PHONY: test
