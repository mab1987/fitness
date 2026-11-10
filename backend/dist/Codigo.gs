// Meu treino — backend completo (gerado por ferramentas/juntar-backend.js). Não edite aqui.

// ===== 00_Bcrypt.gs =====
// bcrypt.js 2.4.3 (Apache License 2.0) — https://github.com/dcodeIO/bcrypt.js
// Ajuste para Apps Script: usa globalThis como objeto global.
/*
 Copyright (c) 2012 Nevins Bartolomeo <nevins.bartolomeo@gmail.com>
 Copyright (c) 2012 Shane Girish <shaneGirish@gmail.com>
 Copyright (c) 2014 Daniel Wirtz <dcode@dcode.io>

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions
 are met:
 1. Redistributions of source code must retain the above copyright
 notice, this list of conditions and the following disclaimer.
 2. Redistributions in binary form must reproduce the above copyright
 notice, this list of conditions and the following disclaimer in the
 documentation and/or other materials provided with the distribution.
 3. The name of the author may not be used to endorse or promote products
 derived from this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR
 IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT,
 INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * @license bcrypt.js (c) 2013 Daniel Wirtz <dcode@dcode.io>
 * Released under the Apache License, Version 2.0
 * see: https://github.com/dcodeIO/bcrypt.js for details
 */
