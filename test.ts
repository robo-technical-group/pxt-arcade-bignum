const INTERACTIVE: boolean = false
let allPassed: boolean = true

/**
 * Data structures for automated tests.
 * Partly JSBI built-in tests.
 */
interface ComparisonTest {
    a: string | number
    b: number
    expected: number
}

interface OpsTest {
    operation: string
    a: string
    b: string
    expected: string
}

function parseString(s: string): BigNum.BigInt {
    if (s.charCodeAt(0) === 0x2D) { // '-'
        return BigNum.unaryMinus(BigNum.CreateBigInt(s.slice(1)))
    }
    return BigNum.CreateBigInt(s)
}

function runCompTests(tests: ComparisonTest[], testGroupName: string): void {
    let testNumber: number= 0
    for (let t of tests) {
        const a: BigNum.BigInt = BigNum.CreateBigInt(t.a)
        const b1: BigNum.BigInt = BigNum.CreateBigInt(t.b)
        const compare1: number = BigNum.compare(a, b1)
        if ((compare1 == 0 && t.expected != 0) ||
            (compare1 > 0 && t.expected <= 0) ||
            (compare1 < 0 && t.expected >= 0)) {
            msg = `Comparison test ${testNumber} (BigInt version) failed. `
            msg += `Expecting ${t.a} `
            if (t.expected == 0) {
                msg += "= "
            } else if (t.expected < 0) {
                msg += "< "
            } else {
                msg += "> "
            }
            msg += `${t.b}. Compare() returned ${compare1} instead.`
            game.showLongText(msg, DialogLayout.Full)
            msg += ` a: ${a.toString()} ${a.toDebugString()}, b: ${b1.toString()} ${b1.toDebugString()}`
            console.log(msg)
            allPassed = false
        } else if (INTERACTIVE) {
            game.splash(`Comparison test ${testNumber} (BigInt version) passed.`)
        }
        const compare2: number = BigNum.compare(a, t.b)
        if ((compare2 == 0 && t.expected != 0) ||
            (compare2 > 0 && t.expected <= 0) ||
            (compare2 < 0 && t.expected >= 0)) {
            msg = `Comparison test ${testNumber} (number version) failed. `
            msg += `Expecting ${t.a} `
            if (t.expected == 0) {
                msg += "= "
            } else if (t.expected < 0) {
                msg += "< "
            } else {
                msg += "> "
            }
            msg += `${t.b}. Compare() returned ${compare2} instead.`
            game.showLongText(msg, DialogLayout.Full)
            msg += ` a: ${a.toString()} ${a.toDebugString()}, b: ${t.b.toString()}`
            console.log(msg)
            allPassed = false
        } else if (INTERACTIVE) {
            game.splash(`Comparison test ${testNumber} (number version) passed.`)
        }
        testNumber++
    }
}

function runOpsTests(tests: OpsTest[], testGroupName: string): void {
    let testNumber: number = 0
    for (const test of tests) {
        const a: BigNum.BigInt = parseString(test.a)
        const b: BigNum.BigInt = parseString(test.b)
        const expected: BigNum.BigInt = parseString(test.expected)
        let result: BigNum.BigInt = null
        switch (test.operation.toUpperCase()) {
            case 'ADD':
                result = BigNum.add(a, b)
                break

            case 'SUBTRACT':
                result = BigNum.subtract(a, b)
                break

            case 'MULTIPLY':
                result = BigNum.multiply(a, b)
                break

            case 'REMAINDER':
            case 'MOD':
                result = BigNum.mod(a, b)
                break

            case 'DIVIDE':
                result = BigNum.divide(a, b)
                break
        }

        if (result != null) {
            let compare: number = BigNum.compare(result, expected)
            if (compare != 0 || INTERACTIVE) {
                if (compare == 0) {
                    game.splash(`Group ${testGroupName} Test ${testNumber} operator passed.`)
                } else {
                    msg = `Group ${testGroupName} Test ${testNumber} operator failed!`
                    game.splash(msg)
                    msg += ` a = ${test.a} b = ${test.b} operator ${test.operation}`
                    msg += ` expected ${test.expected} result ${result.toString()} `
                    msg += result.toDebugString()
                    console.log(msg)
                    allPassed = false
                }
            }
        } else if (INTERACTIVE) {
            game.splash(`Group ${testGroupName} Test ${testNumber} operator not implemented; skipped.`)
        }

        result = null
        switch (test.operation.toUpperCase()) {
            case 'ADD':
                result = a.add(b)
                break

            case 'SUBTRACT':
                result = a.subtract(b)
                break

            case 'MULTIPLY':
                result = a.multiply(b)
                break

            case 'REMAINDER':
            case 'MOD':
                result = a.mod(b)
                break

            case 'DIVIDE':
                result = a.divide(b)
                break
        }

        if (result != null) {
            let compare: number = BigNum.compare(result, expected)
            if (compare != 0 || INTERACTIVE) {
                if (compare == 0) {
                    game.splash(`Group ${testGroupName} Test ${testNumber} chain operator passed.`)
                } else {
                    msg = `Group ${testGroupName} Test ${testNumber} chain operator failed!`
                    game.splash(msg)
                    msg += ` a = ${test.a} b = ${test.b} operator ${test.operation}`
                    msg += ` expected ${test.expected} result ${result.toString()} `
                    msg += result.toDebugString()
                    console.log(msg)
                    allPassed = false
                }
            }
        } else if (INTERACTIVE) {
            game.splash(`Group ${testGroupName} Test ${testNumber} chain operator not implemented; skipped.`)
        }
        testNumber++
    }
}

/**
 * Factorial time!
 */
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

