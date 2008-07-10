(function () {

if(typeof window.Eval != 'undefined') {
    var _Eval = window.val;
}

function is_literal(expr) {
    switch(expr.__type().__to_js()) {
        case 'char':
        case 'string':
        case 'int':
        case 'num':
            return true;
        default:
            return false;
    }
};

function xcar(expr) {
    return expr.__teq('cons') ? expr._car : false;
};

function car_eq(expr, val) {
    var car = xcar(expr);
    return car && car.__eq(val);
};

function cadr(expr) {
    return expr._cdr._car;
};

function apply(fn, args) {
    Utils.assert('Null function object passed', fn);
    while(fn._tagged) {
        fn = fn._val;
    }
    if(fn.__call == 'native') {
        return apply_fn(fn, args);
    } else {
        return fn.__call(args);
    }
};

function apply_fn(fn, args) {
    var new_env = {};
    new_env.__proto__ = fn._env;
    args = Types.list(args);

    function bind_var(fn_arg, call_arg) {
        var recurse = true;
        if(fn_arg.__teq('cons')) {
            // Not the end of the list...
            var sym = fn_arg._car;
            if(sym.__teq('sym')) {
                // Normal binding
                if(call_arg.__teq('cons')) {
                    new_env[sym] = call_arg._car;
                    bind_var(fn_arg._cdr, call_arg._cdr);
                } else {
                    Utils.error('Wrong number of args for function: expected ' +
                        fn._args.__print() + ', found ' + args.__print());
                }
            } else if(car_eq(sym, 'o')) {
                // Optional parameters
                var default_expr = cadr(sym._cdr);
                new_env[cadr(sym)] = call_arg._car || 
                    (default_expr ? eval(default_expr, new_env) : Types.NIL);
                bind_var(fn_arg._cdr, call_arg._cdr || call_arg);
            } else if(sym.__teq('cons')) {
                // Destructuring
                bind_var(sym, call_arg._car);
            } else {
                Utils.error('Unknown object type in arg list ' + fn._args.__print());
            }
        } else if(fn_arg == Types.NIL && call_arg == Types.NIL) {
            // End of the arg list; do nothing
        } else if(fn_arg.__teq('sym')) {
            // Rest parameter
            new_env[fn_arg] = call_arg;
        } else {
            Utils.error("Couldn't bind parameters " + args + ' to list ' + fn._args);
        }
    };

    bind_var(fn._args, args);
    var last_result = Types.NIL;
    fn._body.__each(function(expr) {
        last_result = eval(expr, new_env);
    });
    return last_result;
};

function eval_quasiquote(expr, env) {
    var accum = [];
    do {
        var current = expr._car;
        if(car_eq(current, 'unquote')) {
            accum.push(eval(cadr(current), env));
        } else if(car_eq(current, 'unquote-splicing')) {
            var results = eval(cadr(current), env).__to_list();
            for(var i = 0, len = results.length; i < len; ++i) {
                accum.push(results[i]);
            }
        } else if(current.__teq('cons')) {
            accum.push(eval_quasiquote(current, env));
        } else {
            accum.push(current);
        }
        expr = expr._cdr;
    } while(expr.__teq('cons'));
    return Types.list(accum);
};

function eval_symbol(expr, env) {
    if(!is_symbol_macro(expr)) {
        var result = env[expr];
        if(!result) {
            Utils.error('Unbound variable ' + expr);
        }
        return result;
    } else { 
        return eval(symbol_expand(expr), env);
    }
};

function eval_if(expr, env) {
    Utils.assert('No test for conditional', expr._car);
    var test = eval(expr._car, env);

    if(expr._cdr == Types.NIL) {
        return test;
    }

    if(test == Types.NIL) {
        var alternative = expr._cdr._cdr;
        return alternative != Types.NIL ? eval_if(alternative, env) : Types.NIL;
    } else {
        var consequent = cadr(expr);
        Utils.assert('No if-true clause', consequent);
        return eval(consequent, env);
    }
};

function eval_fn(expr, env) {
    return Types.fn(expr._car, expr._cdr, env);
};

function eval_symbol_macro(expr, env, macrodefs) {
    var name = cadr(expr),
        def = Types.fn(Types.list(Types.sym('expr')), expr._cdr._cdr, env);
    return macrodefs[name] = env[name] = def;
};

function eval_set(expr, env) {
    function set_value(varname, value, env_segment) {
        if(!env_segment) {
            eval.global_env[varname] = value;
            return;
        }

        // hasOwnProperty requires a JS string, for some reason, even
        // though the actual key is a symbol string
        if(env_segment.hasOwnProperty(varname.__to_js())) {
            env_segment[varname] = value;
        } else {
            set_value(varname, value, env_segment.__proto__);
        }
    };
    
    var varname, value;
    while(expr != Types.NIL) {
        varname = expr._car;
        value = eval(cadr(expr), env);
        set_value(varname, value, env);
        expr = expr._cdr._cdr;
    };
    return value;
};

function is_macro(expr, env) {
    env = env || eval.global_env;
    var sym = expr._car;
    return sym && env[sym] && env[sym].__teq('mac');
};

function eval_call(expr, env) {
    if(is_macro(expr, env)) {
        return eval_macro_call(expr, env);
    } else {
        return eval_fn_call(expr, env);
    }
};

function is_symbol_macro(expr) {
    return expr.indexOf('~') != -1 || expr.indexOf(':') != -1;
};

function symbol_expand(expr, env) {
    function complement(section) {
        return section.charAt(0) == '~' 
            ? Types.list(Types.sym('complement'), Types.sym(section.substr(1)))
            : Types.sym(section);
    };
    var sections = expr.split(':');
    return sections.length > 1 
        ? Types.list([Types.sym('compose')].concat(Utils.map(sections, complement)))
        : complement(sections[0]);
};

function macro_expand(expr, env) {
    // Assumes that we've already checked and made sure the call is a macro
    env = env || eval.global_env;
    var macro_def = env[expr._car],
        macro_result = apply(macro_def, expr._cdr.__to_list());
    Utils.assert('Macro call has no return value', macro_result);
    return macro_result;
};

function eval_macro_call(expr, env) {
    return eval(macro_expand(expr, env), env);
};

function eval_fn_call(expr, env) {
    var form = expr.__to_list();
    for(var i = 0, len = form.length; i < len; ++i) {
        var result = eval(form[i], env);
        Utils.assert("Eval of " + form[i].__print() + " yielded undefined", result);
        form[i] = result;
    }
    return apply(form[0], form.slice(1));
};

var eval = window.Eval = function(expr, env) {
    env = env || eval.global_env;

    try {
        if(is_literal(expr)) {
            return expr;
        } else if(expr.__teq('sym')) {
            return eval_symbol(expr, env);
        } else if(car_eq(expr, 'quote')) {
            return cadr(expr);
        } else if(car_eq(expr, 'quasiquote')) {
            return eval_quasiquote(cadr(expr), env);
        } else if(car_eq(expr, 'if')) {
            return eval_if(expr._cdr, env);
        } else if(car_eq(expr, 'fn')) {
            return eval_fn(expr._cdr, env);
        } else if(car_eq(expr, 'set')) {
            return eval_set(expr._cdr, env);
        } else if(expr.__teq('cons')) {
            return eval_call(expr, env);
        } else {
            Utils.error('Unknown form type ' + expr);
        }
    } catch(e) {
        if(!(e instanceof Utils.ArcError)) {
            Utils.error('Internal error: '  + e.message, expr);
        } else {
            e.expr = expr;
            throw e;
        }
    }
};

var exposed_interpreter_functions = {
    
    bound: function(name) {
        return eval.global_env[name] || Types.NIL;
    },

    apply: Primitives._varargs(function() {
        // The behavior of apply is to flatten the last element into the arg list
        // if it is itself a list.  I have no idea why it does this; it leads to
        // odd behavior like (apply + 1 2 '(3 4)) => 10 but 
        // (apply + 1 '(2 3) 4) => error.  But I need to do it for compatibility.
        var args = [].slice.call(arguments, 1),
            last_elem = args[args.length - 1];
        if(last_elem.__teq('cons')) {
            args = args.slice(0, -1).concat(last_elem.__to_list());
        }
        return apply(arguments[0], args);
    }, 1),
    
    'atomic-invoke': function(f) { return apply(f, []); },

    ssyntax: function(expr) { return Types.bool(is_symbol_macro(expr)); },
    ssexpand: function(expr) { return symbol_expand(expr, eval.global_env); },
    macex1: function(expr) { return is_macro(expr) ? macro_expand(expr) : expr; },
    macex: function(expr) {
        while(is_macro(expr)) {
            expr = macro_expand(expr);
        }
        return expr;
    },

    // Fake I/O:
    stdout: function() { return Types.T; },
    stdin: function() { return Types.T; },
    sread: function(arc_string) { return Read(arc_string.__to_js()); },
    disp: Primitives._varargs(function() {
        for(var i = 0, len = arguments.length; i < len; ++i) {
            eval.stdout += arguments[i];
        }
        return Types.NIL;
    }),

    writec: Primitives._varargs(function(c) {
        eval.stdout += c;
        return Types.NIL;
    }, 1)

};

function init_globals() {
    var env = {};
    function add_primitive(namespace, name) {
        var prim = namespace[name];
        if(typeof prim == 'function') {
            env[name] = Types.primitive(prim, name);
        } else if(name.charAt(0) != '_') {
            env[name] = prim;
        }
    };
    for(var prop in Primitives) {
        add_primitive(Primitives, prop);
    }
    for(var prop in exposed_interpreter_functions) {
        add_primitive(exposed_interpreter_functions, prop);
    }
    return env;
};

Utils.extend(eval, {

    no_conflict: function() {
        window.Eval = _eval;
        return eval;
    },

    init_globals: init_globals,
    global_env: init_globals(),
    character_macros: {},
    symbol_macros: {},
    
    eval_line: function(text) {
        return eval(Read(text));
    },

    eval_text: function(text) {
        var last_result,
            buf = Buffer(text);
        while(buf.peek() !== false) {
            var text = Read(buf);
            if(text === false) break;   // Last token is zero-length
            last_result = eval(text);
            buf.read_until(Read.is_not_whitespace);
        }
        return last_result;
    },

    stdout: '',
    stdin: '',
    clear_stdout: function() {
        eval.stdout = '';
    }
});

})();