(function(global, factory) {

    /* AMD */ if (typeof define === 'function' && define["amd"])
        define([], factory);
    /* CommonJS */ else if (typeof require === 'function' && typeof module === "object" && module && module["exports"])
        module["exports"] = factory();
    /* Global */ else
        (global["dcodeIO"] = global["dcodeIO"] || {})["bcrypt"] = factory();

}(typeof globalThis !== "undefined" ? globalThis : this, function() {
    "use strict";

    /**
     * bcrypt namespace.
     * @type {Object.<string,*>}
     */
    var bcrypt = {};

    /**
     * The random implementation to use as a fallback.
     * @type {?function(number):!Array.<number>}
     * @inner
     */
    var randomFallback = null;

    /**
     * Generates cryptographically secure random bytes.
     * @function
     * @param {number} len Bytes length
     * @returns {!Array.<number>} Random bytes
     * @throws {Error} If no random implementation is available
     * @inner
     */
    function random(len) {
        /* node */ if (typeof module !== 'undefined' && module && module['exports'])
            try {
                return require("crypto")['randomBytes'](len);
            } catch (e) {}
        /* WCA */ try {
            var a; (self['crypto']||self['msCrypto'])['getRandomValues'](a = new Uint32Array(len));
            return Array.prototype.slice.call(a);
        } catch (e) {}
        /* fallback */ if (!randomFallback)
            throw Error("Neither WebCryptoAPI nor a crypto module is available. Use bcrypt.setRandomFallback to set an alternative");
        return randomFallback(len);
    }

    // Test if any secure randomness source is available
    var randomAvailable = false;
    try {
        random(1);
        randomAvailable = true;
    } catch (e) {}

    // Default fallback, if any
    randomFallback = null;
    /**
     * Sets the pseudo random number generator to use as a fallback if neither node's `crypto` module nor the Web Crypto
     *  API is available. Please note: It is highly important that the PRNG used is cryptographically secure and that it
     *  is seeded properly!
     * @param {?function(number):!Array.<number>} random Function taking the number of bytes to generate as its
     *  sole argument, returning the corresponding array of cryptographically secure random byte values.
     * @see http://nodejs.org/api/crypto.html
     * @see http://www.w3.org/TR/WebCryptoAPI/
     */
    bcrypt.setRandomFallback = function(random) {
        randomFallback = random;
    };

    /**
     * Synchronously generates a salt.
     * @param {number=} rounds Number of rounds to use, defaults to 10 if omitted
     * @param {number=} seed_length Not supported.
     * @returns {string} Resulting salt
     * @throws {Error} If a random fallback is required but not set
     * @expose
     */
    bcrypt.genSaltSync = function(rounds, seed_length) {
        rounds = rounds || GENSALT_DEFAULT_LOG2_ROUNDS;
        if (typeof rounds !== 'number')
            throw Error("Illegal arguments: "+(typeof rounds)+", "+(typeof seed_length));
        if (rounds < 4)
            rounds = 4;
        else if (rounds > 31)
            rounds = 31;
        var salt = [];
        salt.push("$2a$");
        if (rounds < 10)
            salt.push("0");
        salt.push(rounds.toString());
        salt.push('$');
        salt.push(base64_encode(random(BCRYPT_SALT_LEN), BCRYPT_SALT_LEN)); // May throw
        return salt.join('');
    };

    /**
     * Asynchronously generates a salt.
     * @param {(number|function(Error, string=))=} rounds Number of rounds to use, defaults to 10 if omitted
     * @param {(number|function(Error, string=))=} seed_length Not supported.
     * @param {function(Error, string=)=} callback Callback receiving the error, if any, and the resulting salt
     * @returns {!Promise} If `callback` has been omitted
     * @throws {Error} If `callback` is present but not a function
     * @expose
     */
    bcrypt.genSalt = function(rounds, seed_length, callback) {
        if (typeof seed_length === 'function')
            callback = seed_length,
            seed_length = undefined; // Not supported.
        if (typeof rounds === 'function')
            callback = rounds,
            rounds = undefined;
        if (typeof rounds === 'undefined')
            rounds = GENSALT_DEFAULT_LOG2_ROUNDS;
        else if (typeof rounds !== 'number')
            throw Error("illegal arguments: "+(typeof rounds));

        function _async(callback) {
            nextTick(function() { // Pretty thin, but salting is fast enough
                try {
                    callback(null, bcrypt.genSaltSync(rounds));
                } catch (err) {
                    callback(err);
                }
            });
        }

        if (callback) {
            if (typeof callback !== 'function')
                throw Error("Illegal callback: "+typeof(callback));
            _async(callback);
        } else
            return new Promise(function(resolve, reject) {
                _async(function(err, res) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(res);
                });
            });
    };

    /**
     * Synchronously generates a hash for the given string.
     * @param {string} s String to hash
     * @param {(number|string)=} salt Salt length to generate or salt to use, default to 10
     * @returns {string} Resulting hash
     * @expose
     */
    bcrypt.hashSync = function(s, salt) {
        if (typeof salt === 'undefined')
            salt = GENSALT_DEFAULT_LOG2_ROUNDS;
        if (typeof salt === 'number')
            salt = bcrypt.genSaltSync(salt);
        if (typeof s !== 'string' || typeof salt !== 'string')
            throw Error("Illegal arguments: "+(typeof s)+', '+(typeof salt));
        return _hash(s, salt);
    };

    /**
     * Asynchronously generates a hash for the given string.
     * @param {string} s String to hash
     * @param {number|string} salt Salt length to generate or salt to use
     * @param {function(Error, string=)=} callback Callback receiving the error, if any, and the resulting hash
     * @param {function(number)=} progressCallback Callback successively called with the percentage of rounds completed
     *  (0.0 - 1.0), maximally once per `MAX_EXECUTION_TIME = 100` ms.
     * @returns {!Promise} If `callback` has been omitted
     * @throws {Error} If `callback` is present but not a function
     * @expose
     */
    bcrypt.hash = function(s, salt, callback, progressCallback) {

        function _async(callback) {
            if (typeof s === 'string' && typeof salt === 'number')
                bcrypt.genSalt(salt, function(err, salt) {
                    _hash(s, salt, callback, progressCallback);
                });
            else if (typeof s === 'string' && typeof salt === 'string')
                _hash(s, salt, callback, progressCallback);
            else
                nextTick(callback.bind(this, Error("Illegal arguments: "+(typeof s)+', '+(typeof salt))));
        }

        if (callback) {
            if (typeof callback !== 'function')
                throw Error("Illegal callback: "+typeof(callback));
            _async(callback);
        } else
            return new Promise(function(resolve, reject) {
                _async(function(err, res) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(res);
                });
            });
    };

    /**
     * Compares two strings of the same length in constant time.
     * @param {string} known Must be of the correct length
     * @param {string} unknown Must be the same length as `known`
     * @returns {boolean}
     * @inner
     */
    function safeStringCompare(known, unknown) {
        var right = 0,
            wrong = 0;
        for (var i=0, k=known.length; i<k; ++i) {
            if (known.charCodeAt(i) === unknown.charCodeAt(i))
                ++right;
            else
                ++wrong;
        }
        // Prevent removal of unused variables (never true, actually)
        if (right < 0)
            return false;
        return wrong === 0;
    }

    /**
     * Synchronously tests a string against a hash.
     * @param {string} s String to compare
     * @param {string} hash Hash to test against
     * @returns {boolean} true if matching, otherwise false
     * @throws {Error} If an argument is illegal
     * @expose
     */
    bcrypt.compareSync = function(s, hash) {
        if (typeof s !== "string" || typeof hash !== "string")
            throw Error("Illegal arguments: "+(typeof s)+', '+(typeof hash));
        if (hash.length !== 60)
            return false;
        return safeStringCompare(bcrypt.hashSync(s, hash.substr(0, hash.length-31)), hash);
    };

    /**
     * Asynchronously compares the given data against the given hash.
     * @param {string} s Data to compare
     * @param {string} hash Data to be compared to
     * @param {function(Error, boolean)=} callback Callback receiving the error, if any, otherwise the result
     * @param {function(number)=} progressCallback Callback successively called with the percentage of rounds completed
     *  (0.0 - 1.0), maximally once per `MAX_EXECUTION_TIME = 100` ms.
     * @returns {!Promise} If `callback` has been omitted
     * @throws {Error} If `callback` is present but not a function
     * @expose
     */
    bcrypt.compare = function(s, hash, callback, progressCallback) {

        function _async(callback) {
            if (typeof s !== "string" || typeof hash !== "string") {
                nextTick(callback.bind(this, Error("Illegal arguments: "+(typeof s)+', '+(typeof hash))));
                return;
            }
            if (hash.length !== 60) {
                nextTick(callback.bind(this, null, false));
                return;
            }
            bcrypt.hash(s, hash.substr(0, 29), function(err, comp) {
                if (err)
                    callback(err);
                else
                    callback(null, safeStringCompare(comp, hash));
            }, progressCallback);
        }

        if (callback) {
            if (typeof callback !== 'function')
                throw Error("Illegal callback: "+typeof(callback));
            _async(callback);
        } else
            return new Promise(function(resolve, reject) {
                _async(function(err, res) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(res);
                });
            });
    };

    /**
     * Gets the number of rounds used to encrypt the specified hash.
     * @param {string} hash Hash to extract the used number of rounds from
     * @returns {number} Number of rounds used
     * @throws {Error} If `hash` is not a string
     * @expose
     */
    bcrypt.getRounds = function(hash) {
        if (typeof hash !== "string")
            throw Error("Illegal arguments: "+(typeof hash));
        return parseInt(hash.split("$")[2], 10);
    };

    /**
     * Gets the salt portion from a hash. Does not validate the hash.
     * @param {string} hash Hash to extract the salt from
     * @returns {string} Extracted salt part
     * @throws {Error} If `hash` is not a string or otherwise invalid
     * @expose
     */
    bcrypt.getSalt = function(hash) {
        if (typeof hash !== 'string')
            throw Error("Illegal arguments: "+(typeof hash));
        if (hash.length !== 60)
            throw Error("Illegal hash length: "+hash.length+" != 60");
        return hash.substring(0, 29);
    };

    /**
     * Continues with the callback on the next tick.
     * @function
     * @param {function(...[*])} callback Callback to execute
     * @inner
     */
    var nextTick = typeof process !== 'undefined' && process && typeof process.nextTick === 'function'
        ? (typeof setImmediate === 'function' ? setImmediate : process.nextTick)
        : (typeof setTimeout === "function" ? setTimeout : function (fn) { fn(); }); // Apps Script não tem setTimeout

    /**
     * Converts a JavaScript string to UTF8 bytes.
     * @param {string} str String
     * @returns {!Array.<number>} UTF8 bytes
     * @inner
     */
    function stringToBytes(str) {
        var out = [],
            i = 0;
        utfx.encodeUTF16toUTF8(function() {
            if (i >= str.length) return null;
            return str.charCodeAt(i++);
        }, function(b) {
            out.push(b);
        });
        return out;
    }

    // A base64 implementation for the bcrypt algorithm. This is partly non-standard.

    /**
     * bcrypt's own non-standard base64 dictionary.
     * @type {!Array.<string>}
     * @const
     * @inner
     **/
    var BASE64_CODE = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split('');

    /**
     * @type {!Array.<number>}
     * @const
     * @inner
     **/
    var BASE64_INDEX = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0,
        1, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, -1, -1, -1, -1, -1, -1,
        -1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
        20, 21, 22, 23, 24, 25, 26, 27, -1, -1, -1, -1, -1, -1, 28, 29, 30,
        31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
        48, 49, 50, 51, 52, 53, -1, -1, -1, -1, -1];

    /**
     * @type {!function(...number):string}
     * @inner
     */
    var stringFromCharCode = String.fromCharCode;

    /**
     * Encodes a byte array to base64 with up to len bytes of input.
     * @param {!Array.<number>} b Byte array
     * @param {number} len Maximum input length
     * @returns {string}
     * @inner
     */
    function base64_encode(b, len) {
        var off = 0,
            rs = [],
            c1, c2;
        if (len <= 0 || len > b.length)
            throw Error("Illegal len: "+len);
        while (off < len) {
            c1 = b[off++] & 0xff;
            rs.push(BASE64_CODE[(c1 >> 2) & 0x3f]);
            c1 = (c1 & 0x03) << 4;
            if (off >= len) {
                rs.push(BASE64_CODE[c1 & 0x3f]);
                break;
            }
            c2 = b[off++] & 0xff;
            c1 |= (c2 >> 4) & 0x0f;
            rs.push(BASE64_CODE[c1 & 0x3f]);
            c1 = (c2 & 0x0f) << 2;
            if (off >= len) {
                rs.push(BASE64_CODE[c1 & 0x3f]);
                break;
            }
            c2 = b[off++] & 0xff;
            c1 |= (c2 >> 6) & 0x03;
            rs.push(BASE64_CODE[c1 & 0x3f]);
            rs.push(BASE64_CODE[c2 & 0x3f]);
        }
        return rs.join('');
    }

    /**
     * Decodes a base64 encoded string to up to len bytes of output.
     * @param {string} s String to decode
     * @param {number} len Maximum output length
     * @returns {!Array.<number>}
     * @inner
     */
    function base64_decode(s, len) {
        var off = 0,
            slen = s.length,
            olen = 0,
            rs = [],
            c1, c2, c3, c4, o, code;
        if (len <= 0)
            throw Error("Illegal len: "+len);
        while (off < slen - 1 && olen < len) {
            code = s.charCodeAt(off++);
            c1 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
            code = s.charCodeAt(off++);
            c2 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
            if (c1 == -1 || c2 == -1)
                break;
            o = (c1 << 2) >>> 0;
            o |= (c2 & 0x30) >> 4;
            rs.push(stringFromCharCode(o));
            if (++olen >= len || off >= slen)
                break;
            code = s.charCodeAt(off++);
            c3 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
            if (c3 == -1)
                break;
            o = ((c2 & 0x0f) << 4) >>> 0;
            o |= (c3 & 0x3c) >> 2;
            rs.push(stringFromCharCode(o));
            if (++olen >= len || off >= slen)
                break;
            code = s.charCodeAt(off++);
            c4 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
            o = ((c3 & 0x03) << 6) >>> 0;
            o |= c4;
            rs.push(stringFromCharCode(o));
            ++olen;
        }
        var res = [];
        for (off = 0; off<olen; off++)
            res.push(rs[off].charCodeAt(0));
        return res;
    }

    /**
     * utfx-embeddable (c) 2014 Daniel Wirtz <dcode@dcode.io>
     * Released under the Apache License, Version 2.0
     * see: https://github.com/dcodeIO/utfx for details
     */
    var utfx = function() {
        "use strict";

        /**
         * utfx namespace.
         * @inner
         * @type {!Object.<string,*>}
         */
        var utfx = {};

        /**
         * Maximum valid code point.
         * @type {number}
         * @const
         */
        utfx.MAX_CODEPOINT = 0x10FFFF;

        /**
         * Encodes UTF8 code points to UTF8 bytes.
         * @param {(!function():number|null) | number} src Code points source, either as a function returning the next code point
         *  respectively `null` if there are no more code points left or a single numeric code point.
         * @param {!function(number)} dst Bytes destination as a function successively called with the next byte
         */
        utfx.encodeUTF8 = function(src, dst) {
            var cp = null;
            if (typeof src === 'number')
                cp = src,
                src = function() { return null; };
            while (cp !== null || (cp = src()) !== null) {
                if (cp < 0x80)
                    dst(cp&0x7F);
                else if (cp < 0x800)
                    dst(((cp>>6)&0x1F)|0xC0),
                    dst((cp&0x3F)|0x80);
                else if (cp < 0x10000)
                    dst(((cp>>12)&0x0F)|0xE0),
                    dst(((cp>>6)&0x3F)|0x80),
                    dst((cp&0x3F)|0x80);
                else
                    dst(((cp>>18)&0x07)|0xF0),
                    dst(((cp>>12)&0x3F)|0x80),
                    dst(((cp>>6)&0x3F)|0x80),
                    dst((cp&0x3F)|0x80);
                cp = null;
            }
        };

        /**
         * Decodes UTF8 bytes to UTF8 code points.
         * @param {!function():number|null} src Bytes source as a function returning the next byte respectively `null` if there
         *  are no more bytes left.
         * @param {!function(number)} dst Code points destination as a function successively called with each decoded code point.
         * @throws {RangeError} If a starting byte is invalid in UTF8
         * @throws {Error} If the last sequence is truncated. Has an array property `bytes` holding the
         *  remaining bytes.
         */
        utfx.decodeUTF8 = function(src, dst) {
            var a, b, c, d, fail = function(b) {
                b = b.slice(0, b.indexOf(null));
                var err = Error(b.toString());
                err.name = "TruncatedError";
                err['bytes'] = b;
                throw err;
            };
            while ((a = src()) !== null) {
                if ((a&0x80) === 0)
                    dst(a);
                else if ((a&0xE0) === 0xC0)
                    ((b = src()) === null) && fail([a, b]),
                    dst(((a&0x1F)<<6) | (b&0x3F));
                else if ((a&0xF0) === 0xE0)
                    ((b=src()) === null || (c=src()) === null) && fail([a, b, c]),
                    dst(((a&0x0F)<<12) | ((b&0x3F)<<6) | (c&0x3F));
                else if ((a&0xF8) === 0xF0)
                    ((b=src()) === null || (c=src()) === null || (d=src()) === null) && fail([a, b, c ,d]),
                    dst(((a&0x07)<<18) | ((b&0x3F)<<12) | ((c&0x3F)<<6) | (d&0x3F));
                else throw RangeError("Illegal starting byte: "+a);
            }
        };

        /**
         * Converts UTF16 characters to UTF8 code points.
         * @param {!function():number|null} src Characters source as a function returning the next char code respectively
         *  `null` if there are no more characters left.
         * @param {!function(number)} dst Code points destination as a function successively called with each converted code
         *  point.
         */
        utfx.UTF16toUTF8 = function(src, dst) {
            var c1, c2 = null;
            while (true) {
                if ((c1 = c2 !== null ? c2 : src()) === null)
                    break;
                if (c1 >= 0xD800 && c1 <= 0xDFFF) {
                    if ((c2 = src()) !== null) {
                        if (c2 >= 0xDC00 && c2 <= 0xDFFF) {
                            dst((c1-0xD800)*0x400+c2-0xDC00+0x10000);
                            c2 = null; continue;
                        }
                    }
                }
                dst(c1);
            }
            if (c2 !== null) dst(c2);
        };

        /**
         * Converts UTF8 code points to UTF16 characters.
         * @param {(!function():number|null) | number} src Code points source, either as a function returning the next code point
         *  respectively `null` if there are no more code points left or a single numeric code point.
         * @param {!function(number)} dst Characters destination as a function successively called with each converted char code.
         * @throws {RangeError} If a code point is out of range
         */
        utfx.UTF8toUTF16 = function(src, dst) {
            var cp = null;
            if (typeof src === 'number')
                cp = src, src = function() { return null; };
            while (cp !== null || (cp = src()) !== null) {
                if (cp <= 0xFFFF)
                    dst(cp);
                else
                    cp -= 0x10000,
                    dst((cp>>10)+0xD800),
                    dst((cp%0x400)+0xDC00);
                cp = null;
            }
        };

        /**
         * Converts and encodes UTF16 characters to UTF8 bytes.
         * @param {!function():number|null} src Characters source as a function returning the next char code respectively `null`
         *  if there are no more characters left.
         * @param {!function(number)} dst Bytes destination as a function successively called with the next byte.
         */
        utfx.encodeUTF16toUTF8 = function(src, dst) {
            utfx.UTF16toUTF8(src, function(cp) {
                utfx.encodeUTF8(cp, dst);
            });
        };

        /**
         * Decodes and converts UTF8 bytes to UTF16 characters.
         * @param {!function():number|null} src Bytes source as a function returning the next byte respectively `null` if there
         *  are no more bytes left.
         * @param {!function(number)} dst Characters destination as a function successively called with each converted char code.
         * @throws {RangeError} If a starting byte is invalid in UTF8
         * @throws {Error} If the last sequence is truncated. Has an array property `bytes` holding the remaining bytes.
         */
        utfx.decodeUTF8toUTF16 = function(src, dst) {
            utfx.decodeUTF8(src, function(cp) {
                utfx.UTF8toUTF16(cp, dst);
            });
        };

        /**
         * Calculates the byte length of an UTF8 code point.
         * @param {number} cp UTF8 code point
         * @returns {number} Byte length
         */
        utfx.calculateCodePoint = function(cp) {
            return (cp < 0x80) ? 1 : (cp < 0x800) ? 2 : (cp < 0x10000) ? 3 : 4;
        };

        /**
         * Calculates the number of UTF8 bytes required to store UTF8 code points.
         * @param {(!function():number|null)} src Code points source as a function returning the next code point respectively
         *  `null` if there are no more code points left.
         * @returns {number} The number of UTF8 bytes required
         */
        utfx.calculateUTF8 = function(src) {
            var cp, l=0;
            while ((cp = src()) !== null)
                l += utfx.calculateCodePoint(cp);
            return l;
        };

        /**
         * Calculates the number of UTF8 code points respectively UTF8 bytes required to store UTF16 char codes.
         * @param {(!function():number|null)} src Characters source as a function returning the next char code respectively
         *  `null` if there are no more characters left.
         * @returns {!Array.<number>} The number of UTF8 code points at index 0 and the number of UTF8 bytes required at index 1.
         */
        utfx.calculateUTF16asUTF8 = function(src) {
            var n=0, l=0;
            utfx.UTF16toUTF8(src, function(cp) {
                ++n; l += utfx.calculateCodePoint(cp);
            });
            return [n,l];
        };

        return utfx;
    }();

    Date.now = Date.now || function() { return +new Date; };

    /**
     * @type {number}
     * @const
     * @inner
     */
    var BCRYPT_SALT_LEN = 16;

    /**
     * @type {number}
     * @const
     * @inner
     */
    var GENSALT_DEFAULT_LOG2_ROUNDS = 10;

    /**
     * @type {number}
     * @const
     * @inner
     */
    var BLOWFISH_NUM_ROUNDS = 16;

    /**
     * @type {number}
     * @const
     * @inner
     */
    var MAX_EXECUTION_TIME = 100;

    /**
     * @type {Array.<number>}
     * @const
     * @inner
     */
    var P_ORIG = [
        0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344, 0xa4093822,
        0x299f31d0, 0x082efa98, 0xec4e6c89, 0x452821e6, 0x38d01377,
        0xbe5466cf, 0x34e90c6c, 0xc0ac29b7, 0xc97c50dd, 0x3f84d5b5,
        0xb5470917, 0x9216d5d9, 0x8979fb1b
    ];

    /**
     * @type {Array.<number>}
     * @const
     * @inner
     */
    var S_ORIG = [
        0xd1310ba6, 0x98dfb5ac, 0x2ffd72db, 0xd01adfb7, 0xb8e1afed,
        0x6a267e96, 0xba7c9045, 0xf12c7f99, 0x24a19947, 0xb3916cf7,
        0x0801f2e2, 0x858efc16, 0x636920d8, 0x71574e69, 0xa458fea3,
        0xf4933d7e, 0x0d95748f, 0x728eb658, 0x718bcd58, 0x82154aee,
        0x7b54a41d, 0xc25a59b5, 0x9c30d539, 0x2af26013, 0xc5d1b023,
        0x286085f0, 0xca417918, 0xb8db38ef, 0x8e79dcb0, 0x603a180e,
        0x6c9e0e8b, 0xb01e8a3e, 0xd71577c1, 0xbd314b27, 0x78af2fda,
        0x55605c60, 0xe65525f3, 0xaa55ab94, 0x57489862, 0x63e81440,
        0x55ca396a, 0x2aab10b6, 0xb4cc5c34, 0x1141e8ce, 0xa15486af,
        0x7c72e993, 0xb3ee1411, 0x636fbc2a, 0x2ba9c55d, 0x741831f6,
        0xce5c3e16, 0x9b87931e, 0xafd6ba33, 0x6c24cf5c, 0x7a325381,
        0x28958677, 0x3b8f4898, 0x6b4bb9af, 0xc4bfe81b, 0x66282193,
        0x61d809cc, 0xfb21a991, 0x487cac60, 0x5dec8032, 0xef845d5d,
        0xe98575b1, 0xdc262302, 0xeb651b88, 0x23893e81, 0xd396acc5,
        0x0f6d6ff3, 0x83f44239, 0x2e0b4482, 0xa4842004, 0x69c8f04a,
        0x9e1f9b5e, 0x21c66842, 0xf6e96c9a, 0x670c9c61, 0xabd388f0,
        0x6a51a0d2, 0xd8542f68, 0x960fa728, 0xab5133a3, 0x6eef0b6c,
        0x137a3be4, 0xba3bf050, 0x7efb2a98, 0xa1f1651d, 0x39af0176,
        0x66ca593e, 0x82430e88, 0x8cee8619, 0x456f9fb4, 0x7d84a5c3,
        0x3b8b5ebe, 0xe06f75d8, 0x85c12073, 0x401a449f, 0x56c16aa6,
        0x4ed3aa62, 0x363f7706, 0x1bfedf72, 0x429b023d, 0x37d0d724,
        0xd00a1248, 0xdb0fead3, 0x49f1c09b, 0x075372c9, 0x80991b7b,
        0x25d479d8, 0xf6e8def7, 0xe3fe501a, 0xb6794c3b, 0x976ce0bd,
        0x04c006ba, 0xc1a94fb6, 0x409f60c4, 0x5e5c9ec2, 0x196a2463,
        0x68fb6faf, 0x3e6c53b5, 0x1339b2eb, 0x3b52ec6f, 0x6dfc511f,
        0x9b30952c, 0xcc814544, 0xaf5ebd09, 0xbee3d004, 0xde334afd,
        0x660f2807, 0x192e4bb3, 0xc0cba857, 0x45c8740f, 0xd20b5f39,
        0xb9d3fbdb, 0x5579c0bd, 0x1a60320a, 0xd6a100c6, 0x402c7279,
        0x679f25fe, 0xfb1fa3cc, 0x8ea5e9f8, 0xdb3222f8, 0x3c7516df,
        0xfd616b15, 0x2f501ec8, 0xad0552ab, 0x323db5fa, 0xfd238760,
        0x53317b48, 0x3e00df82, 0x9e5c57bb, 0xca6f8ca0, 0x1a87562e,
        0xdf1769db, 0xd542a8f6, 0x287effc3, 0xac6732c6, 0x8c4f5573,
        0x695b27b0, 0xbbca58c8, 0xe1ffa35d, 0xb8f011a0, 0x10fa3d98,
        0xfd2183b8, 0x4afcb56c, 0x2dd1d35b, 0x9a53e479, 0xb6f84565,
        0xd28e49bc, 0x4bfb9790, 0xe1ddf2da, 0xa4cb7e33, 0x62fb1341,
        0xcee4c6e8, 0xef20cada, 0x36774c01, 0xd07e9efe, 0x2bf11fb4,
        0x95dbda4d, 0xae909198, 0xeaad8e71, 0x6b93d5a0, 0xd08ed1d0,
        0xafc725e0, 0x8e3c5b2f, 0x8e7594b7, 0x8ff6e2fb, 0xf2122b64,
        0x8888b812, 0x900df01c, 0x4fad5ea0, 0x688fc31c, 0xd1cff191,
        0xb3a8c1ad, 0x2f2f2218, 0xbe0e1777, 0xea752dfe, 0x8b021fa1,
        0xe5a0cc0f, 0xb56f74e8, 0x18acf3d6, 0xce89e299, 0xb4a84fe0,
        0xfd13e0b7, 0x7cc43b81, 0xd2ada8d9, 0x165fa266, 0x80957705,
        0x93cc7314, 0x211a1477, 0xe6ad2065, 0x77b5fa86, 0xc75442f5,
        0xfb9d35cf, 0xebcdaf0c, 0x7b3e89a0, 0xd6411bd3, 0xae1e7e49,
        0x00250e2d, 0x2071b35e, 0x226800bb, 0x57b8e0af, 0x2464369b,
        0xf009b91e, 0x5563911d, 0x59dfa6aa, 0x78c14389, 0xd95a537f,
        0x207d5ba2, 0x02e5b9c5, 0x83260376, 0x6295cfa9, 0x11c81968,
        0x4e734a41, 0xb3472dca, 0x7b14a94a, 0x1b510052, 0x9a532915,
        0xd60f573f, 0xbc9bc6e4, 0x2b60a476, 0x81e67400, 0x08ba6fb5,
        0x571be91f, 0xf296ec6b, 0x2a0dd915, 0xb6636521, 0xe7b9f9b6,
        0xff34052e, 0xc5855664, 0x53b02d5d, 0xa99f8fa1, 0x08ba4799,
        0x6e85076a, 0x4b7a70e9, 0xb5b32944, 0xdb75092e, 0xc4192623,
        0xad6ea6b0, 0x49a7df7d, 0x9cee60b8, 0x8fedb266, 0xecaa8c71,
        0x699a17ff, 0x5664526c, 0xc2b19ee1, 0x193602a5, 0x75094c29,
        0xa0591340, 0xe4183a3e, 0x3f54989a, 0x5b429d65, 0x6b8fe4d6,
        0x99f73fd6, 0xa1d29c07, 0xefe830f5, 0x4d2d38e6, 0xf0255dc1,
        0x4cdd2086, 0x8470eb26, 0x6382e9c6, 0x021ecc5e, 0x09686b3f,
        0x3ebaefc9, 0x3c971814, 0x6b6a70a1, 0x687f3584, 0x52a0e286,
        0xb79c5305, 0xaa500737, 0x3e07841c, 0x7fdeae5c, 0x8e7d44ec,
        0x5716f2b8, 0xb03ada37, 0xf0500c0d, 0xf01c1f04, 0x0200b3ff,
        0xae0cf51a, 0x3cb574b2, 0x25837a58, 0xdc0921bd, 0xd19113f9,
        0x7ca92ff6, 0x94324773, 0x22f54701, 0x3ae5e581, 0x37c2dadc,
        0xc8b57634, 0x9af3dda7, 0xa9446146, 0x0fd0030e, 0xecc8c73e,
        0xa4751e41, 0xe238cd99, 0x3bea0e2f, 0x3280bba1, 0x183eb331,
        0x4e548b38, 0x4f6db908, 0x6f420d03, 0xf60a04bf, 0x2cb81290,
        0x24977c79, 0x5679b072, 0xbcaf89af, 0xde9a771f, 0xd9930810,
        0xb38bae12, 0xdccf3f2e, 0x5512721f, 0x2e6b7124, 0x501adde6,
        0x9f84cd87, 0x7a584718, 0x7408da17, 0xbc9f9abc, 0xe94b7d8c,
        0xec7aec3a, 0xdb851dfa, 0x63094366, 0xc464c3d2, 0xef1c1847,
        0x3215d908, 0xdd433b37, 0x24c2ba16, 0x12a14d43, 0x2a65c451,
        0x50940002, 0x133ae4dd, 0x71dff89e, 0x10314e55, 0x81ac77d6,
        0x5f11199b, 0x043556f1, 0xd7a3c76b, 0x3c11183b, 0x5924a509,
        0xf28fe6ed, 0x97f1fbfa, 0x9ebabf2c, 0x1e153c6e, 0x86e34570,
        0xeae96fb1, 0x860e5e0a, 0x5a3e2ab3, 0x771fe71c, 0x4e3d06fa,
        0x2965dcb9, 0x99e71d0f, 0x803e89d6, 0x5266c825, 0x2e4cc978,
        0x9c10b36a, 0xc6150eba, 0x94e2ea78, 0xa5fc3c53, 0x1e0a2df4,
        0xf2f74ea7, 0x361d2b3d, 0x1939260f, 0x19c27960, 0x5223a708,
        0xf71312b6, 0xebadfe6e, 0xeac31f66, 0xe3bc4595, 0xa67bc883,
        0xb17f37d1, 0x018cff28, 0xc332ddef, 0xbe6c5aa5, 0x65582185,
        0x68ab9802, 0xeecea50f, 0xdb2f953b, 0x2aef7dad, 0x5b6e2f84,
        0x1521b628, 0x29076170, 0xecdd4775, 0x619f1510, 0x13cca830,
        0xeb61bd96, 0x0334fe1e, 0xaa0363cf, 0xb5735c90, 0x4c70a239,
        0xd59e9e0b, 0xcbaade14, 0xeecc86bc, 0x60622ca7, 0x9cab5cab,
        0xb2f3846e, 0x648b1eaf, 0x19bdf0ca, 0xa02369b9, 0x655abb50,
        0x40685a32, 0x3c2ab4b3, 0x319ee9d5, 0xc021b8f7, 0x9b540b19,
        0x875fa099, 0x95f7997e, 0x623d7da8, 0xf837889a, 0x97e32d77,
        0x11ed935f, 0x16681281, 0x0e358829, 0xc7e61fd6, 0x96dedfa1,
        0x7858ba99, 0x57f584a5, 0x1b227263, 0x9b83c3ff, 0x1ac24696,
        0xcdb30aeb, 0x532e3054, 0x8fd948e4, 0x6dbc3128, 0x58ebf2ef,
        0x34c6ffea, 0xfe28ed61, 0xee7c3c73, 0x5d4a14d9, 0xe864b7e3,
        0x42105d14, 0x203e13e0, 0x45eee2b6, 0xa3aaabea, 0xdb6c4f15,
        0xfacb4fd0, 0xc742f442, 0xef6abbb5, 0x654f3b1d, 0x41cd2105,
        0xd81e799e, 0x86854dc7, 0xe44b476a, 0x3d816250, 0xcf62a1f2,
        0x5b8d2646, 0xfc8883a0, 0xc1c7b6a3, 0x7f1524c3, 0x69cb7492,
        0x47848a0b, 0x5692b285, 0x095bbf00, 0xad19489d, 0x1462b174,
        0x23820e00, 0x58428d2a, 0x0c55f5ea, 0x1dadf43e, 0x233f7061,
        0x3372f092, 0x8d937e41, 0xd65fecf1, 0x6c223bdb, 0x7cde3759,
        0xcbee7460, 0x4085f2a7, 0xce77326e, 0xa6078084, 0x19f8509e,
        0xe8efd855, 0x61d99735, 0xa969a7aa, 0xc50c06c2, 0x5a04abfc,
        0x800bcadc, 0x9e447a2e, 0xc3453484, 0xfdd56705, 0x0e1e9ec9,
        0xdb73dbd3, 0x105588cd, 0x675fda79, 0xe3674340, 0xc5c43465,
        0x713e38d8, 0x3d28f89e, 0xf16dff20, 0x153e21e7, 0x8fb03d4a,
        0xe6e39f2b, 0xdb83adf7, 0xe93d5a68, 0x948140f7, 0xf64c261c,
        0x94692934, 0x411520f7, 0x7602d4f7, 0xbcf46b2e, 0xd4a20068,
        0xd4082471, 0x3320f46a, 0x43b7d4b7, 0x500061af, 0x1e39f62e,
        0x97244546, 0x14214f74, 0xbf8b8840, 0x4d95fc1d, 0x96b591af,
        0x70f4ddd3, 0x66a02f45, 0xbfbc09ec, 0x03bd9785, 0x7fac6dd0,
        0x31cb8504, 0x96eb27b3, 0x55fd3941, 0xda2547e6, 0xabca0a9a,
        0x28507825, 0x530429f4, 0x0a2c86da, 0xe9b66dfb, 0x68dc1462,
        0xd7486900, 0x680ec0a4, 0x27a18dee, 0x4f3ffea2, 0xe887ad8c,
        0xb58ce006, 0x7af4d6b6, 0xaace1e7c, 0xd3375fec, 0xce78a399,
        0x406b2a42, 0x20fe9e35, 0xd9f385b9, 0xee39d7ab, 0x3b124e8b,
        0x1dc9faf7, 0x4b6d1856, 0x26a36631, 0xeae397b2, 0x3a6efa74,
        0xdd5b4332, 0x6841e7f7, 0xca7820fb, 0xfb0af54e, 0xd8feb397,
        0x454056ac, 0xba489527, 0x55533a3a, 0x20838d87, 0xfe6ba9b7,
        0xd096954b, 0x55a867bc, 0xa1159a58, 0xcca92963, 0x99e1db33,
        0xa62a4a56, 0x3f3125f9, 0x5ef47e1c, 0x9029317c, 0xfdf8e802,
        0x04272f70, 0x80bb155c, 0x05282ce3, 0x95c11548, 0xe4c66d22,
        0x48c1133f, 0xc70f86dc, 0x07f9c9ee, 0x41041f0f, 0x404779a4,
        0x5d886e17, 0x325f51eb, 0xd59bc0d1, 0xf2bcc18f, 0x41113564,
        0x257b7834, 0x602a9c60, 0xdff8e8a3, 0x1f636c1b, 0x0e12b4c2,
        0x02e1329e, 0xaf664fd1, 0xcad18115, 0x6b2395e0, 0x333e92e1,
        0x3b240b62, 0xeebeb922, 0x85b2a20e, 0xe6ba0d99, 0xde720c8c,
        0x2da2f728, 0xd0127845, 0x95b794fd, 0x647d0862, 0xe7ccf5f0,
        0x5449a36f, 0x877d48fa, 0xc39dfd27, 0xf33e8d1e, 0x0a476341,
        0x992eff74, 0x3a6f6eab, 0xf4f8fd37, 0xa812dc60, 0xa1ebddf8,
        0x991be14c, 0xdb6e6b0d, 0xc67b5510, 0x6d672c37, 0x2765d43b,
        0xdcd0e804, 0xf1290dc7, 0xcc00ffa3, 0xb5390f92, 0x690fed0b,
        0x667b9ffb, 0xcedb7d9c, 0xa091cf0b, 0xd9155ea3, 0xbb132f88,
        0x515bad24, 0x7b9479bf, 0x763bd6eb, 0x37392eb3, 0xcc115979,
        0x8026e297, 0xf42e312d, 0x6842ada7, 0xc66a2b3b, 0x12754ccc,
        0x782ef11c, 0x6a124237, 0xb79251e7, 0x06a1bbe6, 0x4bfb6350,
        0x1a6b1018, 0x11caedfa, 0x3d25bdd8, 0xe2e1c3c9, 0x44421659,
        0x0a121386, 0xd90cec6e, 0xd5abea2a, 0x64af674e, 0xda86a85f,
        0xbebfe988, 0x64e4c3fe, 0x9dbc8057, 0xf0f7c086, 0x60787bf8,
        0x6003604d, 0xd1fd8346, 0xf6381fb0, 0x7745ae04, 0xd736fccc,
        0x83426b33, 0xf01eab71, 0xb0804187, 0x3c005e5f, 0x77a057be,
        0xbde8ae24, 0x55464299, 0xbf582e61, 0x4e58f48f, 0xf2ddfda2,
        0xf474ef38, 0x8789bdc2, 0x5366f9c3, 0xc8b38e74, 0xb475f255,
        0x46fcd9b9, 0x7aeb2661, 0x8b1ddf84, 0x846a0e79, 0x915f95e2,
        0x466e598e, 0x20b45770, 0x8cd55591, 0xc902de4c, 0xb90bace1,
        0xbb8205d0, 0x11a86248, 0x7574a99e, 0xb77f19b6, 0xe0a9dc09,
        0x662d09a1, 0xc4324633, 0xe85a1f02, 0x09f0be8c, 0x4a99a025,
        0x1d6efe10, 0x1ab93d1d, 0x0ba5a4df, 0xa186f20f, 0x2868f169,
        0xdcb7da83, 0x573906fe, 0xa1e2ce9b, 0x4fcd7f52, 0x50115e01,
        0xa70683fa, 0xa002b5c4, 0x0de6d027, 0x9af88c27, 0x773f8641,
        0xc3604c06, 0x61a806b5, 0xf0177a28, 0xc0f586e0, 0x006058aa,
        0x30dc7d62, 0x11e69ed7, 0x2338ea63, 0x53c2dd94, 0xc2c21634,
        0xbbcbee56, 0x90bcb6de, 0xebfc7da1, 0xce591d76, 0x6f05e409,
        0x4b7c0188, 0x39720a3d, 0x7c927c24, 0x86e3725f, 0x724d9db9,
        0x1ac15bb4, 0xd39eb8fc, 0xed545578, 0x08fca5b5, 0xd83d7cd3,
        0x4dad0fc4, 0x1e50ef5e, 0xb161e6f8, 0xa28514d9, 0x6c51133c,
        0x6fd5c7e7, 0x56e14ec4, 0x362abfce, 0xddc6c837, 0xd79a3234,
        0x92638212, 0x670efa8e, 0x406000e0, 0x3a39ce37, 0xd3faf5cf,
        0xabc27737, 0x5ac52d1b, 0x5cb0679e, 0x4fa33742, 0xd3822740,
        0x99bc9bbe, 0xd5118e9d, 0xbf0f7315, 0xd62d1c7e, 0xc700c47b,
        0xb78c1b6b, 0x21a19045, 0xb26eb1be, 0x6a366eb4, 0x5748ab2f,
        0xbc946e79, 0xc6a376d2, 0x6549c2c8, 0x530ff8ee, 0x468dde7d,
        0xd5730a1d, 0x4cd04dc6, 0x2939bbdb, 0xa9ba4650, 0xac9526e8,
        0xbe5ee304, 0xa1fad5f0, 0x6a2d519a, 0x63ef8ce2, 0x9a86ee22,
        0xc089c2b8, 0x43242ef6, 0xa51e03aa, 0x9cf2d0a4, 0x83c061ba,
        0x9be96a4d, 0x8fe51550, 0xba645bd6, 0x2826a2f9, 0xa73a3ae1,
        0x4ba99586, 0xef5562e9, 0xc72fefd3, 0xf752f7da, 0x3f046f69,
        0x77fa0a59, 0x80e4a915, 0x87b08601, 0x9b09e6ad, 0x3b3ee593,
        0xe990fd5a, 0x9e34d797, 0x2cf0b7d9, 0x022b8b51, 0x96d5ac3a,
        0x017da67d, 0xd1cf3ed6, 0x7c7d2d28, 0x1f9f25cf, 0xadf2b89b,
        0x5ad6b472, 0x5a88f54c, 0xe029ac71, 0xe019a5e6, 0x47b0acfd,
        0xed93fa9b, 0xe8d3c48d, 0x283b57cc, 0xf8d56629, 0x79132e28,
        0x785f0191, 0xed756055, 0xf7960e44, 0xe3d35e8c, 0x15056dd4,
        0x88f46dba, 0x03a16125, 0x0564f0bd, 0xc3eb9e15, 0x3c9057a2,
        0x97271aec, 0xa93a072a, 0x1b3f6d9b, 0x1e6321f5, 0xf59c66fb,
        0x26dcf319, 0x7533d928, 0xb155fdf5, 0x03563482, 0x8aba3cbb,
        0x28517711, 0xc20ad9f8, 0xabcc5167, 0xccad925f, 0x4de81751,
        0x3830dc8e, 0x379d5862, 0x9320f991, 0xea7a90c2, 0xfb3e7bce,
        0x5121ce64, 0x774fbe32, 0xa8b6e37e, 0xc3293d46, 0x48de5369,
        0x6413e680, 0xa2ae0810, 0xdd6db224, 0x69852dfd, 0x09072166,
        0xb39a460a, 0x6445c0dd, 0x586cdecf, 0x1c20c8ae, 0x5bbef7dd,
        0x1b588d40, 0xccd2017f, 0x6bb4e3bb, 0xdda26a7e, 0x3a59ff45,
        0x3e350a44, 0xbcb4cdd5, 0x72eacea8, 0xfa6484bb, 0x8d6612ae,
        0xbf3c6f47, 0xd29be463, 0x542f5d9e, 0xaec2771b, 0xf64e6370,
        0x740e0d8d, 0xe75b1357, 0xf8721671, 0xaf537d5d, 0x4040cb08,
        0x4eb4e2cc, 0x34d2466a, 0x0115af84, 0xe1b00428, 0x95983a1d,
        0x06b89fb4, 0xce6ea048, 0x6f3f3b82, 0x3520ab82, 0x011a1d4b,
        0x277227f8, 0x611560b1, 0xe7933fdc, 0xbb3a792b, 0x344525bd,
        0xa08839e1, 0x51ce794b, 0x2f32c9b7, 0xa01fbac9, 0xe01cc87e,
        0xbcc7d1f6, 0xcf0111c3, 0xa1e8aac7, 0x1a908749, 0xd44fbd9a,
        0xd0dadecb, 0xd50ada38, 0x0339c32a, 0xc6913667, 0x8df9317c,
        0xe0b12b4f, 0xf79e59b7, 0x43f5bb3a, 0xf2d519ff, 0x27d9459c,
        0xbf97222c, 0x15e6fc2a, 0x0f91fc71, 0x9b941525, 0xfae59361,
        0xceb69ceb, 0xc2a86459, 0x12baa8d1, 0xb6c1075e, 0xe3056a0c,
        0x10d25065, 0xcb03a442, 0xe0ec6e0e, 0x1698db3b, 0x4c98a0be,
        0x3278e964, 0x9f1f9532, 0xe0d392df, 0xd3a0342b, 0x8971f21e,
        0x1b0a7441, 0x4ba3348c, 0xc5be7120, 0xc37632d8, 0xdf359f8d,
        0x9b992f2e, 0xe60b6f47, 0x0fe3f11d, 0xe54cda54, 0x1edad891,
        0xce6279cf, 0xcd3e7e6f, 0x1618b166, 0xfd2c1d05, 0x848fd2c5,
        0xf6fb2299, 0xf523f357, 0xa6327623, 0x93a83531, 0x56cccd02,
        0xacf08162, 0x5a75ebb5, 0x6e163697, 0x88d273cc, 0xde966292,
        0x81b949d0, 0x4c50901b, 0x71c65614, 0xe6c6c7bd, 0x327a140a,
        0x45e1d006, 0xc3f27b9a, 0xc9aa53fd, 0x62a80f00, 0xbb25bfe2,
        0x35bdd2f6, 0x71126905, 0xb2040222, 0xb6cbcf7c, 0xcd769c2b,
        0x53113ec0, 0x1640e3d3, 0x38abbd60, 0x2547adf0, 0xba38209c,
        0xf746ce76, 0x77afa1c5, 0x20756060, 0x85cbfe4e, 0x8ae88dd8,
        0x7aaaf9b0, 0x4cf9aa7e, 0x1948c25c, 0x02fb8a8c, 0x01c36ae4,
        0xd6ebe1f9, 0x90d4f869, 0xa65cdea0, 0x3f09252d, 0xc208e69f,
        0xb74e6132, 0xce77e25b, 0x578fdfe3, 0x3ac372e6
    ];

    /**
     * @type {Array.<number>}
     * @const
     * @inner
     */
    var C_ORIG = [
        0x4f727068, 0x65616e42, 0x65686f6c, 0x64657253, 0x63727944,
        0x6f756274
    ];

    /**
     * @param {Array.<number>} lr
     * @param {number} off
     * @param {Array.<number>} P
     * @param {Array.<number>} S
     * @returns {Array.<number>}
     * @inner
     */
    function _encipher(lr, off, P, S) { // This is our bottleneck: 1714/1905 ticks / 90% - see profile.txt
        var n,
            l = lr[off],
            r = lr[off + 1];

        l ^= P[0];

        /*
        for (var i=0, k=BLOWFISH_NUM_ROUNDS-2; i<=k;)
            // Feistel substitution on left word
            n  = S[l >>> 24],
            n += S[0x100 | ((l >> 16) & 0xff)],
            n ^= S[0x200 | ((l >> 8) & 0xff)],
            n += S[0x300 | (l & 0xff)],
            r ^= n ^ P[++i],
            // Feistel substitution on right word
            n  = S[r >>> 24],
            n += S[0x100 | ((r >> 16) & 0xff)],
            n ^= S[0x200 | ((r >> 8) & 0xff)],
            n += S[0x300 | (r & 0xff)],
            l ^= n ^ P[++i];
        */

        //The following is an unrolled version of the above loop.
        //Iteration 0
        n  = S[l >>> 24];
        n += S[0x100 | ((l >> 16) & 0xff)];
        n ^= S[0x200 | ((l >> 8) & 0xff)];
        n += S[0x300 | (l & 0xff)];
        r ^= n ^ P[1];
        n  = S[r >>> 24];
        n += S[0x100 | ((r >> 16) & 0xff)];
        n ^= S[0x200 | ((r >> 8) & 0xff)];
        n += S[0x300 | (r & 0xff)];
        l ^= n ^ P[2];
        //Iteration 1
        n  = S[l >>> 24];
        n += S[0x100 | ((l >> 16) & 0xff)];
        n ^= S[0x200 | ((l >> 8) & 0xff)];
        n += S[0x300 | (l & 0xff)];
        r ^= n ^ P[3];
        n  = S[r >>> 24];
        n += S[0x100 | ((r >> 16) & 0xff)];
        n ^= S[0x200 | ((r >> 8) & 0xff)];
        n += S[0x300 | (r & 0xff)];
        l ^= n ^ P[4];
        //Iteration 2
        n  = S[l >>> 24];
        n += S[0x100 | ((l >> 16) & 0xff)];
        n ^= S[0x200 | ((l >> 8) & 0xff)];
        n += S[0x300 | (l & 0xff)];
        r ^= n ^ P[5];
        n  = S[r >>> 24];
        n += S[0x100 | ((r >> 16) & 0xff)];
        n ^= S[0x200 | ((r >> 8) & 0xff)];
        n += S[0x300 | (r & 0xff)];
        l ^= n ^ P[6];
        //Iteration 3
        n  = S[l >>> 24];
        n += S[0x100 | ((l >> 16) & 0xff)];
        n ^= S[0x200 | ((l >> 8) & 0xff)];
        n += S[0x300 | (l & 0xff)];
        r ^= n ^ P[7];
        n  = S[r >>> 24];
        n += S[0x100 | ((r >> 16) & 0xff)];
        n ^= S[0x200 | ((r >> 8) & 0xff)];
        n += S[0x300 | (r & 0xff)];
        l ^= n ^ P[8];
        //Iteration 4
        n  = S[l >>> 24];
        n += S[0x100 | ((l >> 16) & 0xff)];
        n ^= S[0x200 | ((l >> 8) & 0xff)];
        n += S[0x300 | (l & 0xff)];
        r ^= n ^ P[9];
        n  = S[r >>> 24];
        n += S[0x100 | ((r >> 16) & 0xff)];
        n ^= S[0x200 | ((r >> 8) & 0xff)];
        n += S[0x300 | (r & 0xff)];
        l ^= n ^ P[10];
        //Iteration 5
        n  = S[l >>> 24];
        n += S[0x100 | ((l >> 16) & 0xff)];
        n ^= S[0x200 | ((l >> 8) & 0xff)];
        n += S[0x300 | (l & 0xff)];
        r ^= n ^ P[11];
        n  = S[r >>> 24];
        n += S[0x100 | ((r >> 16) & 0xff)];
        n ^= S[0x200 | ((r >> 8) & 0xff)];
        n += S[0x300 | (r & 0xff)];
        l ^= n ^ P[12];
        //Iteration 6
        n  = S[l >>> 24];
        n += S[0x100 | ((l >> 16) & 0xff)];
        n ^= S[0x200 | ((l >> 8) & 0xff)];
        n += S[0x300 | (l & 0xff)];
        r ^= n ^ P[13];
        n  = S[r >>> 24];
        n += S[0x100 | ((r >> 16) & 0xff)];
        n ^= S[0x200 | ((r >> 8) & 0xff)];
        n += S[0x300 | (r & 0xff)];
        l ^= n ^ P[14];
        //Iteration 7
        n  = S[l >>> 24];
        n += S[0x100 | ((l >> 16) & 0xff)];
        n ^= S[0x200 | ((l >> 8) & 0xff)];
        n += S[0x300 | (l & 0xff)];
        r ^= n ^ P[15];
        n  = S[r >>> 24];
        n += S[0x100 | ((r >> 16) & 0xff)];
        n ^= S[0x200 | ((r >> 8) & 0xff)];
        n += S[0x300 | (r & 0xff)];
        l ^= n ^ P[16];

        lr[off] = r ^ P[BLOWFISH_NUM_ROUNDS + 1];
        lr[off + 1] = l;
        return lr;
    }

    /**
     * @param {Array.<number>} data
     * @param {number} offp
     * @returns {{key: number, offp: number}}
     * @inner
     */
    function _streamtoword(data, offp) {
        for (var i = 0, word = 0; i < 4; ++i)
            word = (word << 8) | (data[offp] & 0xff),
            offp = (offp + 1) % data.length;
        return { key: word, offp: offp };
    }

    /**
     * @param {Array.<number>} key
     * @param {Array.<number>} P
     * @param {Array.<number>} S
     * @inner
     */
    function _key(key, P, S) {
        var offset = 0,
            lr = [0, 0],
            plen = P.length,
            slen = S.length,
            sw;
        for (var i = 0; i < plen; i++)
            sw = _streamtoword(key, offset),
            offset = sw.offp,
            P[i] = P[i] ^ sw.key;
        for (i = 0; i < plen; i += 2)
            lr = _encipher(lr, 0, P, S),
            P[i] = lr[0],
            P[i + 1] = lr[1];
        for (i = 0; i < slen; i += 2)
            lr = _encipher(lr, 0, P, S),
            S[i] = lr[0],
            S[i + 1] = lr[1];
    }

    /**
     * Expensive key schedule Blowfish.
     * @param {Array.<number>} data
     * @param {Array.<number>} key
     * @param {Array.<number>} P
     * @param {Array.<number>} S
     * @inner
     */
    function _ekskey(data, key, P, S) {
        var offp = 0,
            lr = [0, 0],
            plen = P.length,
            slen = S.length,
            sw;
        for (var i = 0; i < plen; i++)
            sw = _streamtoword(key, offp),
            offp = sw.offp,
            P[i] = P[i] ^ sw.key;
        offp = 0;
        for (i = 0; i < plen; i += 2)
            sw = _streamtoword(data, offp),
            offp = sw.offp,
            lr[0] ^= sw.key,
            sw = _streamtoword(data, offp),
            offp = sw.offp,
            lr[1] ^= sw.key,
            lr = _encipher(lr, 0, P, S),
            P[i] = lr[0],
            P[i + 1] = lr[1];
        for (i = 0; i < slen; i += 2)
            sw = _streamtoword(data, offp),
            offp = sw.offp,
            lr[0] ^= sw.key,
            sw = _streamtoword(data, offp),
            offp = sw.offp,
            lr[1] ^= sw.key,
            lr = _encipher(lr, 0, P, S),
            S[i] = lr[0],
            S[i + 1] = lr[1];
    }

    /**
     * Internaly crypts a string.
     * @param {Array.<number>} b Bytes to crypt
     * @param {Array.<number>} salt Salt bytes to use
     * @param {number} rounds Number of rounds
     * @param {function(Error, Array.<number>=)=} callback Callback receiving the error, if any, and the resulting bytes. If
     *  omitted, the operation will be performed synchronously.
     *  @param {function(number)=} progressCallback Callback called with the current progress
     * @returns {!Array.<number>|undefined} Resulting bytes if callback has been omitted, otherwise `undefined`
     * @inner
     */
    function _crypt(b, salt, rounds, callback, progressCallback) {
        var cdata = C_ORIG.slice(),
            clen = cdata.length,
            err;

        // Validate
        if (rounds < 4 || rounds > 31) {
            err = Error("Illegal number of rounds (4-31): "+rounds);
            if (callback) {
                nextTick(callback.bind(this, err));
                return;
            } else
                throw err;
        }
        if (salt.length !== BCRYPT_SALT_LEN) {
            err =Error("Illegal salt length: "+salt.length+" != "+BCRYPT_SALT_LEN);
            if (callback) {
                nextTick(callback.bind(this, err));
                return;
            } else
                throw err;
        }
        rounds = (1 << rounds) >>> 0;

        var P, S, i = 0, j;

        //Use typed arrays when available - huge speedup!
        if (Int32Array) {
            P = new Int32Array(P_ORIG);
            S = new Int32Array(S_ORIG);
        } else {
            P = P_ORIG.slice();
            S = S_ORIG.slice();
        }

        _ekskey(salt, b, P, S);

        /**
         * Calcualtes the next round.
         * @returns {Array.<number>|undefined} Resulting array if callback has been omitted, otherwise `undefined`
         * @inner
         */
        function next() {
            if (progressCallback)
                progressCallback(i / rounds);
            if (i < rounds) {
                var start = Date.now();
                for (; i < rounds;) {
                    i = i + 1;
                    _key(b, P, S);
                    _key(salt, P, S);
                    if (Date.now() - start > MAX_EXECUTION_TIME)
                        break;
                }
            } else {
                for (i = 0; i < 64; i++)
                    for (j = 0; j < (clen >> 1); j++)
                        _encipher(cdata, j << 1, P, S);
                var ret = [];
                for (i = 0; i < clen; i++)
                    ret.push(((cdata[i] >> 24) & 0xff) >>> 0),
                    ret.push(((cdata[i] >> 16) & 0xff) >>> 0),
                    ret.push(((cdata[i] >> 8) & 0xff) >>> 0),
                    ret.push((cdata[i] & 0xff) >>> 0);
                if (callback) {
                    callback(null, ret);
                    return;
                } else
                    return ret;
            }
            if (callback)
                nextTick(next);
        }

        // Async
        if (typeof callback !== 'undefined') {
            next();

            // Sync
        } else {
            var res;
            while (true)
                if (typeof(res = next()) !== 'undefined')
                    return res || [];
        }
    }

    /**
     * Internally hashes a string.
     * @param {string} s String to hash
     * @param {?string} salt Salt to use, actually never null
     * @param {function(Error, string=)=} callback Callback receiving the error, if any, and the resulting hash. If omitted,
     *  hashing is perormed synchronously.
     *  @param {function(number)=} progressCallback Callback called with the current progress
     * @returns {string|undefined} Resulting hash if callback has been omitted, otherwise `undefined`
     * @inner
     */
    function _hash(s, salt, callback, progressCallback) {
        var err;
        if (typeof s !== 'string' || typeof salt !== 'string') {
            err = Error("Invalid string / salt: Not a string");
            if (callback) {
                nextTick(callback.bind(this, err));
                return;
            }
            else
                throw err;
        }

        // Validate the salt
        var minor, offset;
        if (salt.charAt(0) !== '$' || salt.charAt(1) !== '2') {
            err = Error("Invalid salt version: "+salt.substring(0,2));
            if (callback) {
                nextTick(callback.bind(this, err));
                return;
            }
            else
                throw err;
        }
        if (salt.charAt(2) === '$')
            minor = String.fromCharCode(0),
            offset = 3;
        else {
            minor = salt.charAt(2);
            if ((minor !== 'a' && minor !== 'b' && minor !== 'y') || salt.charAt(3) !== '$') {
                err = Error("Invalid salt revision: "+salt.substring(2,4));
                if (callback) {
                    nextTick(callback.bind(this, err));
                    return;
                } else
                    throw err;
            }
            offset = 4;
        }

        // Extract number of rounds
        if (salt.charAt(offset + 2) > '$') {
            err = Error("Missing salt rounds");
            if (callback) {
                nextTick(callback.bind(this, err));
                return;
            } else
                throw err;
        }
        var r1 = parseInt(salt.substring(offset, offset + 1), 10) * 10,
            r2 = parseInt(salt.substring(offset + 1, offset + 2), 10),
            rounds = r1 + r2,
            real_salt = salt.substring(offset + 3, offset + 25);
        s += minor >= 'a' ? "\x00" : "";

        var passwordb = stringToBytes(s),
            saltb = base64_decode(real_salt, BCRYPT_SALT_LEN);

        /**
         * Finishes hashing.
         * @param {Array.<number>} bytes Byte array
         * @returns {string}
         * @inner
         */
        function finish(bytes) {
            var res = [];
            res.push("$2");
            if (minor >= 'a')
                res.push(minor);
            res.push("$");
            if (rounds < 10)
                res.push("0");
            res.push(rounds.toString());
            res.push("$");
            res.push(base64_encode(saltb, saltb.length));
            res.push(base64_encode(bytes, C_ORIG.length * 4 - 1));
            return res.join('');
        }

        // Sync
        if (typeof callback == 'undefined')
            return finish(_crypt(passwordb, saltb, rounds));

        // Async
        else {
            _crypt(passwordb, saltb, rounds, function(err, bytes) {
                if (err)
                    callback(err, null);
                else
                    callback(null, finish(bytes));
            }, progressCallback);
        }
    }

    /**
     * Encodes a byte array to base64 with up to len bytes of input, using the custom bcrypt alphabet.
     * @function
     * @param {!Array.<number>} b Byte array
     * @param {number} len Maximum input length
     * @returns {string}
     * @expose
     */
    bcrypt.encodeBase64 = base64_encode;

    /**
     * Decodes a base64 encoded string to up to len bytes of output, using the custom bcrypt alphabet.
     * @function
     * @param {string} s String to decode
     * @param {number} len Maximum output length
     * @returns {!Array.<number>}
     * @expose
     */
    bcrypt.decodeBase64 = base64_decode;

    return bcrypt;
}));


