// Copyright 2018 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// <https://apache.org/licenses/LICENSE-2.0>.
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

interface BigDiv {
    quotient: JSBI.BigInt
    remainder: JSBI.BigInt
}

namespace JSBI {
    const kMaxLength: number = 1 << 25
    const kMaxLengthBits: number = kMaxLength << 5
    // Lookup table for the maximum number of bits required per character of a
    // base-N string representation of a number. To increase accuracy, the array
    // value is the actual value multiplied by 32. To generate this table:
    //
    // for (let i = 0; i <= 36; i++) {
    //   console.log(Math.ceil(Math.log2(i) * 32) + ',');
    // }
    const kMaxBitsPerChar: number[] = [
        0, 0, 32, 51, 64, 75, 83, 90, 96, // 0..8
        102, 107, 111, 115, 119, 122, 126, 128, // 9..16
        131, 134, 136, 139, 141, 143, 145, 147, // 17..24
        149, 151, 153, 154, 156, 158, 159, 160, // 25..32
        162, 163, 165, 166, // 33..36
    ]

    const kBitsPerCharTableShift: number = 5
    const kBitsPerCharTableMultiplier: number = 1 << kBitsPerCharTableShift
    // const kConversionChars: string[] = '0123456789abcdefghijklmnopqrstuvwxyz'.split('')
    let kBitConversionBuffer: Buffer = Buffer.create(8)

    export class BigInt {
        protected data: number[]

        public constructor(length: number, public sign: boolean) {
            this.data = []
            for (let i: number = 0; i < length; i++) {
                this.data.push(0)
            }
        }

        public get length(): number {
            return this.data.length
        }

        public toDebugString(): string {
            const result = ['CreateBigInt['];
            for (const digit of this.data) {
                result.push((digit ? (digit >>> 0).toString() : digit) + ', ');
            }
            result.push(']');
            return result.join('');
        }

        public toNumber(): number {
            // Simplified version.
            if (this.length == 0) return 0
            if (this.length > 2) return this.sign ? -Infinity : Infinity
            const value: number = this.__unsignedDigit(0)
            return this.sign ? 0 - value : value
        }

        public toString(): string {
            // return this.toDebugString()
            // Simplifying implementation; always using radix 10.
            if (this.length === 0) return '0'
            if (this.length === 1) return (this.sign ? '-' : '') + this.data[0]
            return stringify(this, false)
        }

        public __clzmsd(): number {
            return clz30(this.__digit(this.data.length - 1))
        }

        public __copy(): BigInt {
            const result = new BigInt(this.length, this.sign)
            for (let i = 0; i < this.length; i++) {
                result.data[i] = this.data[i]
            }
            return result
        }

        public __digit(i: number): number {
            return this.data[i]
        }

        public __halfDigit(i: number): number {
            return (this.data[i >>> 1] >>> ((i & 1) * 15)) & 0x7FFF
        }

        public __halfDigitLength(): number {
            const len = this.data.length
            if (this.__unsignedDigit(len - 1) <= 0x7FFF) return len * 2 - 1
            return len * 2
        }

        public __initializeDigits(): void {
            for (let i = 0; i < this.length; i++) {
                this.data[i] = 0;
            }
        }

        // TODO: work on full digits, like __inplaceSub?
        public __inplaceAdd(summand: BigInt, startIndex: number, halfDigits: number): number {
            let carry: number = 0;
            for (let i = 0; i < halfDigits; i++) {
                const sum: number = this.__halfDigit(startIndex + i) +
                    summand.__halfDigit(i) +
                    carry
                carry = sum >>> 15
                this.__setHalfDigit(startIndex + i, sum & 0x7FFF)
            }
            return carry
        }

        public __inplaceMultiplyAdd(multiplier: number, summand: number, length: number): void {
            if (length > this.length) length = this.length
            const mLow: number = multiplier & 0x7FFF
            const mHigh: number = multiplier >>> 15
            let carry: number = 0
            let high: number = summand
            for (let i = 0; i < length; i++) {
                const d: number = this.__digit(i)
                const dLow: number = d & 0x7FFF
                const dHigh: number = d >>> 15
                const pLow: number = Math.imul(dLow, mLow)
                const pMid1: number = Math.imul(dLow, mHigh)
                const pMid2: number = Math.imul(dHigh, mLow)
                const pHigh: number = Math.imul(dHigh, mHigh)
                let result: number = high + pLow + carry
                carry = result >>> 30
                result &= 0x3FFFFFFF
                result += ((pMid1 & 0x7FFF) << 15) + ((pMid2 & 0x7FFF) << 15)
                carry += result >>> 30
                high = pHigh + (pMid1 >>> 15) + (pMid2 >>> 15)
                this.__setDigit(i, result & 0x3FFFFFFF)
            }
            if (carry !== 0 || high !== 0) {
                throw '__inplaceMultiplyAdd: implementation bug.'
            }
        }

        public __inplaceRightShift(shift: number): void {
            if (shift === 0) return
            let carry: number = this.__digit(0) >>> shift
            const last: number = this.length - 1
            for (let i = 0; i < last; i++) {
                const d: number = this.__digit(i + 1)
                this.__setDigit(i, ((d << (30 - shift)) & 0x3FFFFFFF) | carry)
                carry = d >>> shift
            }
            this.__setDigit(last, carry)
        }