let fact: BigNum.BigInt = BigNum.CreateBigInt(1)
let msg: string = ''
for (let i: number = 1; i <= 20; i++) {
    fact = BigNum.multiply(fact, BigNum.CreateBigInt(i))
    msg = `${i}! = ${fact.toString()} (length: ${fact.length})`
    let verify: BigNum.BigInt = BigNum.CreateBigInt(facts[i])
    let compare: number = BigNum.compare(fact, verify)
    msg += compare == 0 ? ' valid!' : ' NOT VALID!'
    if (compare != 0 || INTERACTIVE) {
        game.showLongText(msg, DialogLayout.Full)
    }
    if (compare != 0) {
        allPassed = false
    }
}
// End factorial tests

/**
 * JSBI tests
 */
// Operator tests.
const JSBI_OPS_TESTS: OpsTest[] = [
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

runOpsTests(JSBI_OPS_TESTS, 'JSBI source')

// Parsing tests https://github.com/GoogleChromeLabs/jsbi/issues/36
const VALID: string[] = ['123', ' 123 ', '   123   ']
const INVALID: string[] = ['x123', 'x 123', ' 123x', '123 x', '123  xx', '123 ?a',
    '-0o0', '-0x0', '-0b0', '-0x1']
const EXPECTED: BigNum.BigInt = BigNum.CreateBigInt(123)

for (const v of VALID) {
    const result: BigNum.BigInt = BigNum.CreateBigInt(v)
    if (BigNum.compare(result, EXPECTED) == 0) {
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
        const result: BigNum.BigInt = BigNum.CreateBigInt(i)
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
const max: BigNum.BigInt = BigNum.CreateBigInt(maxInt)
// → 9007199254740991
const other: BigNum.BigInt = BigNum.CreateBigInt(2)
const result: BigNum.BigInt = BigNum.add(max, other)
// → 9007199254740993
if (result.toString() !== '9007199254740993') {
    msg = 'README test FAILED (string version).'
    game.splash(msg)
    msg += ` result = ${result.toString()} ${result.toDebugString()}`
    console.log(msg)
    allPassed = false
}
// Test `BigNum.toNumber` as well.
if (other.toNumber() !== 2) {
    msg = 'README test FAILED (number version).'
    game.splash(msg)
    msg += ` result = ${result.toString()} ${result.toDebugString()}`
    console.log(msg)
    allPassed = false
}

// Corner cases near the single digit threshold.
const JSBI_COMP_TESTS: ComparisonTest[] = [
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

runCompTests(JSBI_COMP_TESTS, 'JSBI Source')

// Regression test for issue #63.
let t63a: string = BigNum.CreateBigInt(4.4384296245614243e+42).toString()
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
let t63d: number = BigNum.CreateBigInt(t63c).toNumber()
let t63e: number = 3.361387880631609e+42
if (t63d == t63e) {
    if (INTERACTIVE) {
        game.splash("Test 2 for issue #63 passed.")
    }
} else {
    game.splash("Test 2 for issue #63 failed.")
    allPassed = false
}

// Regression test for issue #72.
const issue72tests: ComparisonTest[] = [
    // assertTrue(BigNum.EQ(max, Number.MAX_SAFE_INTEGER));
    // No equivalent to Number.MAX_SAFE_INTEGER; skipping.
    // Test 0:
    // assertTrue(BigNum.EQ(BigNum.BigInt(18014398509481980), 18014398509481980));
    {
        a: '18014398509481980',
        b: 18014398509481980,
        expected: 0
    },
    // Test 1:
    // assertTrue(BigNum.EQ(BigNum.BigInt(18014398509481982), 18014398509481982));
    {
        a: '18014398509481982',
        b: 18014398509481982,
        expected: 0
    },
    // Test 2:
    // assertTrue(BigNum.EQ(BigNum.BigInt(18014398509481988), 18014398509481988));
    {
        a: '18014398509481988',
        b: 18014398509481988,
        expected: 0
    }
]
runCompTests(issue72tests, 'Issue #72')
// End JSBI tests.

/**
 * Additional tests from Matt McCutchen's C++ bigint library.
 * https://mattmccutchen.net/bigint/
 */
const MM_TESTS: OpsTest[] = [
    {
        // Test 0
        a: '0',
        b: '0',
        operation: 'add',
        expected: '0',
    }, {
        // Test 1
        a: '0',
        b: '1',
        operation: 'add',
        expected: '1',
    }, {
        // Test 2
        a: '8589934591',
        b: '4294967298',
        operation: 'add',
        expected: '12884901889',
    }, {
        // Test 3
        a: '1',
        b: '0',
        operation: 'subtract',
        expected: '1',
    }, {
        // Test 4
        a: '1',
        b: '1',
        operation: 'subtract',
        expected: '0',
    }, {
        // Test 5
        a: '2',
        b: '1',
        operation: 'subtract',
        expected: '1',
    }, {
        // Test 6
        a: '12884901889',
        b: '4294967298',
        operation: 'subtract',
        expected: '8589934591',
    }, {
        // Test 7
        a: '4294967296',
        b: '1',
        operation: 'subtract',
        expected: '4294967295',
    }, {
        // Test 8
        a: '314159265',
        b: '358979323',
        operation: 'multiply',
        expected: '112776680263877595',
    }, {
        // Test 9
        a: '112776680263877595',
        b: '123',
        operation: 'divide',
        expected: '916883579381118',
    }, {
        // Test 10
        a: '112776680263877595',
        b: '123',
        operation: 'mod',
        expected: '81',
    },
]
runOpsTests(MM_TESTS, 'Matt McCutchen')
// End Matt McCutchen's tests.

if (allPassed) {
    game.splash("All tests passed!")
} else {
    game.splash("At least one test failed.")
}