// ===== 01_Config.gs =====
/**
 * Meu treino — configuração geral do backend (Google Apps Script).
 *
 * Propriedades do script (Configurações do projeto > Propriedades do script):
 *   PLANILHA_ID   preenchida automaticamente pelo setup() quando o script está ligado à planilha
 *   CPF_SEGREDO   gerada automaticamente pelo setup(); NUNCA compartilhe nem apague
 *   ADMIN_EMAIL   e-mail que vira administrador ao se cadastrar (preencha você)
 *   APP_URL       endereço do app no GitHub Pages, usado no link de recuperação de senha
 *   BCRYPT_CUSTO  opcional; padrão 10
 */
var APP = {
  NOME: 'Meu treino',
  VERSAO: '0.1.0',
  SESSAO_DIAS: 30,
  RECUPERACAO_MINUTOS: 60,
  MAX_TENTATIVAS_LOGIN: 5,
  JANELA_TENTATIVAS_SEG: 15 * 60,
  TEMAS: ['claro', 'escuro', 'sistema'],
  PALETAS: ['verde-agua', 'azul', 'violeta', 'coral', 'rosa', 'verde', 'vermelho', 'grafite'],
  PAPEIS_VER_COMO: ['aluno_gratis', 'aluno_premium', 'personal', 'gerente']
};

