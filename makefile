test := './test/*.test.js'
timeout := 10000
mocha := ./node_modules/.bin/mocha
istanbul := ./node_modules/.bin/istanbul
coverageMocha := ./node_modules/.bin/_mocha

test:
	$(mocha) --timeout $(timeout) $(test)

cov:
	$(istanbul) cover -x "example/**" $(coverageMocha) --report lcovonly -- -R spec  && cat ./coverage/lcov.info | ./node_modules/coveralls/bin/coveralls.js && rm -rf ./coverage

# 区分命令和文件名称
.PHONY: test

#istanbul cover ./node_modules/mocha/bin/_mocha --report lcovonly -- -R spec && cat ./coverage/lcov.info | ./node_modules/coveralls/bin/coveralls.js && rm -rf ./coverage