(function ($) {
/**
 * A representation for primitive types.  Arc types inherit from a common
 * base class that provides defaults (all of which just raise an error)
 * for some of the basic operations that the interpreter performs.
 * 
 * @dependency utils.js
 */

if(typeof window.Types != 'undefined') {
    var _Types = window.Types;
}

var ArcBase = {

    _not_defined: function(method) {
        $.error('' + method + ' not defined on ' + this._type);
    },
    _cant_be_coerced: function(type) {
        $.error(this._type + " object can't be coerced to " + type);
    },

    __type: function() { return this._type; },
    __call: function(args) { return Types.bool(this.__veq(args[0])); },
    __set: function(index, val) { this._not_defined('__set'); },
    __coerce: function(type) { this._not_defined('coerce'); },
    __to_js: function() { return this; },
    __eq: function(js_obj) { return this.__to_js() == js_obj; },
    __teq: function(js_obj) { return this.__type().__eq(js_obj); },
    __veq: function(arc_obj) { return this.__eq(arc_obj.__to_js()); },
    __print: function() { return Types.str(this.toString()); }
};

function new_arc_type(base_proto, init, methods) {
    $.extend(base_proto, ArcBase);
    $.extend(base_proto, methods);
    return $.class_decorator(init, base_proto);
};

function copy_number(val) {
    return new Number(val);
};

function copy_string(val) {
    return new String(val);
};

function make_tagged(type, val) {
    return { _val: val, _type: type, _tagged: true };
};

function make_cons(car, cdr) {
    $.assert('Passed a non-arc object as car of a list', car && car.__type);
    $.assert('Passed a non-arc object as cdr of a list', cdr && cdr.__type);
    return { _car: car, _cdr: cdr };
};

function make_table(val) {
    return val || {};
};

function make_function(args, body, env) {
    return {
        _args: args,
        _body: body,
        _env: env
    }
};

function decorate_primitive(fn, name) {
    fn._name = name || 'unnamed';
    return fn;
};

// Must be declared outside because it's referenced in the definition of Types
var sym = new_arc_type(new String(), copy_string, {});
$.extend(sym.__fake_proto, {
    _type: sym('sym'),
    __coerce: function(type) {
        if(type.__eq('string')) {
            return Types.str(this == Types.NIL ? '' : this.__to_js())
        } else {
            return this._not_defined(type);
        }
    },
    __to_list: function() { return []; }, // For nil
    __to_js: function() { 
        var retval = this.toString();
        if(retval == 't') return true;
        if(retval == 'nil') return false;
        return this.toString(); 
    }
});

var Types = window.Types = {

    no_conflict: function() {
        window.Types = _Types;
        return Types;
    },

    tagged: new_arc_type(new Object(), make_tagged, {
        __call: function(args) { return this._val.__call.call(this._val, args); },
        __set: function(index, val) { return this._val.__set.call(this._val, index, val); },
        __print: function() {
            return Types.str('(tagged ' + this._type + ' ' + this._val.__print() + ')');
        }
    }),

    sym: sym,
    NIL: sym('nil'),
    T: sym('t'),
    bool: function(val) {
        return val ? Types.T : Types.NIL;
    },

    chr: new_arc_type(new String(), copy_string, { 
        _type: sym('char'),
        __to_js: function() { return this.toString(); },
        __coerce: function(type) {
            switch(type.__to_js()) {
                case 'int': return Types.int_(this.charCodeAt(0));
                case 'string': return Types.str(this);
                case 'sym': return Types.sym(this);
                default: return this._cant_be_coerced(type);
            }
        },
        __print: function() { return Types.str('#\\' + this); }
    }),

    str: new_arc_type(new String(), copy_string, { 
        _type: sym('string'),
        __call: function(args) {
            return Types.chr(this.charAt(args[0]));
        },
        __set: function(index, new_val) {
            // The spec says to mutate the string, but JavaScript strings are
            // immutable.  Instead we return a copy with the specified character
            // changed, and hope that nobody was depending upon mutation
            return Types.str(this.substr(0, index) + new_val.toString() 
                            + this.substr(index + 1));
        },
        __coerce: function(type) {
            switch(type.__to_js()) {
                case 'sym': return Types.sym(this);
                case 'cons': 
                    var retval = [];
                    for(var i = 0, len = this.length; i < len; ++i) {
                        retval.push(Types.chr(this.charAt(i)));
                    }
                    return Types.list(retval);
                case 'int': 
                    var parsed = parseInt(this);
                    if(isNaN(parsed)) {
                        $.error("Can't coerce " + this + ' to int');
                    }
                    return Types.int_(parsed);
                default: return this._cant_be_coerced(type);
            }
        },
        __to_js: function() { return this.toString(); },
        __print: function() { return Types.str('"' + this + '"'); }
    }),

    int_: new_arc_type(new Number(), copy_number, { 
        _type: sym('int'),
        __coerce: function(type) {
            switch(type.__to_js()) {
                case 'char': return Types.chr(String.fromCharCode(this));
                case 'string': return Types.str(this.toString());
                default: return this._cant_be_coerced(type);
            }
        },
        __to_js: function() { return parseInt(this.toString()); }
    }),

    num: new_arc_type(new Number(), copy_number, { 
        _type: sym('num'),
        __coerce: function(type) {
            switch(type.__to_js()) {
                case 'int': return Types.int_(Math.round(this));
                case 'char': return Types.chr(String.fromCharCode(Math.round(this)));
                case 'string': return Types.str(this.toString());
                default: return this._cant_be_coerced(type);
            }
        },
        __to_js: function() { return parseFloat(this.toString()); }
    }),

    cons: new_arc_type(new Object(), make_cons, { 
        _type: sym('cons'),
        __index: function(index) {
            var current = this;
            for(var i = 0; i < index; ++i) {
                current = current._cdr;
                if(!current.__type().__eq('cons')) {
                    $.error('Index out of range: ' + index);
                }
            }
            return current;
        },
        __call: function(args) {
            return this.__index(args[0])._car;
        },
        __set: function(index, new_val) {
            this.__index(index)._car = new_val;
            return new_val;
        },
        __each: function(fn) {
            var current = this;
            while(current.__teq('cons')) {
                fn(current._car);
                current = current._cdr;
            }
            return current;
        },
        __coerce: function(type) {
            if(type.__to_js() == 'string') {
                var accum = '';
                function add_char(chr) { 
                    accum += String.fromCharCode(chr.__to_js());
                };
                var last = this.__each(add_char);
                if(!last == Types.NIL) {
                    add_char(last);
                }
                return Types.str(accum);
            } else {
                return this._cant_be_coerced(type);
            }
        },
        __to_list: function() {
            var retval = [];
            var last = this.__each(function(elem) { retval.push(elem); });
            if(last != Types.NIL) {
                retval.push(last);
            }
            return retval;
        },
        __print: function() {
            var segments = [];
            var last = this.__each(function(elem) { 
                segments.push(elem.__print().toString());
            });
            if(last != Types.NIL) {
                segments.push('.');
                segments.push(last.__print().toString());
            }
            return Types.str('(' + segments.join(' ') + ')');
        },
        __to_js: function() { return this.__to_list(); }
    }),

    list: function(arr, improper) {
        if(arr.length == 0) {
            return Types.NIL;
        }

        var i = arr.length - 1;
        for(var current = improper ? arr[i--] : Types.NIL; i >= 0; --i) {
            current = Types.cons(arr[i], current);
        }
        return current;
    },

    table: new_arc_type(new Object(), make_table, { 
        _type: sym('table'),
        __call: function(args) {
            return this[args[0].toString()] || Types.NIL;
        },
        __set: function(index, new_val) {
            if(new_val == Types.NIL) {
                delete this[index];
            } else {
                this[index] = new_val;
            }
            return new_val;
        },
        __length: function() {
            var len = 0;
            Utils.prop_map(this, function() { len++; });
            return len;
        },
        __print: function() {
            var text = '#hash(';
            Utils.prop_map(this, function(v, key) { text += '(' + key + ' . ' + ')'; });
            return Types.str(text + ')');
        },
        __to_js: function() {
            return Utils.extend({}, this);
        }
    }),

    fn: new_arc_type(new Object(), make_function, { 
        _type: sym('fn'),
        __call: 'native',
        __print: function() {
            var argstr = this._args.__teq('cons') 
                ? '(' + this._args.__to_list().join(' ') + ')'
                : this._args.toString();
            return Types.str('#procedure: ' + argstr);
        }
    }),

    primitive: new_arc_type(new Function(), decorate_primitive, {
        _type: sym('fn'),
        __call: function(args) {
            if(this._varargs === undefined && args.length != this.length) {
                Utils.error(this._name + ' takes ' + this.length + 
                            ' arguments, found ' + Types.list(args).__print());
            }
            if(this._varargs !== undefined && args.length < this._varargs) {
                Utils.error(this._name + ' takes at least ' + this.length + 
                            ' arguments, found ' + Types.list(args).__print());

            }
            var result = this.apply(null, args);
            Utils.assert(this._name + ' did not return a value.', result);
            return result;
        },
        __print: function() {
            return Types.str('#primitive procedure: ' + this._name);
        }
    }),

    to_js: function(arc_obj) {
        var result = arc_obj.__to_js();
        return Utils.prop_map(result, Types.to_js);
    },

    to_arc: function(js_obj) {
        switch(typeof js_obj) {
            case 'number': return Types.wrap_num(js_obj);
            case 'string': return Types.str(js_obj);
            case 'boolean': return Types.bool(js_obj);
            case 'function': return Types.primitive(js_obj);
            case 'undefined': return Types.NIL;
            default:
                if(js_obj instanceof Array) {
                    return Types.list(Utils.map(js_obj, Types.to_arc));
                } else {
                    return Types.table(Utils.prop_map(Utils.extend({}, js_obj), 
                                                      Types._to_arc));
                }
        }
    },

    /** Detects the type of the result and wraps it with a num or int_ */
    wrap_num: function(result) {
        var constr = result == Math.round(result) ? Types.int_ : Types.num;
        return constr(result);
    }

};

})(Utils);