function prop_(nome, obrigatoria) {
  var valor = PropertiesService.getScriptProperties().getProperty(nome);
  if (!valor && obrigatoria) {
    throw erro_('CONFIG', 'Configuração ausente: ' + nome + '. Rode a função setup() no editor do Apps Script.');
  }
  return valor || '';
}

function planilha_() {
  var id = prop_('PLANILHA_ID', false);
  if (id) return SpreadsheetApp.openById(id);
  var ativa = SpreadsheetApp.getActiveSpreadsheet();
  if (!ativa) throw erro_('CONFIG', 'Planilha não encontrada. Rode a função setup().');
  return ativa;
}

/** Erro "esperado": a mensagem pode ser mostrada ao usuário. */
function erro_(codigo, mensagem) {
  var e = new Error(mensagem);
  e.codigo = codigo;
  return e;
}

function agora_() {
  return new Date().toISOString();
}

function novoId_() {
  return Utilities.getUuid();
}


// ===== 02_Esquema.gs =====
/**
 * Modelo de dados: cada aba da planilha é uma tabela.
 * Linha 1 = nomes das colunas. Tipos: t = texto, n = número, b = verdadeiro/falso, d = data (ISO, UTC).
 * Os nomes de tabelas e colunas são os mesmos que serão usados no Supabase.
 */
