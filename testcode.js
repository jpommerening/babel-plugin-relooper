var a = [ 1, 2, 3 ];
var _y = 1;

var b = a.map(function(x, i, ary) {
  var y = 2 * x;
  console.log(x, y, i, ary);
  return y + 1 + this.a;
}, { a: 1 }).map((x, i, a) => i + x);

a.forEach(function(x) {
  console.log(x);
});
