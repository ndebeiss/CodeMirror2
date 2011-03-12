
CodeMirror.defineMode("sa_xml", function(config, parserConfig) {

function EndOfLine() {}

function SourceWrapper(source) {
    this.source = source;
}
SourceWrapper.WS = new RegExp('[\\t\\n\\r ]');
SourceWrapper.prototype.peek = function () {
    return this.source.peek();
};
SourceWrapper.prototype.next = function () {
    var ch = this.source.next();
    if (typeof ch === 'undefined') {
        throw new EndOfLine();
    }
    return ch;
};
SourceWrapper.prototype.nextChar = function (dontSkipWhiteSpace) {
    this.next();
    if (!dontSkipWhiteSpace) {
        this.skipWhiteSpaces();
    }
};
SourceWrapper.prototype.skipWhiteSpaces = function () {
    this.source.eatWhile(SourceWrapper.WS);
};
SourceWrapper.prototype.nextCharRegExp = function(regExp, continuation) {
    var returned = "", currChar = this.peek();
    while (true) {
        if (currChar.length == 0 || currChar.search(regExp) !== -1) {
            if (continuation && currChar.search(continuation.pattern) !== -1) {
                var cb = continuation.cb.call(this);
                if (cb !== true) {
                    return cb;
                }
                returned += currChar;
                currChar = this.peek();
                continue;
            }
            return returned;
        } else {
            returned += currChar;
            //consumes actual char
            this.source.next();
            currChar = this.peek();
        }
    }
};

SourceWrapper.prototype.nextCharWhileNot = function(ch) {
    var returned = "", currChar = this.peek();
    while (currChar !== ch && currChar.length > 0) {
        returned += currChar;
        this.source.next();
        currChar = this.peek();
    }
    return returned;
};

SourceWrapper.prototype.matchRegExp = function(len, regExp, dontConsume) {
    return this.source.match(regExp, !dontConsume, false);
};

SourceWrapper.prototype.matchStr = function(str) {
    return this.source.match(str, true, false);
};

SourceWrapper.prototype.matchChar = function(ch) {
    if (this.equals(ch)) {
        this.source.next();
        return true;
    }
    return false;
};


SourceWrapper.prototype.quoteContent = function() {
    var quote = this.next();
    var content = this.nextCharWhileNot(quote);
    this.next();
    return content;
};

SourceWrapper.prototype.equals = function(ch) {
    return ch === this.peek();
};

SourceWrapper.prototype.unequals = function(ch) {
    return ch !== this.peek();
};

SourceWrapper.prototype.unread = function (str) {
    this.source.push(str);
};



var STATE_XML_DECL                  =  0;
var STATE_PROLOG                    =  1;
var STATE_EXT_ENT                   =  2;
var STATE_PROLOG_DOCTYPE_DECLARED   =  3;
var STATE_ROOT_ELEMENT              =  4;
var STATE_CONTENT                   =  5;
var STATE_TRAILING_MISC             =  6;

    function TokenParsed(token) {
        this.token = token;
    }
    function Handler(source, state, saxParser) {
        this.source = source;
        this.state = state;
        this.saxParser = saxParser;
    }
    Handler.prototype.getErrorDiv = function() {
        if (!this.errorDiv) {
            this.errorDiv = document.getElementById("error");
        }
        return this.errorDiv;
    };
    Handler.prototype.startDocument = function() {
    };
    Handler.prototype.warning = function(saxParseException) {
        saxParseException.token = "xml-warning";
        this.getErrorDiv().innerHTML += "<br/>" + saxParseException.message;
        throw saxParseException;
    };
    Handler.prototype.error = function(saxParseException) {
        saxParseException.token = "xml-error";
        this.getErrorDiv().innerHTML += "<br/>" + saxParseException.toString();
        throw saxParseException;
    };
    Handler.prototype.fatalError = function(saxParseException) {
        saxParseException.token = "xml-error";
        this.getErrorDiv().innerHTML += "<br/>" + saxParseException.toString();
        throw saxParseException;
    };
    Handler.prototype.startDTD = function(name, publicId, systemId) {
        this.state.currentToken = "xml-start-dtd";
    };
    Handler.prototype.attributeDecl = function(eName, aName, type, mode, value) {};
    Handler.prototype.elementDecl = function(name, model) {};
    Handler.prototype.externalEntityDecl = function(name, publicId, systemId) {};
    Handler.prototype.internalEntityDecl = function(name, value) {};
    Handler.prototype.startCharacterReference = function(hex, number) {};
    Handler.prototype.endDTD = function(name, publicId, systemId) {};
    Handler.prototype.startEntity = function(name) {};
    Handler.prototype.startCharacterReference = function(hex, number) {};
    Handler.prototype.startElement = function(namespaceURI, localName, qName, atts) {
        var token = "xml-name";
        //treatment is interrupted so have to update the state manually
        if (this.saxParser.saxScanner.elementsStack.length > 0) {
            this.saxParser.saxScanner.state = STATE_CONTENT;
        } else {
            this.saxParser.saxScanner.state = STATE_TRAILING_MISC;
        }
        throw new TokenParsed(token);
    };
    Handler.prototype.endElement = function(namespaceURI, localName, qName) {
        var token = "xml-name";
        if (this.saxParser.saxScanner.elementsStack.length === 0) {
            this.saxParser.saxScanner.state = STATE_TRAILING_MISC;
        }
        throw new TokenParsed(token);        
    };
    Handler.prototype.characters = function(ch, start, length) {
        var token = "xml-text";
        throw new TokenParsed(token);
    };

    Handler.prototype.comment = function(comment, start, length) {
        var token = "xml-comment";
        throw new TokenParsed(token);
    };

    Handler.prototype.ignorableWhitespace = function(ch, start, length) {
       throw new TokenParsed(null);
    };

 function firstNext(source, state) {
        try {
            var readerWrapper = new SourceWrapper(source);
            state.saxParser.initReaders(readerWrapper);
            state.saxParser.saxScanner.parse(readerWrapper);
        } catch(e) {
            if (e instanceof EndOfLine) {
                 return this.currentToken;
            }
            return e.token;
        }
}

function startLineNext(source, state) {
        try {
            //change the source to the new line
            state.saxParser.saxScanner.reader = new SourceWrapper(source);
            state.saxParser.saxScanner.continueParsing();
        } catch(e) {
            return e.token;
        }
}


function next(source, state) {
        try {
            state.saxParser.saxScanner.continueParsing();
        } catch(e) {
            return e.token;
        }
}


  return {
    startState: function() {
        var state = {tokenize: firstNext, cc: [], indented: 0, startOfDoc: true, startOfLine: true, tagName: null};
        state.saxParser = XMLReaderFactory.createXMLReader();
        state.saxParser.setFeature('http://apache.org/xml/features/nonvalidating/load-external-dtd', true);
        state.saxParser.setFeature('http://xml.org/sax/features/validation', true);
        return state;
    },

    token: function(stream, state) {
//e;
      if (stream.eol()) return null;
      if (!stream.column()) {
        state.startOfLine = true;
        state.indented = stream.indentation();
        if (state.startOfDoc) {
            state.tokenize = firstNext;
            state.startOfDoc = false;
        } else {
            state.tokenize = startLineNext;
        }
      }
      if (stream.eatSpace()) return null;

      var contentHandler = new Handler(stream, state, state.saxParser);
      state.saxParser.setHandler(contentHandler);
      var style = state.tokenize(stream, state);
      state.startOfLine = false;
      state.tokenize = next;
      return style;
    },

    copyState: function(state) {
      var nstate = {};
      for (var n in state) {
        var val = state[n];
        if (val instanceof Array) {
          val = val.concat([]);
        } else if (val instanceof SAXParser) {
          val = XMLReaderFactory.createXMLReader();
          val.setFeature('http://apache.org/xml/features/nonvalidating/load-external-dtd', true);
          val.setFeature('http://xml.org/sax/features/validation', true);
          val.setHandler(state[n].contentHandler);
          var readerWrapper = new SourceWrapper(null);
          val.initReaders(readerWrapper);
          val.saxScanner.elementsStack = state[n].saxScanner.elementsStack;
          val.saxScanner.namespaceSupport = state[n].saxScanner.namespaceSupport;
          val.saxScanner.entities = state[n].saxScanner.entities;
          val.saxScanner.parameterEntities = state[n].saxScanner.parameterEntities;
          val.saxScanner.externalEntities = state[n].saxScanner.externalEntities;
          val.saxScanner.currentEntities = state[n].saxScanner.currentEntities;
          val.saxScanner.relativeBaseUris = state[n].saxScanner.relativeBaseUris;
          val.saxScanner.state = state[n].saxScanner.state;
        }
        nstate[n] = val;
      }
      return nstate;
    },

    indent: function(state, textAfter) {
      return 0;
    }
  };
});