var COMUNS_ = { criado_em: 'd', atualizado_em: 'd', excluido_em: 'd' };

var ESQUEMA = {
  usuarios: {
    id: 't', email: 't', usuario: 't', hash_senha: 't', cpf_hash: 't', cpf_mascarado: 't', nome: 't',
    admin: 'b', personal_ativo: 'b', ativo: 'b', tema: 't', paleta: 't', aceite_termos_em: 'd'
  },
  sessoes_login: { id: 't', usuario_id: 't', token_hash: 't', expira_em: 'd', revogada_em: 'd' },
  recuperacoes_senha: { id: 't', usuario_id: 't', token_hash: 't', expira_em: 'd', usado_em: 'd' },
  grupos: { id: 't', nome: 't', descricao: 't' },
  membros_grupo: { id: 't', grupo_id: 't', usuario_id: 't', papel: 't' },
  vinculos_personal: { id: 't', personal_id: 't', aluno_id: 't', status: 't', inicio: 'd' },
  exercicios: { id: 't', nome: 't', grupo_muscular: 't', equipamento: 't', video_url: 't', criado_por: 't' },
  fichas: { id: 't', aluno_id: 't', autor_id: 't', nome: 't', ordem: 'n', ativa: 'b' },
  ficha_itens: {
    id: 't', ficha_id: 't', exercicio_id: 't', ordem: 'n', series: 'n', reps_prescritas: 't',
    reps_min: 'n', reps_max: 'n', carga_prescrita_kg: 'n', aumento_max_kg: 'n', carga_atual_kg: 'n',
    reps_atuais: 't', descanso_seg: 'n', metodo: 't', observacoes: 't'
  },
  sessoes: { id: 't', aluno_id: 't', ficha_id: 't', inicio: 'd', fim: 'd', observacao: 't' },
  series: { id: 't', sessao_id: 't', exercicio_id: 't', ordem: 'n', tipo: 't', reps: 'n', carga_kg: 'n', rpe: 'n' },
  ajustes: {
    id: 't', ficha_item_id: 't', aluno_id: 't', campo: 't', valor_anterior: 't', valor_novo: 't', visto_pelo_personal: 'b'
  },
  medidas: { id: 't', aluno_id: 't', data: 'd', peso_kg: 'n', campo: 't', valor: 'n' },
  configuracoes: { id: 't', valor: 't' },
  precos: { id: 't', periodo: 't', publico: 't', valor: 'n', ativo: 'b' },
  pedidos: {
    id: 't', comprador_id: 't', periodo: 't', quantidade: 'n', valor: 'n', codigo_referencia: 't',
    status: 't', liberado_em: 'd', liberado_por: 't'
  },
  licencas: { id: 't', usuario_id: 't', origem: 't', inicio: 'd', fim: 'd', concedida_por: 't', pedido_id: 't' },
  saldo_licencas_personal: {
    id: 't', personal_id: 't', periodo_ou_fim: 't', origem: 't', atribuida_a: 't', atribuida_em: 'd'
  },
  auditoria: { id: 't', usuario_id: 't', acao: 't', alvo: 't', detalhes: 't' }
};

