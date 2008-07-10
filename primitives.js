(function () {

if(typeof window.Primitives != 'undefined') {
    var _Primitives = window.Primitives;
}

var gensym_count = 0;


function varargs(fn, minimum) {
    fn._varargs = minimum || 0;
    return fn;
};

var Primitives = window.Primitives = {
    _no_conflict: function() {
        window.Primitives = _Primitives;
        return Primitives;
    },

    _varargs: varargs,

    /*----- Generic interpreter functions -----*/
    error: function() {
        var msg = Utils.invoke(arguments, '__to_js').join('');
        Utils.error(msg);
    },
    
    is: varargs(function() {
        return Types.bool(Utils.pairwise(arguments, true, function(v1, v2) {
            return v1.__teq(v2.__type().__to_js()) && v1.__veq(v2);
        }));
    }, 2),

    uniq: function() { 
        return Types.sym('gs' + (++gensym_count)); 
    },

    sig: Types.table({}),

    sref: function(collection, new_val, index) {
        collection.__set(index, new_val);
        return new_val;
    },

    /*----- Types -----*/

    t: Types.T,
    nil: Types.NIL,
    // Wrapper so that fn.length is properly set
    annotate: function(tag, val) { return Types.tagged(tag, val); },

    type: function(val) { return val.__type(); },
    rep: function(val) { return val._tagged ? val._val : val; },
    coerce: function(val, type) { return val.__coerce(type); },
    // TODO: radix argument for coerce

    /*----- Lists -----*/
    cons: function(car, cdr) { return Types.cons(car, cdr); },

    car: function(list) {
        if(list == Types.NIL) return list;
        Utils.assert("Can't take car of " + list, list._car);
        return list._car;
    },

    cdr: function(list) {
        if(list == Types.NIL) return list; 
        Utils.assert("Can't take cdr of " + list, list._cdr);
        return list._cdr;
    },

    scar: function(cons, new_val) {
        Utils.assert(cons + ' is not a list', cons._car);
        cons._car = new_val;
        return new_val;
    },

    scdr: function(cons, new_val) {
        Utils.assert(cons + ' is not a list', cons._cdr);
        cons._cdr = new_val;
        return new_val;
    },

    /*----- Hashtables -----*/
    table: Types.table,

    /*----- Strings -----*/
    newstring: varargs(function(length, fill) {
        fill = fill != undefined ? fill.__to_js() : '\0';
        var str = '';
        for(var i = 0; i < length; ++i) {
            str += fill;
        }
        return Types.str(str);
    }, 1),

    /*----- Arithmetic -----*/
    '+': varargs(function() { 
        var op = function(x, y) { return x + y; };
        if(Utils.all(arguments, function(x) { return x.__teq('string'); })) {
            op = function(x, y) { return x.toString() + y.toString(); };
        } else if(Utils.all(arguments, function(x) { 
                    return x.__teq("cons") || x == Types.NIL; })) {
            op = function(x, y) { 
                var accum = x.__to_list ? x.__to_list() : x;
                return accum.concat(y.__to_list()); 
            };
        }
            
        var result = Utils.fold1(arguments, op);
        if(result instanceof Array) {
            return Types.list(result);
        } else if(typeof result == 'string') {
            return Types.str(result);
        } else {
            return Types.wrap_num(result)
        }
    }),
    '-': varargs(function() { return Types.wrap_num(Utils.fold1(arguments, 'x - y')); }),
    '*': varargs(function() { return Types.wrap_num(Utils.fold1(arguments, 'x * y')); }),
    '/': varargs(function() { return Types.wrap_num(Utils.fold1(arguments, 'x / y')); }),
    'mod': function(x, y) { return Types.int_(x % y); },
    'expt': function(base, pow) { return Types.wrap_num(Math.pow(base, pow)); },
    'sqrt': function(x) { return Types.wrap_num(Math.sqrt(x)); },

    '>': varargs(function() { return Types.bool(Utils.pairwise(arguments, true, 'x > y')); }),
    '<': varargs(function() { return Types.bool(Utils.pairwise(arguments, true, 'x < y')); }),

    len: function(x) {
        switch(x.__type().__to_js()) {
            case 'cons': return Types.int_(x.__to_list().length);
            case 'string': return Types.int_(x.length);
            case 'table': return Types.int_(x.__length());
            default: Utils.error(x.__type() + ' has no len method');
        }
    },

    rand: function(max) {
        return Types.int_(Math.floor(Math.random() * max));
    },

    // No-ops for now; dunno if they're doable in Javascript
    truncate: Utils.id,
    exact: Utils.id

};

})();
