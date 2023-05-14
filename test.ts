// Factorial time!
let fact: JSBI.BigInt = JSBI.CreateBigInt(1)
for (let i: number = 1; i <= 20; i++) {
    fact = JSBI.multiply(fact, JSBI.CreateBigInt(i))
    game.showLongText(`${i}! = ${fact.toString()} (length: ${fact.length})`, DialogLayout.Full)
}