/** Colunas na ordem da planilha (campos da tabela + campos comuns). */
function colunas_(tabela) {
  var def = ESQUEMA[tabela];
  if (!def) throw erro_('CONFIG', 'Tabela desconhecida: ' + tabela);
  var cols = Object.keys(def);
  Object.keys(COMUNS_).forEach(function (c) { if (cols.indexOf(c) < 0) cols.push(c); });
  return cols;
}

function tipo_(tabela, coluna) {
  return ESQUEMA[tabela][coluna] || COMUNS_[coluna] || 't';
}


// ===== 03_Banco.gs =====
/**
 * Acesso à planilha como banco de dados.
 * Toda gravação passa por celula_(), que impede que um texto vire fórmula
 * (regra de segurança 2), e acontece sob bloqueio (LockService).
 */

function aba_(tabela) {
  var aba = planilha_().getSheetByName(tabela);
  if (!aba) throw erro_('CONFIG', 'A aba "' + tabela + '" não existe. Rode a função setup().');
  return aba;
}

/** Converte um valor JS no conteúdo seguro de uma célula. */
function celula_(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') return isFinite(valor) ? valor : '';
  if (valor instanceof Date) valor = valor.toISOString();
  var texto = String(valor).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  if (texto === '') return '';
  // O apóstrofo inicial faz a planilha guardar o conteúdo como texto puro:
  // nada vira fórmula (=, +, -, @), data ou número por engano. Ele não faz parte do valor lido.
  return "'" + texto;
}

/** Converte o conteúdo da célula no tipo da coluna. */
function lerCelula_(tabela, coluna, bruto) {
  if (bruto === '' || bruto === null || bruto === undefined) return null;
  var tipo = tipo_(tabela, coluna);
  if (tipo === 'n') { var n = Number(bruto); return isFinite(n) ? n : null; }
  if (tipo === 'b') return bruto === true || bruto === 'TRUE' || bruto === 'true';
  if (tipo === 'd') return bruto instanceof Date ? bruto.toISOString() : String(bruto);
  return String(bruto);
}

/** Lê a tabela inteira como lista de objetos. Linhas com excluido_em ficam de fora, salvo pedido. */
function lerTodos_(tabela, incluirExcluidos) {
  var valores = aba_(tabela).getDataRange().getValues();
  if (valores.length < 2) return [];
  var cab = valores[0];
  var lista = [];
  for (var i = 1; i < valores.length; i++) {
    var linha = valores[i];
    var obj = { _linha: i + 1 };
    for (var j = 0; j < cab.length; j++) {
      if (cab[j]) obj[cab[j]] = lerCelula_(tabela, cab[j], linha[j]);
    }
    if (!obj.id) continue;
    if (!incluirExcluidos && obj.excluido_em) continue;
    lista.push(obj);
  }
  return lista;
}

function buscar_(tabela, filtro, incluirExcluidos) {
  return lerTodos_(tabela, incluirExcluidos).filter(function (o) {
    return Object.keys(filtro).every(function (k) { return o[k] === filtro[k]; });
  });
}