        public __inplaceSub(subtrahend: BigInt, startIndex: number, halfDigits: number): number {
            const fullSteps: number = (halfDigits - 1) >>> 1
            let borrow: number = 0
            if (startIndex & 1) {
                // this:   [..][..][..]
                // subtr.:   [..][..]
                startIndex >>= 1
                let current: number = this.__digit(startIndex)
                let r0: number = current & 0x7FFF
                let i: number = 0
                for (; i < fullSteps; i++) {
                    const sub: number = subtrahend.__digit(i)
                    const r15: number = (current >>> 15) - (sub & 0x7FFF) - borrow
                    borrow = (r15 >>> 15) & 1
                    this.__setDigit(startIndex + i, ((r15 & 0x7FFF) << 15) | (r0 & 0x7FFF))
                    current = this.__digit(startIndex + i + 1)
                    r0 = (current & 0x7FFF) - (sub >>> 15) - borrow
                    borrow = (r0 >>> 15) & 1;
                }
                // Unrolling the last iteration gives a 5% performance benefit!
                const sub: number = subtrahend.__digit(i)
                const r15: number = (current >>> 15) - (sub & 0x7FFF) - borrow;
                borrow = (r15 >>> 15) & 1
                this.__setDigit(startIndex + i, ((r15 & 0x7FFF) << 15) | (r0 & 0x7FFF))
                const subTop: number = sub >>> 15
                if (startIndex + i + 1 >= this.length) {
                    throw '__inplaceSub: out of bounds.'
                }
                if ((halfDigits & 1) === 0) {
                    current = this.__digit(startIndex + i + 1)
                    r0 = (current & 0x7FFF) - subTop - borrow
                    borrow = (r0 >>> 15) & 1
                    this.__setDigit(startIndex + subtrahend.length,
                        (current & 0x3FFF8000) | (r0 & 0x7FFF))
                }
            } else {
                startIndex >>= 1
                let i: number = 0
                for (; i < subtrahend.length - 1; i++) {
                    const current: number = this.__digit(startIndex + i)
                    const sub: number = subtrahend.__digit(i)
                    const r0: number = (current & 0x7FFF) - (sub & 0x7FFF) - borrow
                    borrow = (r0 >>> 15) & 1
                    const r15: number = (current >>> 15) - (sub >>> 15) - borrow
                    borrow = (r15 >>> 15) & 1
                    this.__setDigit(startIndex + i, ((r15 & 0x7FFF) << 15) | (r0 & 0x7FFF))
                }
                const current: number = this.__digit(startIndex + i)
                const sub: number = subtrahend.__digit(i)
                const r0: number = (current & 0x7FFF) - (sub & 0x7FFF) - borrow
                borrow = (r0 >>> 15) & 1
                let r15: number = 0
                if ((halfDigits & 1) === 0) {
                    r15 = (current >>> 15) - (sub >>> 15) - borrow
                    borrow = (r15 >>> 15) & 1
                }
                this.__setDigit(startIndex + i, ((r15 & 0x7FFF) << 15) | (r0 & 0x7FFF))
            }
            return borrow
        }

        public __setDigit(i: number, digit: number): void {
            this.data[i] = digit | 0;
        }

        public __setHalfDigit(i: number, value: number): void {
            const digitIndex = i >>> 1;
            const previous = this.__digit(digitIndex);
            const updated = (i & 1) ? (previous & 0x7FFF) | (value << 15)
                : (previous & 0x3FFF8000) | (value & 0x7FFF);
            this.__setDigit(digitIndex, updated);
        }

        public __trim(): this {
            let newLength = this.data.length
            let last = this.data[newLength - 1]
            while (last === 0) {
                newLength--
                last = this.data[newLength - 1]
                this.data.pop()
            }
            if (newLength === 0) this.sign = false
            return this
        }

        public __unsignedDigit(i: number): number {
            return this.data[i] >>> 0
        }
    }

    export function CreateBigInt(arg: number | string | boolean | object): BigInt {
        if (typeof arg === 'number') {
            if (arg === 0) {
                return zero()
            }
            if (isOneDigitInt(arg)) {
                if (arg < 0) {
                    return oneDigit(-arg, true)
                }
                return oneDigit(arg, false)
            }
            if (Number.isNaN(arg) || Math.floor(arg) !== arg) {
                throw 'The number ' + arg + ' cannot be converted to ' +
                'BigInt because it is not an integer.'
            }
            return fromDouble(arg)
        }
        if (typeof arg === 'string') {
            const result: BigInt = fromString(arg)
            if (result !== null) {
                return result
            }
        }

        throw `Cannot convert ${arg} (type ${typeof arg}) to BigInt.`
    }

