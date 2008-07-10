(function() {

if(typeof window.Buffer != 'undefined') {
    var _Buffer = window.Buffer;
}

var Buffer = window.Buffer = function(args) {
    if(this instanceof arguments.callee) {
        this.init.apply(this, args && args.callee ? args : arguments);
    } else {
        return new Buffer(arguments);
    }
};

Buffer.no_conflict = function() {
    window.Buffer = _Buffer;
    return Buffer;
};

Buffer.prototype = {

    init: function(text) {
        this._text = text;
        this._pos = 0;
    },

    read: function() {
        var c = this.peek();
        if(c === false) {
            return false;        
        }

        this.eat();
        return c;
    },

    read_until: function(pred) {
        var start = this._pos
        while(this.peek() !== false && !pred(this.peek())) {
            this.eat();
        };
        return this._text.substring(start, this._pos);
    },

    eat: function() {
        ++this._pos;
        if(this._pos > this._text.length) {
            throw new Error('Unexpected end of file at position ' + this._pos);
        }
    },

    peek: function() {
        if(this._pos >= this._text.length) {
            return false;
        }

        return this._text.charAt(this._pos);
    },

    get: function(index) {
        return this._text.charAt(index != undefined ? index : this._pos);
    }

};

})();