function buscarUm_(tabela, filtro, incluirExcluidos) {
  return buscar_(tabela, filtro, incluirExcluidos)[0] || null;
}

function comBloqueio_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw erro_('OCUPADO', 'O servidor está ocupado. Tente de novo em instantes.');
  try { return fn(); } finally { lock.releaseLock(); }
}

/** Insere uma linha. Gera id e datas se faltarem. Devolve o objeto gravado. */
function inserir_(tabela, obj) {
  return comBloqueio_(function () { return inserirSemBloqueio_(tabela, obj); });
}

/** Use só dentro de comBloqueio_ (por exemplo, para checar duplicidade e inserir de forma atômica). */
function inserirSemBloqueio_(tabela, obj) {
  var aba = aba_(tabela);
  var cols = cabecalho_(aba);
  var registro = Object.assign({}, obj);
  if (!registro.id) registro.id = novoId_();
  var t = agora_();
  if (cols.indexOf('criado_em') >= 0 && !registro.criado_em) registro.criado_em = t;
  if (cols.indexOf('atualizado_em') >= 0) registro.atualizado_em = t;
  aba.appendRow(cols.map(function (c) { return celula_(registro[c]); }));
  return registro;
}

/** Atualiza campos de uma linha pelo id. Devolve o registro atualizado. */
function atualizar_(tabela, id, campos) {
  return comBloqueio_(function () { return atualizarSemBloqueio_(tabela, id, campos); });
}

/** Use só dentro de comBloqueio_. */
function atualizarSemBloqueio_(tabela, id, campos) {
  var aba = aba_(tabela);
  var cols = cabecalho_(aba);
  var atual = buscarUm_(tabela, { id: id }, true);
  if (!atual) throw erro_('NAO_ENCONTRADO', 'Registro não encontrado.');
  var novo = Object.assign({}, atual, campos, { id: id });
  if (cols.indexOf('atualizado_em') >= 0) novo.atualizado_em = agora_();
  var linha = cols.map(function (c) { return celula_(novo[c]); });
  aba.getRange(atual._linha, 1, 1, cols.length).setValues([linha]);
  delete novo._linha;
  return novo;
}

/** Exclusão lógica: só marca excluido_em. */
function excluir_(tabela, id) {
  return atualizar_(tabela, id, { excluido_em: agora_() });
}

function cabecalho_(aba) {
  return aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].filter(String);
}

/** Remove campos internos ou sensíveis antes de devolver ao app. */
function publico_(obj, ocultos) {
  var saida = {};
  Object.keys(obj).forEach(function (k) {
    if (k.charAt(0) === '_') return;
    if ((ocultos || []).indexOf(k) >= 0) return;
    saida[k] = obj[k];
  });
  return saida;
}


// ===== 04_Seguranca.gs =====
/**
 * Segurança: validação de entradas, CPF, senhas (bcrypt) e tokens.
 */

// ---------- Validação (regra de segurança 3: o servidor valida tudo) ----------

function texto_(valor, campo, min, max, obrigatorio) {
  if (valor === undefined || valor === null || valor === '') {
    if (obrigatorio) throw erro_('VALIDACAO', 'Preencha o campo ' + campo + '.');
    return '';
  }
  if (typeof valor !== 'string') throw erro_('VALIDACAO', 'Valor inválido em ' + campo + '.');
  var t = valor.trim();
  if (t.length < min) throw erro_('VALIDACAO', campo + ' precisa ter pelo menos ' + min + ' caracteres.');
  if (t.length > max) throw erro_('VALIDACAO', campo + ' pode ter no máximo ' + max + ' caracteres.');
  return t;
}

function email_(valor) {
  var e = texto_(valor, 'e-mail', 5, 120, true).toLowerCase();
  if (!/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/.test(e)) throw erro_('VALIDACAO', 'E-mail inválido.');
  return e;
}

function nomeUsuario_(valor) {
  if (!valor) return '';
  var u = texto_(valor, 'nome de usuário', 3, 30, false).toLowerCase();
  if (!/^[a-z0-9._]+$/.test(u)) throw erro_('VALIDACAO', 'O nome de usuário aceita só letras sem acento, números, ponto e sublinhado.');
  return u;
}

function senha_(valor) {
  if (typeof valor !== 'string' || valor.length < 8) throw erro_('VALIDACAO', 'A senha precisa ter pelo menos 8 caracteres.');
  if (Utilities.newBlob(valor).getBytes().length > 72) throw erro_('VALIDACAO', 'A senha pode ter no máximo 72 caracteres.');
  return valor;
}

function opcao_(valor, campo, opcoes) {
  if (opcoes.indexOf(valor) < 0) throw erro_('VALIDACAO', 'Valor inválido em ' + campo + '.');
  return valor;
}

// ---------- CPF ----------

function cpfDigitos_(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function cpfValido_(valor) {
  var c = cpfDigitos_(valor);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  for (var t = 9; t < 11; t++) {
    var soma = 0;
    for (var i = 0; i < t; i++) soma += Number(c.charAt(i)) * (t + 1 - i);
    var dv = (soma * 10) % 11 % 10;
    if (dv !== Number(c.charAt(t))) return false;
  }
  return true;
}

/** Impressão digital do CPF (HMAC-SHA256 com segredo do servidor). O CPF completo nunca é gravado. */
function cpfHash_(valor) {
  var segredo = prop_('CPF_SEGREDO', true);
  return hex_(Utilities.computeHmacSha256Signature(cpfDigitos_(valor), segredo));
}

function cpfMascarado_(valor) {
  var c = cpfDigitos_(valor);
  return '***.' + c.substr(3, 3) + '.' + c.substr(6, 3) + '-**';
}

// ---------- Senhas (bcrypt) ----------

function bcrypt_() {
  var b = globalThis.dcodeIO.bcrypt;
  if (!b._fallbackPronto) {
    // Apps Script não tem Web Crypto: usa UUIDs aleatórios do Google como fonte de bytes.
    b.setRandomFallback(function (n) { return bytesAleatorios_(n); });
    b._fallbackPronto = true;
  }
  return b;
}

function hashSenha_(senha) {
  var custo = Number(prop_('BCRYPT_CUSTO', false)) || 10;
  return bcrypt_().hashSync(senha, custo);
}

function confereSenha_(senha, hash) {
  if (!hash) return false;
  return bcrypt_().compareSync(senha, hash);
}

// ---------- Tokens e utilitários ----------

function bytesAleatorios_(n) {
  var saida = [];
  while (saida.length < n) {
    var bloco = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid());
    for (var i = 0; i < bloco.length && saida.length < n; i++) saida.push(bloco[i] & 0xff);
  }
  return saida;
}

function tokenAleatorio_() {
  return hex_(bytesAleatorios_(32));
}

function sha256_(texto) {
  return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8));
}

