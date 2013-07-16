
# domstream

Turn DOM element events into streams

## Installation

`$ component install jwerle/domstream`

## Usage

***binding the 'mousemove' and 'mouseout' events as starting and ending points to a stream on a DOM element***

```js
var domstream = require('domstream')
  , el = document.getElementById('el')
  , stream = domstream(el).source({start: 'mousemove', end: 'mouseout'})

stream.through(
  function write (data) {
    this.push({x:data.x, y:data.y});
  },
  function end (buf) {
    for (var i = 0; i < buf.length; ++i) {
      var d = buf.shift()
      console.log(d.x, d.y)
    }
  });
```

The above is just short hand for:

```js
stream.on('data', function (data) {
  stream.push({x: data.x, y: data.y})
});

stream.on('end', function () {
  var buf = stream.read();
  for (var i = 0; i < buf.length; ++i) {
    var d = buf.shift()
    console.log(d.x, d.y)
  }
});
```

## API

### domstream(el)

Accepts a DOM Node and returns a readable/writable `DOMStream` influenced from node.js

```js
var stream = domstream(document.getElementById('node'));
```

#### Events

##### 'readable'

When there is data ready to be consumed, this event will fire.

##### 'data'

Emitted when data is written to stream.

##### 'end'

Emitted when the end of stream event has been emitted.

##### 'error'

Emitted if there was an error receiving data.

### source(opts)

* `.start` - The event that when emitted instantiates the 'data' event of the stream
* `.end` - The event that when emitted instantiates the end of the stream which will emit the 'end' event

```js
stream.source({start: 'dragstart', end: 'dragend'});
```

### #write(data)

Writes data to stream

```js
stream.write({some: 'data'});
```

### #push(data) | queue(data)

Pushes a chunk to the stream buffer

```js
stream.push({data: 'for later'});
```

### #unshift(data)

Unshifts a chunk to the stream buffer

```js
stream.unshift({data: 'for later'});
```

### #read(size, offset)

Reads a given optional size to read from the stream buffer

```js
var data = stream.read(5);
```

```js
var buf = stream.read();
```

### #end(data)

Writes data to stream and emits end event

```js
stream.end({even: 'more data'});
```

### #use(fn)

Pushes a function to the `startStack` array for acting like middle ware to data emitted from for the start event defined with `bind()` or `source()`

```js
stream.use(function (data, next) {
  data.property = "value";
  next();
});
```

### #through(write, end)

Defines a write and end handle for the stream handle

```js
stream.through(
function write (data) {
  this.push(data);
},
function end () {
  console.log(this.read());
});
```

### #pipe(dest, opts)

Pipes stream to a Writeable stream (lightly ported from node.js)

```js
stream.pipe(otherStream);
```

## License

  MIT
