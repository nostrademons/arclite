(function (t) {
/**
 * S-expression reader, capable of reading one or multiple S-expressions
 * out of a string of text and returning them as nested JavaScript lists.
 * 
 * @dependency buffer.js
 * @dependency types.js
 */


if(typeof window.Read != 'undefined') {
    var _read = window.Read;
}

function is_newline(c) {
    return c == '\n' || c == '\r';
};

function is_whitespace(c) {
    return c == ' ' ||  c == '\t' || is_newline(c);
};

function is_not_whitespace(c) {
    return !is_whitespace(c);
};

function is_delim(c) {
    return c === false || is_whitespace(c) || c == '(' || c == ')' 
        || c == '[' || c == ']';
};

function decorate_form(keyword, buffer, eat_char) {
    eat_char = eat_char == undefined ? true : eat_char;
    if(eat_char) {
        buffer.eat();
    }
    var form = read(buffer);
    buffer.read_until(is_not_whitespace);
    return Types.list([Types.sym(keyword), form]);
};

function read_token(buffer) {
    var token = buffer.read_until(is_delim);
    buffer.read_until(is_not_whitespace);
    return token;
};

function read_string(buffer) {
    function is_segment_break(c) {
        return c == '\\' || c == '"';
    };
    buffer.eat();   // "
    var str = '';
    while(buffer.peek() != '"') {
        if(buffer.peek() === false) {
            Utils.error('Unclosed string literal');
        }

        if(buffer.peek() == '\\') {
            buffer.eat()    // \
            var c = buffer.read();
            switch(c) {
                case 'n': str += '\n'; break;
                case 'r': str += '\r'; break;
                case 't': str += '\t'; break;
                case '"': str += '"'; break;
                case '0': str += '\0'; break;
                default: Utils.error('Invalid escape char: ' + c);
            }
        };
        str += buffer.read_until(is_segment_break);
    };
    buffer.eat();   // trailing "
    buffer.read_until(is_not_whitespace);
    return Types.str(str);
};

function read_delimited(delim, buffer) {
    var elements = [];

    buffer.eat();   // open (
    buffer.read_until(is_not_whitespace);
    var c;
    while((c = buffer.peek()) != delim) {
        if(c === false) {
            Utils.error('Unclosed delimiter');
        }
        elements.push(read(buffer));
    }
    buffer.eat();   // close )
    buffer.read_until(is_not_whitespace);

    var len = elements.length;
    if(len >= 3) {
        var is_dotted = false,
            possible_dot = elements[len - 2];
        if(possible_dot.__type().__eq('sym') && possible_dot.__eq('.')) {
            elements[len - 2] = elements[len - 1];
            elements.length--;
            is_dotted = true;
        }
    }

    return Types.list(elements, is_dotted);
};

function read_list(buffer) {
    return read_delimited(')', buffer);
};

function read_brackets(buffer) {
    return Types.list([Types.sym('fn'), Types.list([Types.sym('_')]), 
                       read_delimited(']', buffer)]);
};

function parse_char_literal(token) {
    var c = token.substr(2);
    switch(c) {
        case 'newline': return '\n';
        case 'space': return ' ';
        case 'tab': return '\t';
        default: return c.charAt(0) == 'x' && c.length > 1 ? 
            String.fromCharCode(parseInt(c.substr(1), 16)) : c;
    };
};

function parse_token(token) {
    if(token.match(/^-?\d+\.\d+(e\d+)?$/i)) {
        return Types.num(parseFloat(token));
    } else if(token.match(/^-?\d+$/)) {
        return Types.int_(parseInt(token));
    } else if(token.match(/^#\\.+$/)) {
        return Types.chr(parse_char_literal(token));
    } else if(token == 'nil') {
        return Types.NIL;
    } else {
        return Types.sym(token);
    }
};

function read(buffer) {
    var c = buffer.peek();
    switch(c) {
        case false: return false;
        case '"': return read_string(buffer);
        case "'": return decorate_form('quote', buffer);
        case '`': return decorate_form('quasiquote', buffer);
        case '(': return read_list(buffer);
        case '[': return read_brackets(buffer);
        case ',':
            buffer.eat();
            if(buffer.peek() == '@') {
                return decorate_form('unquote-splicing', buffer);
            } else {
                return decorate_form('unquote', buffer, false);
            }
        case ';': 
            buffer.read_until(is_newline);
            buffer.read_until(is_not_whitespace);
            return read(buffer);
        default: 
            return parse_token(read_token(buffer));
    }
};

window.Read = function(text) {
    if(!(text instanceof Buffer)) {
        text = Buffer(text);
    }
    return read(text);
};

Utils.extend(window.Read, {
    no_conflict: function() {
        window.Read = _read;
        return read;
    },
    is_not_whitespace: is_not_whitespace,

    // Exposed for testing...
    test: {
        is_delim: is_delim,
        is_not_whitespace: is_not_whitespace,
        read_token: read_token
    }
});

})(Types);
