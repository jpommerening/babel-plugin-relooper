# babel-plugin-relooper

> Convert the Array methods `.map`, `.filter`, `.reduce`, `.every` and `.some`
> to plain loops.

## Why?

The array methods are awesome. I use them all the time. Unfortunately,
sometimes, when you're processing really large arrays, all those function calls
add up and can really [slow things down][jsperf].

Luckily, a [sufficiently smart compiler][smart] can just optimize the function
calls away as long as we don't use recursion or some other weird constructs,
right? Sadly, current JavaScript engines don't appear to be sufficiently smart
in that regard yet.

This [Babel][babel] plugin converts calls to the array methods back to plain
loops, as long as Babel can figure out you are calling them on an actual array
and you're using anonymous function expressions.

That way I can continue to slam `.map`, `.reduce` and whathaveyou everywhere
without giving a damn about performance. Hooray!

*Note:* Currently pretty experimental & under development.

[jsperf]: http://jsperf.com/native-vs-array-js-vs-underscore/144 "jsPerf - comparing different looping strategies"
[smart]: http://c2.com/cgi/wiki?SufficientlySmartCompiler "Sufficiently Smart Compiler"
[babel]: https://babeljs.io "Babel – a JavaScript compiler"