function hex_(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

/** Limite de tentativas (login, recuperação de senha). */
function contarTentativa_(chave) {
  var cache = CacheService.getScriptCache();
  var k = 'tent:' + sha256_(chave);
  var n = Number(cache.get(k) || 0) + 1;
  cache.put(k, String(n), APP.JANELA_TENTATIVAS_SEG);
  return n;
}

function tentativasEsgotadas_(chave) {
  var n = Number(CacheService.getScriptCache().get('tent:' + sha256_(chave)) || 0);
  return n >= APP.MAX_TENTATIVAS_LOGIN;
}

function zerarTentativas_(chave) {
  CacheService.getScriptCache().remove('tent:' + sha256_(chave));
}


// ===== 05_Contas.gs =====
/**
 * Contas: cadastro, login, sessão, recuperação de senha, perfil e plano.
 */

var CAMPOS_OCULTOS_USUARIO_ = ['hash_senha', 'cpf_hash'];
var HASH_FICTICIO_ = '$2a$10$u7O9.QGREUzWVgzXp57hBOLIh3FvpRL1a0UWmN54eO2v07fhV0iH2';

function cadastrar_(d) {
  var nome = texto_(d.nome, 'nome', 2, 80, true);
  var email = email_(d.email);
  var usuario = nomeUsuario_(d.usuario);
  var senha = senha_(d.senha);
  if (!cpfValido_(d.cpf)) throw erro_('VALIDACAO', 'CPF inválido.');
  if (d.aceite_termos !== true) throw erro_('VALIDACAO', 'É preciso aceitar os termos de uso.');

  var cpfHash = cpfHash_(d.cpf);
  var hash = hashSenha_(senha); // fora do bloqueio: é a parte lenta
  var adminEmail = prop_('ADMIN_EMAIL', false).trim().toLowerCase();

  var novo = comBloqueio_(function () {
    var todos = lerTodos_('usuarios', true);
    if (todos.some(function (u) { return u.cpf_hash === cpfHash; })) throw erro_('DUPLICADO', 'Já existe uma conta com este CPF.');
    if (todos.some(function (u) { return u.email === email; })) throw erro_('DUPLICADO', 'Já existe uma conta com este e-mail.');
    if (usuario && todos.some(function (u) { return u.usuario === usuario; })) throw erro_('DUPLICADO', 'Este nome de usuário já está em uso.');
    return inserirSemBloqueio_('usuarios', {
      email: email, usuario: usuario, hash_senha: hash, cpf_hash: cpfHash, cpf_mascarado: cpfMascarado_(d.cpf),
      nome: nome, admin: !!adminEmail && email === adminEmail, personal_ativo: false, ativo: true,
      tema: 'sistema', paleta: 'verde-agua', aceite_termos_em: agora_()
    });
  });
  registrarAuditoria_(novo.id, 'conta.cadastro', novo.id, novo.admin ? 'admin' : '');
  return criarSessao_(novo);
}

function entrar_(d) {
  var login = texto_(d.login, 'e-mail ou usuário', 3, 120, true).toLowerCase();
  if (typeof d.senha !== 'string' || !d.senha) throw erro_('VALIDACAO', 'Informe a senha.');
  if (tentativasEsgotadas_(login)) {
    throw erro_('BLOQUEADO', 'Muitas tentativas. Espere 15 minutos e tente de novo, ou recupere a senha.');
  }
  var u = lerTodos_('usuarios').filter(function (x) { return x.email === login || (x.usuario && x.usuario === login); })[0];
  // Sem conta, compara com um hash fictício: a resposta demora o mesmo e não revela quem tem cadastro.
  var senhaOk = confereSenha_(d.senha, u ? u.hash_senha : HASH_FICTICIO_);
  if (!u || !u.ativo || !senhaOk) {
    contarTentativa_(login);
    throw erro_('CREDENCIAIS', 'E-mail/usuário ou senha incorretos.');
  }
  zerarTentativas_(login);
  return criarSessao_(u);
}

function criarSessao_(u) {
  var token = tokenAleatorio_();
  var expira = new Date(Date.now() + APP.SESSAO_DIAS * 864e5).toISOString();
  inserir_('sessoes_login', { usuario_id: u.id, token_hash: sha256_(token), expira_em: expira });
  return { token: token, expira_em: expira, perfil: perfil_(u) };
}

/** Confere o token e devolve o usuário logado. */
function autenticar_(token) {
  if (typeof token !== 'string' || token.length < 32) throw erro_('SESSAO_INVALIDA', 'Entre novamente.');
  var th = sha256_(token);
  var cache = CacheService.getScriptCache();
  var usuarioId = cache.get('sess:' + th);
  if (!usuarioId) {
    var s = buscarUm_('sessoes_login', { token_hash: th });
    if (!s || s.revogada_em || s.expira_em < agora_()) throw erro_('SESSAO_INVALIDA', 'Sua sessão expirou. Entre novamente.');
    usuarioId = s.usuario_id;
    cache.put('sess:' + th, usuarioId, 600);
  }
  var u = buscarUm_('usuarios', { id: usuarioId });
  if (!u || !u.ativo) throw erro_('SESSAO_INVALIDA', 'Entre novamente.');
  u._tokenHash = th;
  return u;
}

function sair_(ctx) {
  var s = buscarUm_('sessoes_login', { token_hash: ctx.usuario._tokenHash });
  if (s) atualizar_('sessoes_login', s.id, { revogada_em: agora_() });
  CacheService.getScriptCache().remove('sess:' + ctx.usuario._tokenHash);
  return { saiu: true };
}

function trocarSenha_(d, ctx) {
  if (!confereSenha_(String(d.senha_atual || ''), ctx.usuario.hash_senha)) throw erro_('CREDENCIAIS', 'Senha atual incorreta.');
  var nova = senha_(d.senha_nova);
  atualizar_('usuarios', ctx.usuario.id, { hash_senha: hashSenha_(nova) });
  registrarAuditoria_(ctx.usuario.id, 'conta.troca_senha', ctx.usuario.id, '');
  return { trocada: true };
}

/** Envia link de recuperação. Responde igual exista ou não a conta (não revela quem tem cadastro). */
function pedirRecuperacao_(d) {
  var email = email_(d.email);
  if (contarTentativa_('rec:' + email) > 3) return { enviado: true };
  var u = buscarUm_('usuarios', { email: email });
  if (u && u.ativo) {
    var token = tokenAleatorio_();
    var expira = new Date(Date.now() + APP.RECUPERACAO_MINUTOS * 6e4).toISOString();
    inserir_('recuperacoes_senha', { usuario_id: u.id, token_hash: sha256_(token), expira_em: expira });
    var base = prop_('APP_URL', true).replace(/\/+$/, '');
    MailApp.sendEmail({
      to: email,
      subject: APP.NOME + ': redefinir senha',
      body: 'Olá, ' + u.nome + '.\n\nPara criar uma nova senha, abra o link abaixo em até ' + APP.RECUPERACAO_MINUTOS +
        ' minutos:\n\n' + base + '/#/redefinir?token=' + token + '\n\nSe você não pediu isso, ignore este e-mail.'
    });
  }
  return { enviado: true };
}

function redefinirSenha_(d) {
  var token = String(d.token || '');
  var nova = senha_(d.senha_nova);
  var r = buscarUm_('recuperacoes_senha', { token_hash: sha256_(token) });
  if (!r || r.usado_em || r.expira_em < agora_()) throw erro_('LINK_INVALIDO', 'Link inválido ou expirado. Peça um novo.');
  atualizar_('usuarios', r.usuario_id, { hash_senha: hashSenha_(nova) });
  atualizar_('recuperacoes_senha', r.id, { usado_em: agora_() });
  registrarAuditoria_(r.usuario_id, 'conta.redefinicao_senha', r.usuario_id, '');
  return { redefinida: true };
}

// ---------- Perfil e plano ----------

function perfil_(u) {
  var p = publico_(u, CAMPOS_OCULTOS_USUARIO_);
  p.plano = planoAtual_(u);
  p.papeis = papeis_(u);
  return p;
}

/** Plano vigente: premium se for personal ativo ou tiver licença válida; senão, grátis. */
function planoAtual_(u) {
  if (u.personal_ativo) return { tipo: 'premium', origem: 'personal', fim: null, dias_restantes: null };
  var agora = agora_();
  var validas = buscar_('licencas', { usuario_id: u.id }).filter(function (l) {
    return l.inicio && l.inicio <= agora && (!l.fim || l.fim > agora);
  });
  if (!validas.length) return { tipo: 'gratis', origem: null, fim: null, dias_restantes: null };
  var semPrazo = validas.filter(function (l) { return !l.fim; })[0];
  if (semPrazo) return { tipo: 'premium', origem: semPrazo.origem, fim: null, dias_restantes: null };
  var maior = validas.sort(function (a, b) { return a.fim < b.fim ? 1 : -1; })[0];
  return {
    tipo: 'premium', origem: maior.origem, fim: maior.fim,
    dias_restantes: Math.ceil((new Date(maior.fim).getTime() - Date.now()) / 864e5)
  };
}

function papeis_(u) {
  var papeis = ['aluno'];
  if (u.personal_ativo) papeis.push('personal');
  if (buscar_('membros_grupo', { usuario_id: u.id }).some(function (m) { return m.papel === 'gerente'; })) papeis.push('gerente');
  if (u.admin) papeis.push('admin');
  return papeis;
}

function atualizarPerfil_(d, ctx) {
  var campos = {};
  if (d.nome !== undefined) campos.nome = texto_(d.nome, 'nome', 2, 80, true);
  if (d.tema !== undefined) campos.tema = opcao_(d.tema, 'tema', APP.TEMAS);
  if (d.paleta !== undefined) campos.paleta = opcao_(d.paleta, 'paleta', APP.PALETAS);
  if (!Object.keys(campos).length) throw erro_('VALIDACAO', 'Nada para atualizar.');
  return perfil_(atualizar_('usuarios', ctx.usuario.id, campos));
}

// ---------- Administração ----------

function listarUsuarios_() {
  return lerTodos_('usuarios').map(function (u) {
    return publico_(Object.assign({}, u, { plano: planoAtual_(u) }), CAMPOS_OCULTOS_USUARIO_);
  });
}

function definirPersonal_(d, ctx) {
  var alvo = buscarUm_('usuarios', { id: texto_(d.usuario_id, 'usuário', 10, 60, true) });
  if (!alvo) throw erro_('NAO_ENCONTRADO', 'Usuário não encontrado.');
  var ativo = d.ativo === true;
  atualizar_('usuarios', alvo.id, { personal_ativo: ativo });
  registrarAuditoria_(ctx.usuario.id, ativo ? 'admin.personal.ativar' : 'admin.personal.desativar', alvo.id, '');
  return { usuario_id: alvo.id, personal_ativo: ativo };
}

function registrarVerComo_(d, ctx) {
  var papel = opcao_(d.papel, 'papel', APP.PAPEIS_VER_COMO);
  registrarAuditoria_(ctx.usuario.id, 'admin.ver_como', papel, '');
  return { papel: papel };
}

function registrarAuditoria_(usuarioId, acao, alvo, detalhes) {
  inserir_('auditoria', { usuario_id: usuarioId, acao: acao, alvo: alvo || '', detalhes: detalhes || '' });
}


// ===== 06_Rotas.gs =====
/**
 * Rota única da API. O app envia POST com corpo JSON (Content-Type text/plain para evitar preflight de CORS):
 *   { "acao": "perfil.ler", "dados": {...}, "token": "...", "verComo": null }
 * Resposta: { "ok": true, "dados": ... } ou { "ok": false, "erro": { "codigo": "...", "mensagem": "..." } }
 *
 * acesso: 'publico' (sem login), 'logado' ou 'admin'. escrita: true bloqueia a ação no modo "ver como".
 */
// Montada na hora da chamada: no Apps Script a ordem de carga dos arquivos pode variar.
function rotas_() {
  return {
  'sistema.status':        { acesso: 'publico', fn: function () { return { app: APP.NOME, versao: APP.VERSAO, hora: agora_() }; } },
  'auth.cadastrar':        { acesso: 'publico', escrita: true, fn: cadastrar_ },
  'auth.entrar':           { acesso: 'publico', fn: entrar_ },
  'auth.pedirRecuperacao': { acesso: 'publico', fn: pedirRecuperacao_ },
  'auth.redefinirSenha':   { acesso: 'publico', escrita: true, fn: redefinirSenha_ },
  'auth.sair':             { acesso: 'logado', fn: function (d, ctx) { return sair_(ctx); } },
  'auth.trocarSenha':      { acesso: 'logado', escrita: true, fn: trocarSenha_ },
  'perfil.ler':            { acesso: 'logado', fn: function (d, ctx) { return perfil_(ctx.usuario); } },
  'perfil.atualizar':      { acesso: 'logado', escrita: true, fn: atualizarPerfil_ },
  'admin.usuarios.listar': { acesso: 'admin', fn: listarUsuarios_ },
  'admin.personal.definir':{ acesso: 'admin', escrita: true, fn: definirPersonal_ },
  'admin.verComo':         { acesso: 'admin', fn: registrarVerComo_ }
  };
}

function doGet() {
  return json_({ ok: true, dados: { app: APP.NOME, versao: APP.VERSAO } });
}

function doPost(e) {
  var pedido;
  try {
    pedido = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (x) {
    return json_({ ok: false, erro: { codigo: 'PEDIDO_INVALIDO', mensagem: 'Pedido inválido.' } });
  }
  try {
    return json_({ ok: true, dados: executar_(pedido) });
  } catch (x) {
    if (!x.codigo) console.error(x && x.stack ? x.stack : x);
    return json_({
      ok: false,
      erro: { codigo: x.codigo || 'ERRO_INTERNO', mensagem: x.codigo ? x.message : 'Erro inesperado. Tente de novo.' }
    });
  }
}

function executar_(pedido) {
  if (!pedido || typeof pedido.acao !== 'string') throw erro_('PEDIDO_INVALIDO', 'Pedido inválido.');
  var rotas = rotas_();
  var rota = Object.prototype.hasOwnProperty.call(rotas, pedido.acao) ? rotas[pedido.acao] : null;
  if (!rota) throw erro_('ACAO_DESCONHECIDA', 'Ação desconhecida.');
  var dados = pedido.dados && typeof pedido.dados === 'object' ? pedido.dados : {};
  var ctx = { usuario: null, verComo: null };

  if (rota.acesso !== 'publico') {
    ctx.usuario = autenticar_(pedido.token);
    if (pedido.verComo) {
      if (!ctx.usuario.admin) throw erro_('PROIBIDO', 'Sem permissão.');
      ctx.verComo = opcao_(pedido.verComo, 'ver como', APP.PAPEIS_VER_COMO);
    }
  }
  exigirPermissao_(rota, ctx);
  return rota.fn(dados, ctx);
}

/** Regra de segurança 6: toda ação é checada aqui, no servidor. */
function exigirPermissao_(rota, ctx) {
  if (rota.acesso === 'admin' && !(ctx.usuario && ctx.usuario.admin)) throw erro_('PROIBIDO', 'Sem permissão.');
  if (ctx.verComo && rota.escrita) throw erro_('SOMENTE_LEITURA', 'No modo "ver como" nada é alterado.');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}


// ===== 07_Instalacao.gs =====
/**
 * Instalação. Rode setup() uma vez pelo editor do Apps Script (menu Executar).
 * Pode rodar de novo sem perder dados: só cria o que falta.
 */
function setup() {
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!props.getProperty('PLANILHA_ID')) {
    if (!ss) throw new Error('Abra o Apps Script a partir da planilha (Extensões > Apps Script) e rode setup() de novo.');
    props.setProperty('PLANILHA_ID', ss.getId());
  }
  if (!props.getProperty('CPF_SEGREDO')) props.setProperty('CPF_SEGREDO', tokenAleatorio_());
  ss = planilha_();

  Object.keys(ESQUEMA).forEach(function (tabela) {
    var cols = colunas_(tabela);
    var aba = ss.getSheetByName(tabela) || ss.insertSheet(tabela);
    var atual = aba.getLastColumn() ? aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].filter(String) : [];
    var faltando = cols.filter(function (c) { return atual.indexOf(c) < 0; });
    if (faltando.length) aba.getRange(1, atual.length + 1, 1, faltando.length).setValues([faltando]);
    aba.setFrozenRows(1);
  });

  ss.getSheets().forEach(function (aba) {
    var nome = aba.getName();
    if (!ESQUEMA[nome] && aba.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(aba);
  });

  var faltam = ['ADMIN_EMAIL', 'APP_URL'].filter(function (p) { return !props.getProperty(p); });
  var msg = 'Pronto: ' + Object.keys(ESQUEMA).length + ' abas conferidas.';
  if (faltam.length) msg += ' Falta preencher nas Propriedades do script: ' + faltam.join(', ') + '.';
  console.log(msg);
  return msg;
}

/** Teste rápido do bcrypt (mostra no registro de execução quanto tempo um hash leva). */
function testarSenha() {
  var t0 = Date.now();
  var h = hashSenha_('senha-de-teste-123');
  var ok = confereSenha_('senha-de-teste-123', h);
  console.log('bcrypt ok=' + ok + ' em ' + (Date.now() - t0) + ' ms');
}