    function absoluteAdd(x: BigInt, y: BigInt, resultSign: boolean): BigInt {
        if (x.length < y.length) return absoluteAdd(y, x, resultSign)
        if (x.length === 0) return x
        if (y.length === 0) return x.sign === resultSign ? x : JSBI.unaryMinus(x)
        let resultLength: number = x.length
        if (x.__clzmsd() === 0 || (y.length === x.length && y.__clzmsd() === 0)) {
            resultLength++
        }
        const result: BigInt = new BigInt(resultLength, resultSign)
        let carry = 0
        let i = 0
        for (; i < y.length; i++) {
            const r: number = x.__digit(i) + y.__digit(i) + carry;
            carry = r >>> 30
            result.__setDigit(i, r & 0x3FFFFFFF)
        }
        for (; i < x.length; i++) {
            const r: number = x.__digit(i) + carry
            carry = r >>> 30
            result.__setDigit(i, r & 0x3FFFFFFF)
        }
        if (i < result.length) {
            result.__setDigit(i, carry)
        }
        return result.__trim()
    }

    function absoluteDivLarge(dividend: BigInt, divisor: BigInt,
        wantQuotient: boolean, wantRemainder: boolean): BigDiv | BigInt | undefined {
        const n: number = divisor.__halfDigitLength()
        const n2: number = divisor.length
        const m: number = dividend.__halfDigitLength() - n
        let q: BigInt = null
        if (wantQuotient) {
            q = new BigInt((m + 2) >>> 1, false)
            q.__initializeDigits()
        }
        const qhatv: BigInt = new BigInt((n + 2) >>> 1, false)
        qhatv.__initializeDigits()
        // D1.
        const shift: number = clz15(divisor.__halfDigit(n - 1))
        if (shift > 0) {
            divisor = specialLeftShift(divisor, shift, 0 /* add no digits*/)
        }
        const u: BigInt = specialLeftShift(dividend, shift, 1 /* add one digit */)
        // D2.
        const vn1: number = divisor.__halfDigit(n - 1)
        let halfDigitBuffer: number = 0
        for (let j = m; j >= 0; j--) {
            // D3.
            let qhat: number = 0x7FFF
            const ujn: number = u.__halfDigit(j + n)
            if (ujn !== vn1) {
                const input: number = ((ujn << 15) | u.__halfDigit(j + n - 1)) >>> 0
                qhat = (input / vn1) | 0
                let rhat: number = (input % vn1) | 0
                const vn2: number = divisor.__halfDigit(n - 2)
                const ujn2: number = u.__halfDigit(j + n - 2)
                while ((Math.imul(qhat, vn2) >>> 0) > (((rhat << 16) | ujn2) >>> 0)) {
                    qhat--
                    rhat += vn1
                    if (rhat > 0x7FFF) break
                }
            }
            // D4.
            internalMultiplyAdd(divisor, qhat, 0, n2, qhatv)
            let c: number = u.__inplaceSub(qhatv, j, n + 1)
            if (c !== 0) {
                c = u.__inplaceAdd(divisor, j, n)
                u.__setHalfDigit(j + n, (u.__halfDigit(j + n) + c) & 0x7FFF)
                qhat--
            }
            if (wantQuotient) {
                if (j & 1) {
                    halfDigitBuffer = qhat << 15
                } else {
                    // TODO make this statically determinable
                    (q as BigInt).__setDigit(j >>> 1, halfDigitBuffer | qhat)
                }
            }
        }
        if (wantRemainder) {
            u.__inplaceRightShift(shift)
            if (wantQuotient) {
                return { quotient: (q as BigInt), remainder: u }
            }
            return u
        }
        if (wantQuotient) return (q as BigInt)
        // TODO find a way to make this statically unreachable?
        throw 'absoluteDivLarge: unreachable.'
    }

    function absoluteGreater(bothNegative: boolean): number {
        return bothNegative ? -1 : 1
    }

    function absoluteLess(bothNegative: boolean): number {
        return bothNegative ? 1 : -1
    }

    function absoluteModSmall(x: BigInt, divisor: number): number {
        let remainder = 0
        for (let i = x.length * 2 - 1; i >= 0; i--) {
            const input: number = ((remainder << 15) | x.__halfDigit(i)) >>> 0
            remainder = (input % divisor) | 0
        }
        return remainder
    }

    function absoluteSub(x: BigInt, y: BigInt, resultSign: boolean): BigInt {
        if (x.length === 0) return x
        if (y.length === 0) return x.sign === resultSign ? x : unaryMinus(x)
        const result: BigInt = new BigInt(x.length, resultSign)
        let borrow = 0
        let i = 0
        for (; i < y.length; i++) {
            const r: number = x.__digit(i) - y.__digit(i) - borrow
            borrow = (r >>> 30) & 1
            result.__setDigit(i, r & 0x3FFFFFFF)
        }
        for (; i < x.length; i++) {
            const r: number = x.__digit(i) - borrow
            borrow = (r >>> 30) & 1
            result.__setDigit(i, r & 0x3FFFFFFF)
        }
        return result.__trim()
    }

    export function add(x: BigInt, y: BigInt): BigInt {
        const sign = x.sign
        if (sign === y.sign) {
            // x + y == x + y
            // -x + -y == -(x + y)
            return absoluteAdd(x, y, sign)
        }
        // x + -y == x - y == -(y - x)
        // -x + y == y - x == -(x - y)
        if (compare(x, y) >= 0) {
            return absoluteSub(x, y, sign)
        }
        return absoluteSub(y, x, !sign)
    }

    function clz15(value: number): number {
        return clz30(value) - 15
    }

    function clz30(x: number): number {
        if (x === 0) return 30
        return 29 - (Math.log(x >>> 0) / Math.LN2 | 0) | 0
    }

