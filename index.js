
/**
 * module dependencies
 */

var Emitter = require('emitter')
	, ready = require('domready')
	, Events = require('events')


var isArray = Array.isArray


/**
 * Exports
 */

module.exports = DOMStream;
module.exports.Event = Event;


/**
 * Validates a given chunk for pushing/unshifting to a buffer
 *
 * @api private
 * @param {Mixed} chunk
 */

function chunkIsValid (chunk) {
	return 'string' === chunk
		|| null === chunk
		|| undefined !== chunk
		|| 'object' === typeof chunk;
}


/**
 * Defers execution by `0ms`
 *
 * @api private
 * @param {Function} fn
 */

function nextTick (fn) {
	setTimeout(fn, 0);
}


/**
 * `DOMStream` constructor
 *
 * @api public
 * @param {Node} el
 */

function DOMStream (el) {
	if (!(this instanceof DOMStream)) return new DOMStream(el);

	var self = this;

	this.readable = true;
	this.writeable = true;
	this.pipesCount = 0;
	this.startStack = [];
	this.buffer = [];
	this.pipes = [];
	this.el = el;
	this.needReable = false;
	this.emittedReadable = false;

	this.on('readable', function () {
		self.needReable = false;
		self.emittedReadable = true;
	})


	ready(function () {
		self.emit('readable');
	});
}

// inherit from `Emitter`
Emitter(DOMStream.prototype);

DOMStream.ready = ready;


/**
 * Writes data to stream
 */

DOMStream.prototype.write = function (chunk) {
	if (this.needReable) this.push(chunk);
	else this.emit('data', chunk);
	return this;
};

/**
 * Pushes a chunk to the stream buffer
 *
 * @api public
 * @param {Mixed} chunk
 */

DOMStream.prototype.queue =
DOMStream.prototype.push = function (chunk) {
	if (null === chunk) { 
		self.emit('end');
	} else {
		if (!chunkIsValid(chunk)) throw new TypeError("invalid chunk type");
		if (this.needReable) this.emit('readable');
		return this.buffer.push(chunk);
	}
};


/**
 * Unshifts a chunk to the stream buffer
 *
 * @api public
 * @param {Mixed} chunk
 */

DOMStream.prototype.unshift = function (chunk) {
	if (!chunkIsValid(chunk)) throw new TypeError("invalid chunk type");
	if (this.needReable) this.emit('readable');
	return this.buffer.unshift(chunk);
};


/**
 * Reads a given optional size to read from the stream buffer
 *
 * @api public
 * @param {Number|null} size - optional
 * @param {Number|null} offset - optional
 */

DOMStream.prototype.read = function (size, offset) {
	if (undefined !== size && 'number' !== typeof size) {
		throw new TypeError("expecting a number as a size");
	}

	if (0 === this.buffer.length) {
		this.needReable = true;
		return null;
	} else if (0 === size && this.buffer.length) {
		if (!this.emittedReadable) {
			this.emittedReadable = true;
			this.emit('readable');
		}

		return null
	} else if (size > this.buffer.length) {
		this.needReable = true;
		return null;
	} else if (undefined === size) {
		return this.buffer;
	} else {
		return this.buffer.slice(offset || 0, size);
	}

};


DOMStream.prototype.end = function (chunk) {
	this.write(chunk);
	this.emit('end');
	return this;
};


/**
 * Pushes a function to the `startStack` array
 * for acting like middle ware to data emitted
 * from for the start event defined with `bind()` or `source()`
 *
 * @api public
 * @param {Function} fn
 */

DOMStream.prototype.use = function (fn) {
	if ('function' !== typeof fn) throw new TypeError("expecting function");
	else this.startStack.push(fn.bind(this));
	return this;
};


/**
 * Creates an event stream 
 */

DOMStream.prototype.source = 
DOMStream.prototype.bind = function (opts) {
	var self = this
	if ('object' !== typeof opts) throw new TypeError("expecting object");
	var events = Events(this.el, {
		start: function (data) {
			executeStack(self.startStack, data);
		},

		end: function (data) {
			self.emit('end', data);
		}
	});
	
	if (isArray(opts.start)) {
		opts.start = opts.start.join(' ')
	}

	if (isArray(opts.end)) {
		opts.end = opts.end.join(' ')
	}

	opts.start.split(' ').map(function (event) {
		events.bind(event, 'start');
	});

	opts.end.split(' ').map(function (event) {
		events.bind(event, 'end');
	});

	return this.use(this.write);
};


function executeStack (stack, data) {
	var i = 0
	!function next(d) {
		if (!stack.length) return;
		stack[i++](d || data, next);
	}();
}



/**
 * Defines a write and end handle
 *
 * @api public
 * @param {Function} fn
 * @param {Function} end
 */

DOMStream.prototype.through = function (write, end) {
	this.on('data', write);
	this.on('end', end);
	return this;
};



////// ported from node ////

/**
 * Pipes stream to a Writeable stream
 *
 * @api public
 * @param {Object} dest
 * @param {Object} opts
 */

DOMStream.prototype.pipe = function(dest, pipeOpts) {
  var src = this;

  switch (this.pipesCount) {
    case 0:
      this.pipes = dest;
      break;
    case 1:
      this.pipes = [this.pipes, dest];
      break;
    default:
      this.pipes.push(dest);
      break;
  }
  
  ++this.pipesCount;

  var doEnd = (!pipeOpts || pipeOpts.end !== false);
  var endFn = doEnd ? onend : cleanup;

  if (this.endEmitted) nextTick(endFn);
  else src.once('end', endFn);

  dest.on('unpipe', onunpipe);

  function onunpipe(readable) {
    if (readable !== src) return;
    cleanup();
  }

  function onend() {
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  function cleanup() {
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (!dest._writableState || dest._writableState.needDrain)
      ondrain();
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    unpipe();
    if (!dest._callbacks.error || 0 === dest._callbacks.error.length)
      dest.emit('error', er);
  }
  dest.once('error', onerror);

  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!this.flowing) {
    // the handler that waits for readable events after all
    // the data gets sucked out in flow.
    // This would be easier to follow with a .once() handler
    // in flow(), but that is too slow.
    this.on('readable', pipeOnReadable);

    this.flowing = true;
    function fn () {
    	dest.emit.bind(dest, 'data').apply(null, arguments);
    }
    src.on('data', fn);
    dest.on('end', function () {
    	src.removeListener('data', fn)
    });
  }

  return dest;
};


function pipeOnDrain(src) {
  return function() {
    var dest = this;
    src.awaitDrain--;
    if (src.awaitDrain === 0)
      flow(src);
  };
}

function flow(src) {
  var chunk;

  function write(dest, i, list) {
    if (false === dest.write(chunk)) src.awaitDrain++;
  }

  src.awaitDrain = 0;

  while (src.pipesCount && null !== (chunk = src.read())) {

    if (src.pipesCount === 1) write(src.pipes, 0, null);
    else src.pipes.forEach(write);

    src.emit('data', chunk);

    if (src.awaitDrain > 0) return;
  }

  if (src.pipesCount === 0) {
    src.flowing = false;

    if (src._callbacks.data && src._callbacks.error.length > 0)
      emitDataEvents(src);

    return;
  }

  // at this point, no one needed a drain, so we just ran out of data
  // on the next readable event, start it over again.
  src.ranOut = true;
}

function pipeOnReadable() {
  if (this.ranOut) {
    this.ranOut = false;
    flow(this);
  }
}