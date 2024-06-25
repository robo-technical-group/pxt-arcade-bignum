# Big Numbers for MakeCode

This library contains ports of Google's [JavaScript BigInt library, *a.k.a.* JSBI](https://github.com/GoogleChromeLabs/jsbi) and
MikeMcl's [big.js library](https://github.com/MikeMcl/big.js/) to MakeCode. This will start as a TypeScript-only implementation;
it eventually will include support for the Blocks interface.

# TODO

- [X] Change namespace to `BigNum`.
- [X] Add appropriate jsdoc and cleanup documentation.
- [X] Allow creation from boolean.
- [ ] Add annotations to enhance debugger support.
- [ ] Allow `number` arguments to operations where supported.
- [ ] Implement method chaining to support things like `a.multiply(x).add(b).mod(m).mod(p)`.
- [X] Add remaining JSBI operations.
  - [X] Right shift.
- [ ] Add tests from `big.js` library.
  - [ ] Streamline testing where appropriate.
  - [ ] Backport appropriate tests to BigInt.
- [ ] Add `big.js` library.

> Open this page at [https://robo-technical-group.github.io/pxt-arcade-bignum/](https://robo-technical-group.github.io/pxt-arcade-bignum/)

## Use as Extension

This repository can be added as an **extension** in MakeCode.

* open [https://arcade.makecode.com/](https://arcade.makecode.com/)
* click on **New Project**
* click on **Extensions** under the gearwheel menu
* search for **https://github.com/robo-technical-group/pxt-arcade-bignum** and import

## Edit this project ![Build status badge](https://github.com/robo-technical-group/pxt-arcade-bignum/workflows/MakeCode/badge.svg)

To edit this repository in MakeCode.

* open [https://arcade.makecode.com/](https://arcade.makecode.com/)
* click on **Import** then click on **Import URL**
* paste **https://github.com/robo-technical-group/pxt-arcade-bignum** and click import

## Blocks preview

This image shows the blocks code from the last commit in master.
This image may take a few minutes to refresh.

![A rendered view of the blocks](https://github.com/robo-technical-group/pxt-arcade-bignum/raw/master/.github/makecode/blocks.png)

#### Metadata (used for search, rendering)

* for PXT/arcade
<script src="https://makecode.com/gh-pages-embed.js"></script><script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>