    /**
     * Standard comparator function.
     * Negative value ==> x < y
     * Positive value ==> x > y
     * Zero ==> x == y
     */
    export function compare(x: BigInt, y: BigInt | number): number {
        if (typeof y == 'number') {
            if (isOneDigitInt(y)) {
                return compareWithInt(x, y)
            } else {
                return compareWithDouble(x, y)
            }
        } else {
            return compareWithBigInt(x, y)
        }
    }

    function compareWithBigInt(x: BigInt, y: BigInt): number {
        if (x.sign !== y.sign) return x.sign ? -1 : 1
        const diff: number = x.length - y.length
        if (diff !== 0) return diff
        let i: number = x.length - 1
        while (i >= 0 && x.__digit(i) === y.__digit(i)) i--
        if (i < 0) return 0
        return x.__unsignedDigit(i) - y.__unsignedDigit(i)
    }

    function compareWithDouble(x: BigInt, y: number): number {
        if (y !== y) return y // NaN.
        if (y === Infinity) return -1
        if (y === -Infinity) return 1
        const xSign: boolean = x.sign
        const ySign: boolean = (y < 0)
        if (xSign !== ySign) return unequalSign(xSign)
        if (y === 0) {
            throw 'compareWithDouble: implementation bug: should be handled elsewhere.'
        }
        if (x.length === 0) return -1
        // JSBI.__kBitConversionDouble[0] = y;
        kBitConversionBuffer.setNumber(NumberFormat.Float64LE, 0, y)
        // const rawExponent = (JSBI.__kBitConversionInts[1] >>> 20) & 0x7FF;
        const rawExponent: number = kBitConversionBuffer.getNumber(NumberFormat.Int32LE,
            Buffer.sizeOfNumberFormat(NumberFormat.Int32LE))
        if (rawExponent === 0x7FF) {
            throw 'compareWithDouble: implementation bug: handled elsewhere.'
        }
        const exponent = rawExponent - 0x3FF
        if (exponent < 0) {
            // The absolute value of y is less than 1. Only 0n has an absolute
            // value smaller than that, but we've already covered that case.
            return absoluteGreater(xSign)
        }
        const xLength: number = x.length
        let xMsd: number = x.__digit(xLength - 1)
        const msdLeadingZeros: number = clz30(xMsd)
        const xBitLength: number = xLength * 30 - msdLeadingZeros
        const yBitLength: number = exponent + 1
        if (xBitLength < yBitLength) return absoluteLess(xSign)
        if (xBitLength > yBitLength) return absoluteGreater(xSign)
        // Same sign, same bit length. Shift mantissa to align with x and compare
        // bit for bit.
        const kHiddenBit: number = 0x00100000
        // let mantissaHigh = (JSBI.__kBitConversionInts[1] & 0xFFFFF) | kHiddenBit;
        let mantissaHigh: number = (kBitConversionBuffer.getNumber(NumberFormat.Int32LE,
            Buffer.sizeOfNumberFormat(NumberFormat.Int32LE)) & 0xFFFFF) | kHiddenBit
        // let mantissaLow = JSBI.__kBitConversionInts[0];
        let mantissaLow: number = kBitConversionBuffer.getNumber(NumberFormat.Int32LE, 0)
        const kMantissaHighTopBit: number = 20
        const msdTopBit: number = 29 - msdLeadingZeros
        if (msdTopBit !== (((xBitLength - 1) % 30) | 0)) {
            throw 'compareWithDouble: implementation bug.'
        }
        let compareMantissa: number // Shifted chunk of mantissa.
        let remainingMantissaBits: number = 0
        // First, compare most significant digit against beginning of mantissa.
        if (msdTopBit < kMantissaHighTopBit) {
            const shift: number = kMantissaHighTopBit - msdTopBit
            remainingMantissaBits = shift + 32
            compareMantissa = mantissaHigh >>> shift
            mantissaHigh = (mantissaHigh << (32 - shift)) | (mantissaLow >>> shift)
            mantissaLow = mantissaLow << (32 - shift)
        } else if (msdTopBit === kMantissaHighTopBit) {
            remainingMantissaBits = 32
            compareMantissa = mantissaHigh
            mantissaHigh = mantissaLow
            mantissaLow = 0
        } else {
            const shift: number = msdTopBit - kMantissaHighTopBit
            remainingMantissaBits = 32 - shift
            compareMantissa =
                (mantissaHigh << shift) | (mantissaLow >>> (32 - shift))
            mantissaHigh = mantissaLow << shift
            mantissaLow = 0
        }
        xMsd = xMsd >>> 0
        compareMantissa = compareMantissa >>> 0
        if (xMsd > compareMantissa) return absoluteGreater(xSign)
        if (xMsd < compareMantissa) return absoluteLess(xSign)
        // Then, compare additional digits against remaining mantissa bits.
        for (let digitIndex = xLength - 2; digitIndex >= 0; digitIndex--) {
            if (remainingMantissaBits > 0) {
                remainingMantissaBits -= 30
                compareMantissa = mantissaHigh >>> 2
                mantissaHigh = (mantissaHigh << 30) | (mantissaLow >>> 2)
                mantissaLow = (mantissaLow << 30)
            } else {
                compareMantissa = 0
            }
            const digit: number = x.__unsignedDigit(digitIndex)
            if (digit > compareMantissa) return absoluteGreater(xSign)
            if (digit < compareMantissa) return absoluteLess(xSign)
        }
        // Integer parts are equal; check whether {y} has a fractional part.
        if (mantissaHigh !== 0 || mantissaLow !== 0) {
            if (remainingMantissaBits === 0) throw 'compareWithDouble: implementation bug.'
            return absoluteLess(xSign)
        }
        return 0;
    }

