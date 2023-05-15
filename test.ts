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
    msg += JSBI.compare(fact, verify) == 0 ? ' valid!' : ' NOT VALID!'
    game.showLongText(msg, DialogLayout.Full)
}
