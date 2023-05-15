const INTERACTIVE: boolean = false
let allPassed: boolean = true

// Factorial time!
let facts: string[] = [
    '                        1', //  0!
    '                        1', //  1!
    '                        2', //  2!
    '                        6', //  3!
    '                       24', //  4!
    '                      120', //  5!
    '                      720', //  6!
    '                    5 040', //  7!
    '                   40,320', //  8!
    '                  362.880', //  9!
    '                3_628_800', // 10!
    '               39 916 800', // 11!
    '              479 001 600', // 12!
    '            6 227 020 800', // 13!
    '           87 178 291 200', // 14!
    '        1 307 674 368 000', // 15!
    '       20 922 789 888 000', // 16!
    '      355 687 428 096 000', // 17!
    '    6 402 373 705 728 000', // 18!
    '  121 645 100 408 832 000', // 19!
    '2 432 902 008 176 640 000', // 20!
]

let fact: JSBI.BigInt = JSBI.CreateBigInt(1)
let msg: string = ''
for (let i: number = 1; i <= 20; i++) {
    fact = JSBI.multiply(fact, JSBI.CreateBigInt(i))
    msg = `${i}! = ${fact.toString()} (length: ${fact.length})`
    let verify: JSBI.BigInt = JSBI.CreateBigInt(facts[i])
    let compare: number = JSBI.compare(fact, verify)
    msg += compare == 0 ? ' valid!' : ' NOT VALID!'
    if (compare != 0 || INTERACTIVE) {
        game.showLongText(msg, DialogLayout.Full)
    }
    if (compare != 0) {
        allPassed = false
    }
}

interface Test {
    operation: string
    a: string
    b: string
    expected: string
}

// Applicable tests from JSBI source.
// Operator tests.
const TESTS: Test[] = [
    {
        operation: 'add',
        a: '-0xF72AAE64D54951CAE560D9B4531CE6CF02426F8CD601B77',
        b: '-0xF3CF5EDD759DBCC7449962CDB52AE0295BE7306D51555C70',
        expected: '-0x1034209C3C2F251E3F2EF7068FA5CAE964C0B57661EB577E7',
    },
    { // https://github.com/GoogleChromeLabs/jsbi/pull/14
        operation: 'remainder',
        a: '0x62A49213A5CD1793CB4518A12CA4FB5F3AB6DBD8B465D0D86975CEBDA6B6093',
        b: '0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
        expected: '0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFE',
    },
    { // https://github.com/GoogleChromeLabs/jsbi/pull/14#issuecomment-439484605
        operation: 'remainder',
        a: '0x10000000000000000',
        b: '0x100000001',
        expected: '0x1',
    },
    { // https://github.com/GoogleChromeLabs/jsbi/issues/44#issue-630518844
        operation: 'bitwiseAnd',
        a: '0b10000010001000100010001000100010001000100010001000100010001000100',
        b: '-0b10000000000000000000000000000000000000000000000000000000000000001',
        expected: '0b10001000100010001000100010001000100010001000100010001000100',
    },
    { // https://github.com/GoogleChromeLabs/jsbi/issues/44#issue-630518844
        operation: 'bitwiseXor',
        a: '0',
        b: '-0b1111111111111111111111111111111111111111111111111111111111111111',
        expected: '-0b1111111111111111111111111111111111111111111111111111111111111111',
    },
    {  // https://github.com/GoogleChromeLabs/jsbi/issues/57
        operation: 'signedRightShift',
        a: '-0xFFFFFFFFFFFFFFFF',
        b: '32',
        expected: '-0x100000000',
    },
]

function parseString(s: string): JSBI.BigInt {
    if (s.charCodeAt(0) === 0x2D) { // '-'
        return JSBI.unaryMinus(JSBI.CreateBigInt(s.slice(1)))
    }
    return JSBI.CreateBigInt(s)
}

let testNumber: number = 0
for (const test of TESTS) {
    const a: JSBI.BigInt = parseString(test.a)
    const b: JSBI.BigInt = parseString(test.b)
    const expected: JSBI.BigInt = parseString(test.expected)
    let result: JSBI.BigInt = null
    switch (test.operation.toUpperCase()) {
        case 'ADD':
            result = JSBI.add(a, b)
            break

        case 'SUBTRACT':
            result = JSBI.subtract(a, b)
            break

        case 'MULTIPLY':
            result = JSBI.multiply(a, b)
            break

        case 'REMAINDER':
        case 'MOD':
            result = JSBI.mod(a, b)
            break
    }

    if (result != null) {
        let compare: number = JSBI.compare(result, expected)
        if (compare != 0 || INTERACTIVE) {
            if (compare == 0) {
                game.splash(`Test ${testNumber} passed.`)
            } else {
                game.splash(`Test ${testNumber} failed!`)
                allPassed = false
            }
        }
    } else if (INTERACTIVE) {
        game.splash(`Test ${testNumber} not implemented; skipped.`)
    }
    testNumber++
}

// Parsing tests https://github.com/GoogleChromeLabs/jsbi/issues/36
const VALID: string[] = ['123', ' 123 ', '   123   ']
const INVALID: string[] = ['x123', 'x 123', ' 123x', '123 x', '123  xx', '123 ?a',
    '-0o0', '-0x0', '-0b0', '-0x1']