    function compareWithInt(x: BigInt, y: number): number {
        const xSign: boolean = x.sign
        const ySign: boolean = (y < 0)
        if (xSign !== ySign) return unequalSign(xSign)
        if (x.length === 0) {
            if (ySign) throw 'compareWithInt: implementation bug.'
            return y === 0 ? 0 : -1
        }
        // Any multi-digit BigInt is bigger than an int32.
        if (x.length > 1) return absoluteGreater(xSign)
        const yAbs = Math.abs(y)
        const xDigit = x.__unsignedDigit(0)
        if (xDigit > yAbs) return absoluteGreater(xSign)
        if (xDigit < yAbs) return absoluteLess(xSign)
        return 0
    }

    export function exponentiate(x: BigInt, y: BigInt): BigInt {
        if (y.sign) {
            throw 'exponentiate: Exponent must be positive.'
        }
        if (y.length === 0) {
            return oneDigit(1, false)
        }
        if (x.length === 0) return x
        if (x.length === 1 && x.__digit(0) === 1) {
            // (-1) ** even_number == 1.
            if (x.sign && (y.__digit(0) & 1) === 0) {
                return unaryMinus(x)
            }
            // (-1) ** odd_number == -1, 1 ** anything == 1.
            return x
        }
        // For all bases >= 2, very large exponents would lead to unrepresentable
        // results.
        if (y.length > 1) throw 'exponentiate: BigInt exponent is too big.'
        let expValue: number = y.__unsignedDigit(0)
        if (expValue === 1) return x
        if (expValue >= kMaxLengthBits) {
            throw 'exponentiate: expected product is too big.'
        }
        if (x.length === 1 && x.__digit(0) === 2) {
            // Fast path for 2^n.
            const neededDigits: number = 1 + ((expValue / 30) | 0)
            const sign: boolean = x.sign && ((expValue & 1) !== 0)
            const result: BigInt = new BigInt(neededDigits, sign)
            result.__initializeDigits()
            // All bits are zero. Now set the n-th bit.
            const msd: number = 1 << (expValue % 30)
            result.__setDigit(neededDigits - 1, msd)
            return result
        }
        let result: BigInt = null
        let runningSquare: BigInt = x
        // This implicitly sets the result's sign correctly.
        if ((expValue & 1) !== 0) result = x
        expValue >>= 1
        for (; expValue !== 0; expValue >>= 1) {
            runningSquare = multiply(runningSquare, runningSquare)
            if ((expValue & 1) !== 0) {
                if (result === null) {
                    result = runningSquare
                } else {
                    result = multiply(result, runningSquare)
                }
            }
        }
        // TODO see if there's a way for tsc to infer this will always happen?
        return result as BigInt
    }

    function fillFromParts(result: BigInt, parts: number[], partsBits: number[]): void {
        let digitIndex: number = 0
        let digit: number = 0
        let bitsInDigit: number = 0
        for (let i = parts.length - 1; i >= 0; i--) {
            const part: number = parts[i]
            const partBits: number = partsBits[i]
            digit |= (part << bitsInDigit)
            bitsInDigit += partBits
            if (bitsInDigit === 30) {
                result.__setDigit(digitIndex++, digit)
                bitsInDigit = 0
                digit = 0
            } else if (bitsInDigit > 30) {
                result.__setDigit(digitIndex++, digit & 0x3FFFFFFF)
                bitsInDigit -= 30
                digit = part >>> (partBits - bitsInDigit)
            }
        }
        if (digit !== 0) {
            if (digitIndex >= result.length) throw 'fillFromParts(): implementation bug.'
            result.__setDigit(digitIndex++, digit)
        }
        for (; digitIndex < result.length; digitIndex++) {
            result.__setDigit(digitIndex, 0)
        }
    }

