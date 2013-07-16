
/**
 * module dependencies
 */

var domstream = require('domstream')
	,	el = document.getElementById('el')
	, stream = domstream(el).source({start: 'mousemove', end: 'mouseout'})

stream.through(
function write (data) {
	this.push({x:data.x, y:data.y});
	el.querySelector('[name=state]').value = '('+ [data.x, data.y].join(',') +')';
},
function end () {
	var buf = this.read();
	el.querySelector('[name=state]').value = 'end';
	for (var i = 0; i < buf.length; ++i) {
		var d = buf.shift()
		console.log(d.x, d.y)
	}
});