(function () {
/**
 * Some basic utility functions.  I want to avoid coupling this to large
 * JavaScript libraries.
 */
if(typeof window.Utils != 'undefined') {
    var _Utils = window.Utils;
}

function ArcError(msg, expr) {
    this.message = msg;
    this.expr = expr;
};
ArcError.prototype = new Error();
ArcError.prototype.name = 'ArcError';

var Utils = window.Utils = {

    no_conflict: function() {
        window.Utils = _Utils;
        return Utils;
    },

    extend: function(dest, src) {
        for(var prop in src) {
            if(src.hasOwnProperty(prop)) {
                dest[prop] = src[prop];
            }
        }
        return dest;
    },

    class_decorator: function(init, new_proto) {
        new_proto.__init = init;
        var constr =  function() {
            var self = init.apply(this, arguments);
            var args = [self.__proto__].concat([].slice.call(arguments, 1));
            self.__proto__ = new_proto;
            return self;
        };
        constr.__fake_proto = new_proto;
        return constr;
    },

    invoke: function(collection, method) {
        var accum = [],
            args = [].slice.call(arguments, 2);
        for(var i = 0, len = collection.length; i < len; ++i) {
            var item = collection[i];
            accum.push(item[method].apply(item, args));
        }
        return accum;
    },

    map: function(collection, fn) {
        var accum = [];
        for(var i = 0, len = collection.length; i < len; ++i) {
            accum.push(fn(collection[i], i));
        }
        return accum;
    },

    prop_map: function(collection, fn) {
        for(var prop in collection) {
            if(collection.hasOwnProperty(prop)) {
                collection[prop] = fn(collection[prop], prop);
            }
        }
        return collection;
    },

    ensure_fn: function(fn) {
        if(typeof fn == 'string') {
            fn = eval('false || function(x, y) { return ' + fn + '; }');
        };
        return fn;
    },

    all: function(args, pred) {
        pred = Utils.ensure_fn(pred);
        for(var i = 0, len = args.length; i < len; ++i) {
            if(!pred(args[i])) {
                return false;
            }
        }
        return true;
    },

    pairwise: function(args, base, pred) {
        if(args.length == 0) {
            return base;
        }
        pred = Utils.ensure_fn(pred);

        for(var i = 0, len = args.length - 1; i < len; ++i) {
            if(!pred(args[i], args[i + 1])) {
                return false;
            }
        }
        return true;
    },

    fold1: function(args, fn) {
        if(args.length == 0) {
            return 0;
        } else if(args.length == 1) {
            return args[0];
        }
        fn = Utils.ensure_fn(fn);

        var base = args[0];
        for(var i = 1, len = args.length; i < len; ++i) {
            base = fn(base, args[i]);
        }
        return base;
    },

    assert: function(msg, condition) {
        if(!condition) {
            Utils.error('Assertion failure: ' + msg);
        }
    },

    error: function(msg, expr) {
        throw new ArcError(msg, expr);
    },

    id: function(val) {
        return val;
    },

    ArcError: ArcError

};

})();