    function fromDouble(value: number): BigInt {
        const sign = value < 0
        // __kBitConversionDouble[0] = value;
        kBitConversionBuffer.setNumber(NumberFormat.Float64LE, 0, value)
        // const rawExponent = (__kBitConversionInts[1] >>> 20) & 0x7FF;
        const rawExponent = (kBitConversionBuffer.getNumber(NumberFormat.Int32LE,
            Buffer.sizeOfNumberFormat(NumberFormat.Int32LE)) >>> 20) & 0x7FF
        const exponent: number = rawExponent - 0x3FF
        const digits: number = ((exponent / 30) | 0) + 1
        const result: BigInt = new BigInt(digits, sign)
        const kHiddenBit: number = 0x00100000
        // let mantissaHigh = (JSBI.__kBitConversionInts[1] & 0xFFFFF) | kHiddenBit;
        let mantissaHigh: number = (kBitConversionBuffer.getNumber(NumberFormat.Int32LE,
            Buffer.sizeOfNumberFormat(NumberFormat.Int32LE)) & 0xFFFFF) | kHiddenBit
        // let mantissaLow = JSBI.__kBitConversionInts[0];
        let mantissaLow: number = kBitConversionBuffer.getNumber(NumberFormat.Int32LE, 0)
        const kMantissaHighTopBit: number = 20
        // 0-indexed position of most significant bit in most significant digit.
        const msdTopBit: number = exponent % 30
        // Number of unused bits in the mantissa. We'll keep them shifted to the
        // left (i.e. most significant part).
        let remainingMantissaBits: number = 0
        // Next digit under construction.
        let digit: number
        // First, build the MSD by shifting the mantissa appropriately.
        if (msdTopBit < kMantissaHighTopBit) {
            const shift = kMantissaHighTopBit - msdTopBit
            remainingMantissaBits = shift + 32
            digit = mantissaHigh >>> shift
            mantissaHigh = (mantissaHigh << (32 - shift)) | (mantissaLow >>> shift)
            mantissaLow = mantissaLow << (32 - shift)
        } else if (msdTopBit === kMantissaHighTopBit) {
            remainingMantissaBits = 32
            digit = mantissaHigh
            mantissaHigh = mantissaLow
            mantissaLow = 0
        } else {
            const shift = msdTopBit - kMantissaHighTopBit
            remainingMantissaBits = 32 - shift
            digit = (mantissaHigh << shift) | (mantissaLow >>> (32 - shift))
            mantissaHigh = mantissaLow << shift
            mantissaLow = 0
        }
        result.__setDigit(digits - 1, digit)
        // Then fill in the rest of the digits.
        for (let digitIndex = digits - 2; digitIndex >= 0; digitIndex--) {
            if (remainingMantissaBits > 0) {
                remainingMantissaBits -= 30
                digit = mantissaHigh >>> 2
                mantissaHigh = (mantissaHigh << 30) | (mantissaLow >>> 2)
                mantissaLow = (mantissaLow << 30)
            } else {
                digit = 0
            }
            result.__setDigit(digitIndex, digit)
        }
        return result.__trim()
    }

    function fromString(s: string, radix: number = 0): BigInt | null {
        // Strip whitespace and separators
        s = s.split('').filter((value: string, index: number): boolean => {
            return !(isWhitespace(value.charCodeAt(0)) ||
                value == ',' || value == '.' || value == '_')
        }).join('')

        let sign: number = 0
        let leadingZero: boolean = false
        const length: number = s.length
        let cursor: number = 0
        if (cursor === length) return zero()
        let current: number = s.charCodeAt(cursor)

        // Detect leading sign character.
        if (current === 0x2B) { // '+'
            if (++cursor === length) return null
            current = s.charCodeAt(cursor)
            sign = 1
        } else if (current === 0x2D) { // '-'
            if (++cursor === length) return null
            current = s.charCodeAt(cursor)
            sign = -1
        }

        // Detect radix.
        if (radix === 0) {
            radix = 10
            if (current === 0x30) { // '0'
                if (++cursor === length) return zero()
                current = s.charCodeAt(cursor)
                if (current === 0x58 || current === 0x78) { // 'X' or 'x'
                    radix = 16
                    if (++cursor === length) return null
                    current = s.charCodeAt(cursor)
                } else if (current === 0x4F || current === 0x6F) { // 'O' or 'o'
                    radix = 8
                    if (++cursor === length) return null
                    current = s.charCodeAt(cursor)
                } else if (current === 0x42 || current === 0x62) { // 'B' or 'b'
                    radix = 2
                    if (++cursor === length) return null
                    current = s.charCodeAt(cursor)
                } else {
                    leadingZero = true
                }
            }
        } else if (radix === 16) {
            if (current === 0x30) { // '0'
                // Allow "0x" prefix.
                if (++cursor === length) return zero()
                current = s.charCodeAt(cursor)
                if (current === 0x58 || current === 0x78) { // 'X' or 'x'
                    if (++cursor === length) return null
                    current = s.charCodeAt(cursor)
                } else {
                    leadingZero = true
                }
            }
        }
        if (sign !== 0 && radix !== 10) return null
        // Skip leading zeros.
        while (current === 0x30) {
            leadingZero = true
            if (++cursor === length) return zero()
            current = s.charCodeAt(cursor)
        }

        // Allocate result.
        const chars: number = length - cursor
        let bitsPerChar: number = kMaxBitsPerChar[radix]
        let roundup: number = kBitsPerCharTableMultiplier - 1
        if (chars > (1 << 30) / bitsPerChar) return null
        const bitsMin: number =
            (bitsPerChar * chars + roundup) >>> kBitsPerCharTableShift
        const resultLength: number = ((bitsMin + 29) / 30) | 0
        const result: BigInt = new BigInt(resultLength, false)

        // Parse.
        const limDigit = radix < 10 ? radix : 10
        const limAlpha = radix > 10 ? radix - 10 : 0

        if ((radix & (radix - 1)) === 0) {
            // Power-of-two radix.
            bitsPerChar >>= kBitsPerCharTableShift
            const parts = []
            const partsBits = []
            let done: boolean = false
            do {
                let part: number = 0
                let bits: number = 0
                while (true) {
                    let d: number
                    if (((current - 48) >>> 0) < limDigit) {
                        d = current - 48
                    } else if ((((current | 32) - 97) >>> 0) < limAlpha) {
                        d = (current | 32) - 87
                    } else {
                        done = true
                        break
                    }
                    bits += bitsPerChar
                    part = (part << bitsPerChar) | d
                    if (++cursor === length) {
                        done = true
                        break
                    }
                    current = s.charCodeAt(cursor)
                    if (bits + bitsPerChar > 30) break
                }
                parts.push(part)
                partsBits.push(bits)
            } while (!done)
            fillFromParts(result, parts, partsBits)
        } else {
            result.__initializeDigits()
            let done: boolean = false
            let charsSoFar: number = 0
            do {
                let part: number = 0
                let multiplier: number = 1
                while (true) {
                    let d: number
                    if (((current - 48) >>> 0) < limDigit) {
                        d = current - 48
                    } else if ((((current | 32) - 97) >>> 0) < limAlpha) {
                        d = (current | 32) - 87
                    } else {
                        done = true
                        break
                    }

                    const m: number = multiplier * radix
                    if (m > 0x3FFFFFFF) break
                    multiplier = m
                    part = part * radix + d
                    charsSoFar++
                    if (++cursor === length) {
                        done = true
                        break
                    }
                    current = s.charCodeAt(cursor)
                }
                roundup = kBitsPerCharTableMultiplier * 30 - 1
                const digitsSoFar = (((bitsPerChar * charsSoFar + roundup) >>>
                    kBitsPerCharTableShift) / 30) | 0
                result.__inplaceMultiplyAdd(multiplier, part, digitsSoFar)
            } while (!done)
        }

        if (cursor !== length) {
            if (!isWhitespace(current)) return null
            for (cursor++; cursor < length; cursor++) {
                current = s.charCodeAt(cursor)
                if (!isWhitespace(current)) return null
            }
        }

        // Get result.
        result.sign = (sign === -1)
        return result.__trim()
    }