const EXPECTED: JSBI.BigInt = JSBI.CreateBigInt(123)

for (const v of VALID) {
    const result: JSBI.BigInt = JSBI.CreateBigInt(v)
    if (JSBI.compare(result, EXPECTED) == 0) {
        if (INTERACTIVE) {
            game.splash(`String "${v}" parsed correctly.`)
        }
    } else {
        game.splash(`String "${v}" was not parsed correctly!`)
        allPassed = false
    }
}

for (const i of INVALID) {
    try {
        const result: JSBI.BigInt = JSBI.CreateBigInt(i)
        game.showLongText(`String "${i}" was successfully parsed but should have failed. Error!`,
            DialogLayout.Center)
        allPassed = false
    } catch (exception) {
        if (INTERACTIVE) {
            game.showLongText(`String "${i}" was correctly rejected.`, DialogLayout.Center)
        }
    }
}

// Test the example from the README.
const maxInt: number = 9007199254740991
const max: JSBI.BigInt = JSBI.CreateBigInt(maxInt)
// → 9007199254740991
const other: JSBI.BigInt = JSBI.CreateBigInt(2)
const result: JSBI.BigInt = JSBI.add(max, other)
// → 9007199254740993
if (result.toString() !== '9007199254740993') {
    game.splash('README test FAILED (string version).')
    allPassed = false
}
// Test `JSBI.toNumber` as well.
if (other.toNumber() !== 2) {
    game.splash('README test FAILED (number version).')
    allPassed = false
}

// Corner cases near the single digit threshold.
interface ComparisonTest {
    a: string | number
    b: number
    expected: number
}

const COMPARISON_TESTS: ComparisonTest[] = [
    {
        // Test 0
        a: '0x100000000',
        b: 0x100000001,
        expected: -1,
    }, {
        // Test 1
        a: '0xFFFFFFFF',
        b: 0xFFFFFFFF,
        expected: 0,
    }, {
        // Test 2
        a: '0x7FFFFFFF',
        b: 0x7FFFFFFF,
        expected: 0,
    }, {
        // Test 3
        a: 0x7FFFFFFF,
        b: 0x7FFFFFFF,
        expected: 0,
    }, {
        // Test 4
        a: -0x7FFFFFFF,
        b: -0x7FFFFFFF,
        expected: 0,
    }, {
        // Test 5
        a: 0x7FFFFFF0,
        b: 0x7FFFFFFF,
        expected: -1,
    }, {
        // Test 6
        a: -0x7FFFFFF0,
        b: -0x7FFFFFFF,
        expected: 1,
    }
]

testNumber = 0
for (let ct of COMPARISON_TESTS) {
    const a: JSBI.BigInt = JSBI.CreateBigInt(ct.a)
    const b: JSBI.BigInt = JSBI.CreateBigInt(ct.b)
    const compare: number = JSBI.compare(a, b)
    if ((compare == 0 && ct.expected != 0) ||
    (compare > 0 && ct.expected <= 0) ||
    (compare < 0 && ct.expected >= 0)) {
        msg = `Comparison test ${testNumber} (BigInt version) failed. `
        msg += `Expecting ${ct.a} `
        if (ct.expected == 0) {
            msg += "= "
        } else if (ct.expected < 0) {
            msg += "< "
        } else {
            msg += "> "
        }
        msg += `${ct.b}. Compare() returned ${compare} instead.`
        game.showLongText(msg, DialogLayout.Full)
        allPassed = false
    } else if (INTERACTIVE) {
        game.splash(`Comparison test ${testNumber} (BigInt version) passed.`)
    }
    testNumber++
}

// Regression test for issue #63.
let t63a: string = JSBI.CreateBigInt(4.4384296245614243e+42).toString()
let t63b: string = '4438429624561424320047307980392507864252416'
if (t63a == t63b) {
    if (INTERACTIVE) {
        game.splash("Test 1 for issue #63 passed.")
    }
} else {
    game.splash("Test 1 for issue #63 failed.")
    allPassed = false
}

// This one will fail as toNumber() will return Infinity.
const t63c: string = '3361387880631608742970259577528807057005903'
let t63d: number = JSBI.CreateBigInt(t63c).toNumber()
let t63e: number = 3.361387880631609e+42
if (t63d == t63e) {
    if (INTERACTIVE) {
        game.splash("Test 2 for issue #63 passed.")
    }
} else {
    game.splash("Test 2 for issue #63 failed.")
    allPassed = false
}

/*
// Regression test for issue #72.
assertTrue(JSBI.EQ(max, Number.MAX_SAFE_INTEGER));

assertTrue(JSBI.EQ(JSBI.BigInt(18014398509481980), 18014398509481980));
assertTrue(JSBI.EQ(JSBI.BigInt(18014398509481982), 18014398509481982));
assertTrue(JSBI.EQ(JSBI.BigInt(18014398509481988), 18014398509481988));
*/

if (allPassed) {
    game.splash("All tests passed!")
} else {
    game.splash("At least one test failed.")
}