    function internalMultiplyAdd(source: BigInt, factor: number, summand: number,
        n: number, result: BigInt): void {
        let carry: number = summand
        let high: number = 0
        for (let i = 0; i < n; i++) {
            const digit: number = source.__digit(i)
            const rx: number = Math.imul(digit & 0x7FFF, factor)
            const ry: number = Math.imul(digit >>> 15, factor)
            const r: number = rx + ((ry & 0x7FFF) << 15) + high + carry
            carry = r >>> 30
            high = ry >>> 15
            result.__setDigit(i, r & 0x3FFFFFFF)
        }
        if (result.length > n) {
            result.__setDigit(n++, carry + high)
            while (n < result.length) {
                result.__setDigit(n++, 0)
            }
        } else {
            if (carry + high !== 0) throw 'internalMultiplyAdd: implementation bug.'
        }
    }

    function isOneDigitInt(x: number): boolean {
        return (x & 0x3FFFFFFF) === x
    }

    function isWhitespace(c: number): boolean {
        if (c <= 0x0D && c >= 0x09) return true;
        if (c <= 0x9F) return c === 0x20;
        if (c <= 0x01FFFF) {
            return c === 0xA0 || c === 0x1680;
        }
        if (c <= 0x02FFFF) {
            c &= 0x01FFFF;
            return c <= 0x0A || c === 0x28 || c === 0x29 || c === 0x2F ||
                c === 0x5F || c === 0x1000;
        }
        return c === 0xFEFF;
    }

    export function mod(x: BigInt, y: BigInt): BigInt {
        if (y.length === 0) throw 'mod: Division by zero.'
        if (compare(x, y) < 0) return x
        const divisor: number = y.__unsignedDigit(0)
        if (y.length === 1 && divisor <= 0x7FFF) {
            if (divisor === 1) return zero()
            const remainderDigit: number = absoluteModSmall(x, divisor)
            if (remainderDigit === 0) return zero()
            return oneDigit(remainderDigit, x.sign)
        }
        const r: BigInt = <BigInt>absoluteDivLarge(x, y, false, true)
        r.sign = x.sign
        return r.__trim()
    }

    export function multiply(x: BigInt, y: BigInt): BigInt {
        if (x.length === 0) return x
        if (y.length === 0) return y
        let resultLength: number = x.length + y.length
        if (x.__clzmsd() + y.__clzmsd() >= 30) {
            resultLength--
        }
        const result: BigInt = new BigInt(resultLength, x.sign !== y.sign)
        result.__initializeDigits();
        for (let i = 0; i < x.length; i++) {
            multiplyAccumulate(y, x.__digit(i), result, i)
        }
        return result.__trim()
    }

    function multiplyAccumulate(multiplicand: BigInt, multiplier: number,
        accumulator: BigInt, accumulatorIndex: number): void {
        if (multiplier === 0) return
        const m2Low: number = multiplier & 0x7FFF
        const m2High: number = multiplier >>> 15
        let carry: number = 0
        let high: number = 0
        for (let i = 0; i < multiplicand.length; i++, accumulatorIndex++) {
            let acc: number = accumulator.__digit(accumulatorIndex)
            const m1 = multiplicand.__digit(i)
            const m1Low = m1 & 0x7FFF
            const m1High = m1 >>> 15
            const rLow = Math.imul(m1Low, m2Low)
            const rMid1 = Math.imul(m1Low, m2High)
            const rMid2 = Math.imul(m1High, m2Low)
            const rHigh = Math.imul(m1High, m2High)
            acc += high + rLow + carry
            carry = acc >>> 30
            acc &= 0x3FFFFFFF
            acc += ((rMid1 & 0x7FFF) << 15) + ((rMid2 & 0x7FFF) << 15)
            carry += acc >>> 30
            high = rHigh + (rMid1 >>> 15) + (rMid2 >>> 15)
            accumulator.__setDigit(accumulatorIndex, acc & 0x3FFFFFFF)
        }
        for (; carry !== 0 || high !== 0; accumulatorIndex++) {
            let acc = accumulator.__digit(accumulatorIndex)
            acc += carry + high
            high = 0
            carry = acc >>> 30
            accumulator.__setDigit(accumulatorIndex, acc & 0x3FFFFFFF)
        }
    }

    function oneDigit(value: number, sign: boolean): BigInt {
        const result = new BigInt(1, sign)
        result.__setDigit(0, value)
        return result
    }

    /**
     * Synonym for mod(x: BigInt, y: BigInt).
     */
    function remainder(x: BigInt, y: BigInt): BigInt {
        return mod(x, y)
    }

    function specialLeftShift(x: BigInt, shift: number, addDigit: 0 | 1): BigInt {
        const n: number = x.length
        const resultLength: number = n + addDigit
        const result: BigInt = new BigInt(resultLength, false)
        if (shift === 0) {
            for (let i: number = 0; i < n; i++) result.__setDigit(i, x.__digit(i))
            if (addDigit > 0) result.__setDigit(n, 0)
            return result
        }
        let carry: number = 0
        for (let i = 0; i < n; i++) {
            const d: number = x.__digit(i)
            result.__setDigit(i, ((d << shift) & 0x3FFFFFFF) | carry)
            carry = d >>> (30 - shift)
        }
        if (addDigit > 0) {
            result.__setDigit(n, carry)
        }
        return result
    }

    export function subtract(x: BigInt, y: BigInt): BigInt {
        const sign = x.sign;
        if (sign !== y.sign) {
            // x - (-y) == x + y
            // (-x) - y == -(x + y)
            return absoluteAdd(x, y, sign);
        }
        // x - y == -(y - x)
        // (-x) - (-y) == y - x == -(x - y)
        if (compare(x, y) >= 0) {
            return absoluteSub(x, y, sign);
        }
        return absoluteSub(y, x, !sign);
    }

    function stringify(x: BigInt, isRecursiveCall: boolean): string {
        // Simplified implementation; always using radix 10.
        const length: number = x.length
        if (length === 0) return ''
        if (length === 1) {
            let result: string = x.__unsignedDigit(0).toString()
            if (isRecursiveCall === false && x.sign) {
                result = '-' + result
            }
            return result
        }
        const bitLength: number = length * 30 - clz30(x.__digit(length - 1))
        const maxBitsPerChar: number = 107 // Magic number from kMaxBitsPerChar[]
        const minBitsPerChar: number = maxBitsPerChar - 1
        let charsRequired: number = bitLength * kBitsPerCharTableMultiplier
        charsRequired += minBitsPerChar - 1
        charsRequired = (charsRequired / minBitsPerChar) | 0
        const secondHalfChars: number = (charsRequired + 1) >> 1
        // Divide-and-conquer: split by a power of {radix = 10} that's approximately
        // the square root of {x}, then recurse.
        const conqueror: BigInt = exponentiate(oneDigit(10, false), oneDigit(secondHalfChars, false))
        let quotient: BigInt
        let secondHalf: string
        const divisor: number = conqueror.__unsignedDigit(0)
        if (conqueror.length === 1 && divisor <= 0x7FFF) {
            quotient = new BigInt(x.length, false)
            quotient.__initializeDigits()
            let remainder: number = 0
            for (let i = x.length * 2 - 1; i >= 0; i--) {
                const input = (remainder << 15) | x.__halfDigit(i)
                quotient.__setHalfDigit(i, (input / divisor) | 0)
                remainder = (input % divisor) | 0
            }
            secondHalf = remainder.toString()
        } else {
            const divisionResult: BigDiv = <BigDiv>absoluteDivLarge(x, conqueror, true, true)
            quotient = divisionResult.quotient
            const remainder: BigInt = divisionResult.remainder.__trim()
            secondHalf = stringify(remainder, true)
        }
        quotient.__trim()
        let firstHalf = stringify(quotient, true)
        while (secondHalf.length < secondHalfChars) {
            secondHalf = '0' + secondHalf
        }
        if (isRecursiveCall === false && x.sign) {
            firstHalf = '-' + firstHalf
        }
        return firstHalf + secondHalf
    }

    export function unaryMinus(x: BigInt): BigInt {
        if (x.length === 0) return x
        const result = x.__copy()
        result.sign = !x.sign
        return result
    }

    function unequalSign(leftNegative: boolean): number {
        return leftNegative ? -1 : 1
    }

    function zero(): BigInt {
        return new BigInt(0, false)
    }
}
