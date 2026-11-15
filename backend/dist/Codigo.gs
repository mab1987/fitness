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
  VERSAO: '0.4.1',
  SESSAO_DIAS: 30,
  RECUPERACAO_MINUTOS: 60,
  MAX_TENTATIVAS_LOGIN: 5,
  JANELA_TENTATIVAS_SEG: 15 * 60,
  TEMAS: ['claro', 'escuro', 'sistema'],
  PALETAS: ['verde-agua', 'azul', 'violeta', 'coral', 'rosa', 'verde', 'vermelho', 'grafite'],
  PAPEIS_VER_COMO: ['aluno_gratis', 'aluno_premium', 'personal', 'gerente'],
  LIMITE_FICHAS_GRATIS: 3,
  DIAS_GRAFICO_GRATIS: 30,
  METODOS: ['', 'drop-set', 'rest-pause', 'bi-set', 'tri-set', 'piramide', 'cluster', 'outro'],
  TIPOS_SERIE: ['normal', 'aquecimento', 'drop', 'falha'],
  MAX_LOTE_SESSOES: 200,
  MAX_LOTE_SERIES: 3000,
  CONVITE_DIAS: 7,
  PAPEIS_GRUPO: ['membro', 'personal', 'gerente'],
  PERIODOS: { mensal: 1, trimestral: 3, semestral: 6, anual: 12 },
  // Preços iniciais (opção simbólica do plano do projeto). O administrador muda no app.
  PRECOS_INICIAIS: [
    ['aluno', 'mensal', 4.9], ['aluno', 'trimestral', 12.9], ['aluno', 'semestral', 22.9], ['aluno', 'anual', 39.9],
    ['personal', 'mensal', 3.4], ['personal', 'trimestral', 8.9], ['personal', 'semestral', 15.9], ['personal', 'anual', 27.9]
  ],
  MAX_PEDIDOS_ABERTOS: 3,
  INCREMENTO_PADRAO_KG: 2.5
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
  vinculos_personal: { id: 't', personal_id: 't', aluno_id: 't', status: 't', inicio: 'd', fim: 'd' },
  convites: {
    id: 't', codigo_hash: 't', final_codigo: 't', tipo: 't', criado_por: 't', grupo_id: 't', papel: 't',
    expira_em: 'd', usos_max: 'n', usos: 'n', revogado_em: 'd'
  },
  exercicios: {
    id: 't', nome: 't', grupo_muscular: 't', equipamento: 't', video_url: 't', criado_por: 't', global: 'b', status: 't',
    secundarios: 't', mecanica: 't'
  },
  fichas: { id: 't', aluno_id: 't', autor_id: 't', nome: 't', ordem: 'n', ativa: 'b' },
  ficha_itens: {
    id: 't', ficha_id: 't', exercicio_id: 't', ordem: 'n', series: 'n', reps_prescritas: 't',
    reps_min: 'n', reps_max: 'n', carga_prescrita_kg: 'n', aumento_max_kg: 'n', carga_atual_kg: 'n',
    reps_atuais: 't', descanso_seg: 'n', metodo: 't', observacoes: 't', sugestao: 't', incremento_kg: 'n'
  },
  sessoes: { id: 't', aluno_id: 't', ficha_id: 't', inicio: 'd', fim: 'd', observacao: 't' },
  series: { id: 't', sessao_id: 't', exercicio_id: 't', ordem: 'n', tipo: 't', reps: 'n', carga_kg: 'n', rpe: 'n' },
  ajustes: {
    id: 't', ficha_item_id: 't', aluno_id: 't', campo: 't', valor_anterior: 't', valor_novo: 't', visto_pelo_personal: 'b'
  },
  comentarios: { id: 't', sessao_id: 't', aluno_id: 't', autor_id: 't', texto: 't', visto: 'b' },
  medidas: {
    id: 't', aluno_id: 't', autor_id: 't', data: 'd', peso_kg: 'n', gordura_pct: 'n', peito_cm: 'n', cintura_cm: 'n',
    abdomen_cm: 'n', quadril_cm: 'n', braco_d_cm: 'n', braco_e_cm: 'n', coxa_d_cm: 'n', coxa_e_cm: 'n',
    panturrilha_cm: 'n', observacao: 't'
  },
  configuracoes: { id: 't', valor: 't' },
  precos: { id: 't', periodo: 't', publico: 't', valor: 'n', ativo: 'b' },
  pedidos: {
    id: 't', comprador_id: 't', tipo: 't', periodo: 't', quantidade: 'n', valor: 'n', codigo_referencia: 't',
    status: 't', pago_informado_em: 'd', liberado_em: 'd', liberado_por: 't', observacao: 't'
  },
  licencas: { id: 't', usuario_id: 't', origem: 't', inicio: 'd', fim: 'd', concedida_por: 't', pedido_id: 't' },
  saldo_licencas_personal: {
    id: 't', personal_id: 't', periodo_ou_fim: 't', origem: 't', atribuida_a: 't', atribuida_em: 'd',
    pedido_id: 't', licenca_id: 't'
  },
  programas: {
    id: 't', nome: 't', descricao: 't', objetivo: 't', nivel: 't', dias_semana: 'n', semanas: 'n',
    autor_id: 't', grupo_id: 't', publico: 't', gratis: 'b', publicado: 'b'
  },
  programa_fichas: { id: 't', programa_id: 't', nome: 't', ordem: 'n' },
  programa_itens: {
    id: 't', programa_ficha_id: 't', exercicio_id: 't', ordem: 'n', series: 'n', reps_prescritas: 't',
    descanso_seg: 'n', metodo: 't', observacoes: 't'
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

/**
 * Grava vários registros de uma vez (cria os novos, atualiza os que já existem pelo id).
 * Lê a aba uma única vez. Use só dentro de comBloqueio_.
 * opcoes.podeAlterar(atual): false impede alterar registro de outra pessoa.
 * opcoes.fixos: campos sempre gravados (por exemplo, o dono do registro).
 */
function upsertLoteSemBloqueio_(tabela, registros, opcoes) {
  opcoes = opcoes || {};
  if (!registros.length) return { criados: 0, atualizados: 0 };
  var unicos = {};
  registros.forEach(function (r) { unicos[r.id] = r; }); // o último com o mesmo id vale
  var aba = aba_(tabela);
  var cols = cabecalho_(aba);
  var porId = {};
  lerTodos_(tabela, true).forEach(function (o) { porId[o.id] = o; });
  var t = agora_();
  var novos = [];
  var atualizados = 0;
  Object.keys(unicos).forEach(function (id) {
    var r = Object.assign({}, unicos[id], opcoes.fixos || {});
    var atual = porId[id];
    if (atual) {
      if (opcoes.podeAlterar && !opcoes.podeAlterar(atual)) throw erro_('PROIBIDO', 'Registro de outra pessoa.');
      var novo = Object.assign({}, atual, r, { atualizado_em: t });
      aba.getRange(atual._linha, 1, 1, cols.length).setValues([cols.map(function (c) { return celula_(novo[c]); })]);
      atualizados++;
    } else {
      var reg = Object.assign({ criado_em: t }, r, { atualizado_em: t });
      novos.push(cols.map(function (c) { return celula_(reg[c]); }));
    }
  });
  if (novos.length) aba.getRange(aba.getLastRow() + 1, 1, novos.length, cols.length).setValues(novos);
  return { criados: novos.length, atualizados: atualizados };
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
  // Compras seguidas começam quando a anterior acaba: segue a corrente para achar o fim real.
  var fim = maior.fim;
  var futuras = buscar_('licencas', { usuario_id: u.id }).filter(function (l) { return l.inicio > agora; });
  var mudou = true;
  while (mudou) {
    mudou = false;
    futuras.forEach(function (l) {
      if (!l.fim) return;
      if (l.inicio <= fim && l.fim > fim) { fim = l.fim; mudou = true; }
    });
  }
  return {
    tipo: 'premium', origem: maior.origem, fim: fim,
    dias_restantes: Math.ceil((new Date(fim).getTime() - Date.now()) / 864e5)
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
  'admin.verComo':         { acesso: 'admin', fn: registrarVerComo_ },
  'exercicios.listar':     { acesso: 'logado', fn: listarExercicios_ },
  'exercicios.criar':      { acesso: 'logado', escrita: true, fn: criarExercicio_ },
  'exercicios.atualizar':  { acesso: 'logado', escrita: true, fn: atualizarExercicio_ },
  'fichas.listar':         { acesso: 'logado', fn: listarFichas_ },
  'fichas.salvar':         { acesso: 'logado', escrita: true, fn: salvarFicha_ },
  'fichas.excluir':        { acesso: 'logado', escrita: true, fn: excluirFicha_ },
  'treino.sincronizar':    { acesso: 'logado', escrita: true, fn: sincronizarTreino_ },
  'historico.listar':      { acesso: 'logado', fn: listarHistorico_ },
  'admin.importar.previa': { acesso: 'admin', fn: function (d, ctx) { return importarPlanilhaAntiga_(d, true, ctx.usuario); } },
  'admin.importar.executar': { acesso: 'admin', escrita: true, fn: function (d, ctx) { return importarPlanilhaAntiga_(d, false, ctx.usuario); } },
  // Fase 2: convites e vínculo
  'convites.criar':        { acesso: 'logado', escrita: true, fn: criarConvite_ },
  'convites.listar':       { acesso: 'logado', fn: listarConvites_ },
  'convites.revogar':      { acesso: 'logado', escrita: true, fn: revogarConvite_ },
  'convites.ver':          { acesso: 'logado', fn: verConvite_ },
  'convites.aceitar':      { acesso: 'logado', escrita: true, fn: aceitarConvite_ },
  'vinculo.meu':           { acesso: 'logado', fn: meuVinculo_ },
  'vinculo.encerrar':      { acesso: 'logado', escrita: true, fn: encerrarVinculo_ },
  // personal
  'personal.alunos':       { acesso: 'logado', fn: listarAlunos_ },
  'personal.aluno':        { acesso: 'logado', fn: lerAluno_ },
  'personal.fichaSalvar':  { acesso: 'logado', escrita: true, fn: salvarFichaDoAluno_ },
  'personal.fichaExcluir': { acesso: 'logado', escrita: true, fn: excluirFichaDoAluno_ },
  'personal.ajustesVistos':{ acesso: 'logado', escrita: true, fn: marcarAjustesVistos_ },
  'exercicios.propor':     { acesso: 'logado', escrita: true, fn: proporExercicio_ },
  // comentários (aluno e personal)
  'comentarios.listar':    { acesso: 'logado', fn: listarComentarios_ },
  'comentarios.criar':     { acesso: 'logado', escrita: true, fn: criarComentario_ },
  'comentarios.vistos':    { acesso: 'logado', escrita: true, fn: marcarComentariosVistos_ },
  // grupos
  'grupos.listar':         { acesso: 'logado', fn: listarGrupos_ },
  'grupos.ler':            { acesso: 'logado', fn: lerGrupo_ },
  'grupos.atualizar':      { acesso: 'logado', escrita: true, fn: atualizarGrupo_ },
  'grupos.papel':          { acesso: 'logado', escrita: true, fn: definirPapelMembro_ },
  'grupos.remover':        { acesso: 'logado', escrita: true, fn: removerMembro_ },
  'grupos.sair':           { acesso: 'logado', escrita: true, fn: sairDoGrupo_ },
  // administração
  'admin.grupos.criar':    { acesso: 'admin', escrita: true, fn: criarGrupo_ },
  'admin.grupos.excluir':  { acesso: 'admin', escrita: true, fn: excluirGrupo_ },
  'admin.usuario.atualizar': { acesso: 'admin', escrita: true, fn: atualizarUsuarioAdmin_ },
  'admin.catalogo':        { acesso: 'admin', fn: catalogoAdmin_ },
  'admin.exercicio.atualizar': { acesso: 'admin', escrita: true, fn: atualizarExercicioAdmin_ },
  'admin.exercicio.decidir': { acesso: 'admin', escrita: true, fn: decidirExercicio_ },
  // Fase 3: premium
  'precos.listar':         { acesso: 'logado', fn: listarPrecos_ },
  'licencas.minhas':       { acesso: 'logado', fn: minhasLicencas_ },
  'pedidos.criar':         { acesso: 'logado', escrita: true, fn: criarPedido_ },
  'pedidos.paguei':        { acesso: 'logado', escrita: true, fn: informarPagamento_ },
  'pedidos.cancelar':      { acesso: 'logado', escrita: true, fn: cancelarMeuPedido_ },
  'personal.licencas':     { acesso: 'logado', fn: minhasLicencasPersonal_ },
  'personal.atribuir':     { acesso: 'logado', escrita: true, fn: atribuirLicenca_ },
  'admin.config':          { acesso: 'admin', fn: lerConfigAdmin_ },
  'admin.config.salvar':   { acesso: 'admin', escrita: true, fn: salvarConfigAdmin_ },
  'admin.precos':          { acesso: 'admin', fn: precosAdmin_ },
  'admin.precos.salvar':   { acesso: 'admin', escrita: true, fn: salvarPrecosAdmin_ },
  'admin.pedidos':         { acesso: 'admin', fn: listarPedidosAdmin_ },
  'admin.pedido.liberar':  { acesso: 'admin', escrita: true, fn: liberarPedido_ },
  'admin.pedido.cancelar': { acesso: 'admin', escrita: true, fn: cancelarPedidoAdmin_ },
  'admin.cortesia':        { acesso: 'admin', escrita: true, fn: cortesia_ },
  'admin.licenca.revogar': { acesso: 'admin', escrita: true, fn: revogarLicenca_ },
  'admin.licencas.usuario':{ acesso: 'admin', fn: licencasDeUsuarioAdmin_ },
  'admin.lote':            { acesso: 'admin', escrita: true, fn: loteParaPersonal_ },
  // programas, medidas, exportação
  'programas.listar':      { acesso: 'logado', fn: listarProgramas_ },
  'programas.meus':        { acesso: 'logado', fn: programasAutor_ },
  'programas.salvar':      { acesso: 'logado', escrita: true, fn: salvarPrograma_ },
  'programas.excluir':     { acesso: 'logado', escrita: true, fn: excluirPrograma_ },
  'programas.usar':        { acesso: 'logado', escrita: true, fn: usarPrograma_ },
  'medidas.listar':        { acesso: 'logado', fn: listarMedidas_ },
  'medidas.salvar':        { acesso: 'logado', escrita: true, fn: salvarMedida_ },
  'medidas.excluir':       { acesso: 'logado', escrita: true, fn: excluirMedida_ },
  'exportar':              { acesso: 'logado', fn: exportarDados_ },
  // catálogo base
  'admin.catalogo.previa': { acesso: 'admin', fn: function (d, ctx) { return semearCatalogo_(d, true, ctx); } },
  'admin.catalogo.semear': { acesso: 'admin', escrita: true, fn: function (d, ctx) { return semearCatalogo_(d, false, ctx); } },
  'admin.exercicios.juntar': { acesso: 'admin', escrita: true, fn: mesclarExercicios_ },
  'exercicios.grupos':     { acesso: 'logado', fn: function () { return GRUPOS_MUSCULARES; } }
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

  // Tabela de preços inicial, só se estiver vazia.
  if (!lerTodos_('precos', true).length) {
    APP.PRECOS_INICIAIS.forEach(function (p) {
      inserirSemBloqueio_('precos', { id: 'preco_' + p[0] + '_' + p[1], publico: p[0], periodo: p[1], valor: p[2], ativo: true });
    });
  }

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


// ===== 08_Treinos.gs =====
/**
 * Fase 1: exercícios, fichas, treinos e histórico do aluno.
 *
 * Os ids de fichas, itens, sessões e séries são criados no aparelho (o app funciona sem internet)
 * e enviados depois. Por isso o servidor confere o formato do id e quem é o dono de cada registro.
 */

// ---------- validações deste módulo ----------

function id_(valor, campo) {
  if (typeof valor !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(valor)) {
    throw erro_('VALIDACAO', 'Identificador inválido em ' + (campo || 'id') + '.');
  }
  return valor;
}

function idOpcional_(valor, campo) {
  return valor === null || valor === undefined || valor === '' ? null : id_(valor, campo);
}

function numero_(valor, campo, min, max, opcional) {
  if (valor === null || valor === undefined || valor === '') {
    if (opcional) return null;
    throw erro_('VALIDACAO', 'Preencha o campo ' + campo + '.');
  }
  var n = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.'));
  if (!isFinite(n) || n < min || n > max) throw erro_('VALIDACAO', 'Valor inválido em ' + campo + '.');
  return Math.round(n * 1000) / 1000;
}

function dataIso_(valor, campo, opcional) {
  if (valor === null || valor === undefined || valor === '') {
    if (opcional) return null;
    throw erro_('VALIDACAO', 'Preencha o campo ' + campo + '.');
  }
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(valor)) {
    throw erro_('VALIDACAO', 'Data inválida em ' + campo + '.');
  }
  var t = new Date(valor);
  if (isNaN(t.getTime())) throw erro_('VALIDACAO', 'Data inválida em ' + campo + '.');
  return t.toISOString();
}

function lista_(valor, campo, max) {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor)) throw erro_('VALIDACAO', 'Lista inválida em ' + campo + '.');
  if (valor.length > max) throw erro_('VALIDACAO', 'Itens demais em ' + campo + ' (máximo ' + max + ').');
  return valor.map(function (x) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) throw erro_('VALIDACAO', 'Item inválido em ' + campo + '.');
    return x;
  });
}

/**
 * Aceita só links do YouTube e guarda no formato padrão.
 * Vídeos próprios do personal: suba no YouTube como "não listado" e cole o link.
 */
function videoYoutube_(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  var id = idYoutube_(valor);
  if (!id) throw erro_('VALIDACAO', 'Use um link do YouTube (youtube.com ou youtu.be).');
  return 'https://www.youtube.com/watch?v=' + id;
}

function idYoutube_(url) {
  if (typeof url !== 'string' || url.length > 300) return null;
  var m = url.trim().match(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#/].*)?$/);
  return m ? m[1] : null;
}

// ---------- plano e permissões ----------

/** Plano que vale nesta chamada: no "ver como aluno grátis" o admin vê os limites do grátis. */
function planoEfetivo_(ctx) {
  if (ctx.verComo === 'aluno_gratis') return { tipo: 'gratis' };
  if (ctx.verComo) return { tipo: 'premium' };
  return planoAtual_(ctx.usuario);
}

function limites_(ctx) {
  var gratis = planoEfetivo_(ctx).tipo !== 'premium';
  return {
    plano: gratis ? 'gratis' : 'premium',
    fichas_ativas: gratis ? APP.LIMITE_FICHAS_GRATIS : null,
    dias_grafico: gratis ? APP.DIAS_GRAFICO_GRATIS : null,
    exportar: !gratis
  };
}

/**
 * Quem altera uma ficha:
 * - o personal que a prescreveu, enquanto o vínculo com o aluno estiver ativo;
 * - o aluno, se a ficha é dele e foi ele quem fez, ou se o vínculo com quem prescreveu já acabou.
 * Enquanto o vínculo existe, a ficha prescrita só muda pelo personal; o aluno sobe carga e repetições pelo treino.
 */
function podeEditarFicha_(ficha, u) {
  if (ficha.autor_id === u.id && ficha.aluno_id !== u.id) return vinculoAtivo_(u.id, ficha.aluno_id);
  if (ficha.aluno_id !== u.id) return false;
  return ficha.autor_id === u.id || !ficha.autor_id || !vinculoAtivo_(ficha.autor_id, u.id);
}

/**
 * Exercícios que a pessoa pode ver e usar: os do catálogo geral, os que ela criou
 * e os que aparecem nas fichas dela (um exercício próprio do personal numa ficha prescrita).
 */
function exerciciosVisiveis_(u, todos) {
  var nasFichas = {};
  var minhas = {};
  buscar_('fichas', { aluno_id: u.id }).forEach(function (f) { minhas[f.id] = true; });
  lerTodos_('ficha_itens').forEach(function (i) { if (minhas[i.ficha_id]) nasFichas[i.exercicio_id] = true; });
  var vis = {};
  (todos || lerTodos_('exercicios', true)).forEach(function (e) {
    if (e.excluido_em && !nasFichas[e.id]) return;
    if (e.global || e.criado_por === u.id || nasFichas[e.id]) vis[e.id] = e;
  });
  return vis;
}

function exercicioVisivel_(ex, u) {
  return ex.global || ex.criado_por === u.id;
}

// ---------- exercícios ----------

function listarExercicios_(d, ctx) {
  var vis = exerciciosVisiveis_(ctx.usuario);
  return Object.keys(vis).map(function (k) { return publico_(vis[k], []); })
    .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
}

function criarExercicio_(d, ctx) {
  var u = ctx.usuario;
  var nome = texto_(d.nome, 'nome', 2, 80, true);
  var reg = {
    id: d.id ? id_(d.id) : novoId_(),
    nome: nome,
    grupo_muscular: texto_(d.grupo_muscular, 'grupo muscular', 0, 40, false),
    equipamento: texto_(d.equipamento, 'equipamento', 0, 40, false),
    video_url: videoYoutube_(d.video_url),
    secundarios: texto_(d.secundarios, 'músculos secundários', 0, 120, false),
    mecanica: opcao_(d.mecanica || '', 'tipo de movimento', ['', 'composto', 'isolado', 'cardio']),
    criado_por: u.id,
    global: !!u.admin && d.global !== false
  };
  return comBloqueio_(function () {
    var chave = normalizarNome_(nome);
    var igual = lerTodos_('exercicios').filter(function (e) {
      return exercicioVisivel_(e, u) && normalizarNome_(e.nome) === chave;
    })[0];
    if (igual) throw erro_('DUPLICADO', 'Já existe o exercício "' + igual.nome + '".');
    if (buscarUm_('exercicios', { id: reg.id }, true)) throw erro_('DUPLICADO', 'Identificador já usado.');
    return publico_(inserirSemBloqueio_('exercicios', reg), []);
  });
}

function atualizarExercicio_(d, ctx) {
  var u = ctx.usuario;
  var id = id_(d.id);
  return comBloqueio_(function () {
    var ex = buscarUm_('exercicios', { id: id });
    if (!ex) throw erro_('NAO_ENCONTRADO', 'Exercício não encontrado.');
    var pode = ex.global ? !!u.admin : ex.criado_por === u.id;
    if (!pode) throw erro_('PROIBIDO', 'Só quem criou pode alterar este exercício.');
    var campos = {};
    if (d.nome !== undefined) campos.nome = texto_(d.nome, 'nome', 2, 80, true);
    if (d.grupo_muscular !== undefined) campos.grupo_muscular = texto_(d.grupo_muscular, 'grupo muscular', 0, 40, false);
    if (d.equipamento !== undefined) campos.equipamento = texto_(d.equipamento, 'equipamento', 0, 40, false);
    if (d.video_url !== undefined) campos.video_url = videoYoutube_(d.video_url);
    if (d.secundarios !== undefined) campos.secundarios = texto_(d.secundarios, 'músculos secundários', 0, 120, false);
    if (d.mecanica !== undefined) campos.mecanica = opcao_(d.mecanica || '', 'tipo de movimento', ['', 'composto', 'isolado', 'cardio']);
    return publico_(atualizarSemBloqueio_('exercicios', id, campos), []);
  });
}

function normalizarNome_(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

// ---------- fichas ----------

function listarFichas_(d, ctx) {
  var r = fichasDe_(ctx.usuario.id, ctx.usuario, limites_(ctx));
  r.config = { incremento_padrao_kg: Number(config_('incremento_padrao_kg', APP.INCREMENTO_PADRAO_KG)) };
  return r;
}

/**
 * No plano grátis valem as N primeiras fichas ativas (pela ordem). Se o premium acabou com mais
 * fichas ativas, as outras ficam bloqueadas: dá para ver e arquivar, não para treinar nem alterar.
 */
function fichasLiberadas_(fichas, limite) {
  var ok = {};
  fichas.filter(function (f) { return f.ativa && !f.excluido_em; })
    .sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0) || (a.criado_em < b.criado_em ? -1 : 1); })
    .slice(0, limite)
    .forEach(function (f) { ok[f.id] = true; });
  return ok;
}

function dentroDoLimite_(fichas, fichaId, limite) {
  return !!fichasLiberadas_(fichas, limite)[fichaId];
}

/** Fichas de um aluno com os itens, quem prescreveu e se quem pede pode alterar. */
function fichasDe_(alunoId, quem, limites) {
  var u = quem;
  var fichas = buscar_('fichas', { aluno_id: alunoId });
  var liberadas = limites.fichas_ativas !== null ? fichasLiberadas_(fichas, limites.fichas_ativas) : {};
  var nomes = {};
  lerTodos_('usuarios').forEach(function (x) { nomes[x.id] = x.nome; });
  var ids = {};
  fichas.forEach(function (f) { ids[f.id] = true; });
  var itens = lerTodos_('ficha_itens').filter(function (i) { return ids[i.ficha_id]; });
  return {
    limites: limites,
    fichas: fichas
      .sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); })
      .map(function (f) {
        var r = publico_(f, []);
        r.prescrita = !!f.autor_id && f.autor_id !== f.aluno_id;
        r.autor_nome = r.prescrita ? nomes[f.autor_id] || '' : '';
        r.pode_editar = podeEditarFicha_(f, u);
        r.bloqueada = limites.fichas_ativas !== null && f.ativa && !liberadas[f.id];
        r.itens = itens
          .filter(function (i) { return i.ficha_id === f.id; })
          .sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); })
          .map(function (i) { return publico_(i, []); });
        return r;
      })
  };
}

function validarItem_(i, fichaId, ordem) {
  return {
    id: id_(i.id, 'item'),
    ficha_id: fichaId,
    exercicio_id: id_(i.exercicio_id, 'exercício'),
    ordem: ordem,
    series: numero_(i.series, 'séries', 1, 20, false),
    reps_prescritas: texto_(i.reps_prescritas, 'repetições', 0, 40, false),
    reps_min: numero_(i.reps_min, 'repetições mínimas', 0, 200, true),
    reps_max: numero_(i.reps_max, 'repetições máximas', 0, 200, true),
    carga_prescrita_kg: numero_(i.carga_prescrita_kg, 'carga', 0, 1000, true),
    aumento_max_kg: numero_(i.aumento_max_kg, 'aumento máximo', 0, 100, true),
    carga_atual_kg: numero_(i.carga_atual_kg, 'carga atual', 0, 1000, true),
    reps_atuais: texto_(i.reps_atuais, 'repetições atuais', 0, 40, false),
    descanso_seg: numero_(i.descanso_seg, 'descanso', 0, 1800, true),
    metodo: opcao_(i.metodo || '', 'método', APP.METODOS),
    observacoes: texto_(i.observacoes, 'observações', 0, 500, false),
    sugestao: opcao_(i.sugestao || '', 'sugestão de carga', ['', 'desligada']),
    incremento_kg: numero_(i.incremento_kg, 'incremento', 0.25, 20, true)
  };
}

/**
 * Cria ou altera uma ficha com todos os seus itens.
 * dados: { ficha: { id, nome, ordem, ativa }, itens: [ ... ] }
 * Itens que não vierem na lista são removidos da ficha (exclusão lógica).
 */
function salvarFicha_(d, ctx) {
  return salvarFichaPara_(ctx.usuario, ctx.usuario, d, limites_(ctx));
}

/** u = quem salva; aluno = dono da ficha (o próprio u, ou um aluno do personal). */
function salvarFichaPara_(u, aluno, d, lim) {
  var f = d.ficha && typeof d.ficha === 'object' ? d.ficha : {};
  var fichaId = id_(f.id, 'ficha');
  var nome = texto_(f.nome, 'nome da ficha', 1, 60, true);
  var ativa = f.ativa !== false;
  var ordem = numero_(f.ordem, 'ordem', 0, 999, true) || 0;
  var itens = lista_(d.itens, 'itens', 60).map(function (i, n) { return validarItem_(i, fichaId, n + 1); });

  return comBloqueio_(function () {
    if (u.id !== aluno.id && !vinculoAtivo_(u.id, aluno.id)) throw erro_('PROIBIDO', 'Esta pessoa não é sua aluna.');
    var todas = buscar_('fichas', { aluno_id: aluno.id });
    var atual = buscarUm_('fichas', { id: fichaId }, true);
    if (atual && (atual.excluido_em || atual.aluno_id !== aluno.id)) throw erro_('PROIBIDO', 'Ficha de outra pessoa.');
    if (atual && !podeEditarFicha_(atual, u)) {
      throw erro_('PROIBIDO', atual.aluno_id === u.id ? 'Esta ficha foi prescrita pelo seu personal. Peça a ele para alterar.' : 'Ficha de outra pessoa.');
    }
    if (ativa && lim.fichas_ativas !== null && !dentroDoLimite_(todas, fichaId, lim.fichas_ativas)) {
      var outrasAtivas = todas.filter(function (x) { return x.ativa && x.id !== fichaId; }).length;
      if (outrasAtivas >= lim.fichas_ativas) {
        throw erro_('LIMITE_PLANO', u.id === aluno.id
          ? 'No plano grátis você pode ter até ' + lim.fichas_ativas + ' fichas ativas. Arquive uma ou assine o premium.'
          : 'Este aluno está no plano grátis: até ' + lim.fichas_ativas + ' fichas ativas. Arquive uma antes.');
      }
    }
    var visiveis = exerciciosVisiveis_(u);
    var doAluno = exerciciosVisiveis_(aluno);
    itens.forEach(function (i) {
      if (!visiveis[i.exercicio_id] && !doAluno[i.exercicio_id]) throw erro_('VALIDACAO', 'Exercício não encontrado no catálogo.');
    });

    var ficha = atual
      ? atualizarSemBloqueio_('fichas', fichaId, { nome: nome, ativa: ativa, ordem: ordem })
      : inserirSemBloqueio_('fichas', { id: fichaId, aluno_id: aluno.id, autor_id: u.id, nome: nome, ordem: ordem, ativa: ativa });

    var existentes = lerTodos_('ficha_itens', true);
    var porId = {};
    existentes.forEach(function (i) { porId[i.id] = i; });
    itens.forEach(function (i) {
      var e = porId[i.id];
      if (e && e.ficha_id !== fichaId) throw erro_('PROIBIDO', 'Item de outra ficha.');
      i.excluido_em = null;
    });
    var mantidos = {};
    itens.forEach(function (i) { mantidos[i.id] = true; });
    var t = agora_();
    var removidos = existentes
      .filter(function (i) { return i.ficha_id === fichaId && !i.excluido_em && !mantidos[i.id]; })
      .map(function (i) { return { id: i.id, excluido_em: t }; });
    upsertLoteSemBloqueio_('ficha_itens', itens.concat(removidos));
    return { ficha: publico_(ficha, []), itens: itens.length, removidos: removidos.length };
  });
}

function excluirFicha_(d, ctx) {
  var u = ctx.usuario;
  var id = id_(d.id, 'ficha');
  return comBloqueio_(function () {
    var f = buscarUm_('fichas', { id: id });
    if (!f || (f.aluno_id !== u.id && f.autor_id !== u.id)) throw erro_('NAO_ENCONTRADO', 'Ficha não encontrada.');
    if (!podeEditarFicha_(f, u)) throw erro_('PROIBIDO', 'Esta ficha foi prescrita pelo seu personal. Peça a ele para alterar.');
    atualizarSemBloqueio_('fichas', id, { excluido_em: agora_(), ativa: false });
    return { excluida: id };
  });
}

// ---------- treinos (sincronização do aparelho) ----------

/**
 * Recebe o que foi feito no aparelho, de uma vez:
 *   { sessoes: [...], series: [...], ajustes: [...] }
 * Pode ser enviado de novo sem duplicar nada (os ids vêm do aparelho).
 * Ajuste = o aluno decidiu subir a carga ou as repetições de um exercício da ficha.
 */
function sincronizarTreino_(d, ctx) {
  var u = ctx.usuario;
  var sessoes = lista_(d.sessoes, 'sessões', APP.MAX_LOTE_SESSOES).map(function (s) {
    var r = {
      id: id_(s.id, 'sessão'),
      ficha_id: idOpcional_(s.ficha_id, 'ficha'),
      inicio: dataIso_(s.inicio, 'início'),
      fim: dataIso_(s.fim, 'fim', true),
      observacao: texto_(s.observacao, 'observação', 0, 500, false)
    };
    if (s.excluido) r.excluido_em = agora_();
    return r;
  });
  var series = lista_(d.series, 'séries', APP.MAX_LOTE_SERIES).map(function (s) {
    var r = {
      id: id_(s.id, 'série'),
      sessao_id: id_(s.sessao_id, 'sessão'),
      exercicio_id: id_(s.exercicio_id, 'exercício'),
      ordem: numero_(s.ordem, 'ordem', 0, 999, false),
      tipo: opcao_(s.tipo || 'normal', 'tipo de série', APP.TIPOS_SERIE),
      reps: numero_(s.reps, 'repetições', 0, 500, true),
      carga_kg: numero_(s.carga_kg, 'carga', 0, 1000, true),
      rpe: numero_(s.rpe, 'esforço', 0, 10, true)
    };
    r.excluido_em = s.excluido ? agora_() : null;
    return r;
  });
  var ajustes = lista_(d.ajustes, 'ajustes', 500).map(function (a) {
    var campo = opcao_(a.campo, 'campo do ajuste', ['carga_atual_kg', 'reps_atuais']);
    return {
      id: id_(a.id, 'ajuste'),
      ficha_item_id: id_(a.ficha_item_id, 'item'),
      campo: campo,
      valor_novo: campo === 'carga_atual_kg'
        ? numero_(a.valor_novo, 'nova carga', 0, 1000, false)
        : texto_(String(a.valor_novo == null ? '' : a.valor_novo), 'novas repetições', 1, 40, true)
    };
  });

  return comBloqueio_(function () {
    // sessões: só do próprio aluno; ficha (se houver) precisa ser dele
    var minhasFichas = {};
    buscar_('fichas', { aluno_id: u.id }, true).forEach(function (f) { minhasFichas[f.id] = true; });
    sessoes.forEach(function (s) {
      if (s.ficha_id && !minhasFichas[s.ficha_id]) throw erro_('PROIBIDO', 'Ficha de outra pessoa.');
    });
    var rSess = upsertLoteSemBloqueio_('sessoes', sessoes, {
      fixos: { aluno_id: u.id },
      podeAlterar: function (atual) { return atual.aluno_id === u.id; }
    });

    // séries: a sessão precisa ser do aluno (já gravada ou chegando agora)
    var minhasSessoes = {};
    buscar_('sessoes', { aluno_id: u.id }, true).forEach(function (s) { minhasSessoes[s.id] = true; });
    var visiveis = exerciciosVisiveis_(u);
    series.forEach(function (s) {
      if (!minhasSessoes[s.sessao_id]) throw erro_('PROIBIDO', 'Sessão de outra pessoa.');
      if (!visiveis[s.exercicio_id]) throw erro_('VALIDACAO', 'Exercício não encontrado no catálogo.');
    });
    var rSer = upsertLoteSemBloqueio_('series', series, {
      podeAlterar: function (atual) { return !!minhasSessoes[atual.sessao_id]; }
    });

    // ajustes: aplicados na ficha; cada ajuste só vale uma vez
    var rAj = { criados: 0, ignorados: 0 };
    if (ajustes.length) {
      var jaFeitos = {};
      lerTodos_('ajustes', true).forEach(function (a) { jaFeitos[a.id] = a; });
      var itens = {};
      lerTodos_('ficha_itens', true).forEach(function (i) { itens[i.id] = i; });
      var novosAjustes = [];
      var mudancas = {};
      ajustes.forEach(function (a) {
        if (jaFeitos[a.id]) {
          if (jaFeitos[a.id].aluno_id !== u.id) throw erro_('PROIBIDO', 'Ajuste de outra pessoa.');
          rAj.ignorados++;
          return;
        }
        var item = itens[a.ficha_item_id];
        if (!item || !minhasFichas[item.ficha_id]) throw erro_('PROIBIDO', 'Exercício de outra ficha.');
        var atual = mudancas[item.id] || { id: item.id };
        var anterior = atual[a.campo] !== undefined ? atual[a.campo] : item[a.campo];
        atual[a.campo] = a.valor_novo;
        mudancas[item.id] = atual;
        novosAjustes.push({
          id: a.id, ficha_item_id: item.id, aluno_id: u.id, campo: a.campo,
          valor_anterior: anterior === null || anterior === undefined ? '' : String(anterior),
          valor_novo: String(a.valor_novo), visto_pelo_personal: false
        });
      });
      upsertLoteSemBloqueio_('ajustes', novosAjustes);
      upsertLoteSemBloqueio_('ficha_itens', Object.keys(mudancas).map(function (k) { return mudancas[k]; }));
      rAj.criados = novosAjustes.length;
    }
    return { sessoes: rSess, series: rSer, ajustes: rAj, servidor_em: agora_() };
  });
}

// ---------- histórico ----------

/**
 * Sessões do aluno com as séries de cada uma.
 * dados.desde (opcional, ISO): só o que mudou depois dessa hora, para o app atualizar o que já tem.
 * O histórico completo aparece nos dois planos; exportar é só no premium (rota própria, fase 3).
 */
function listarHistorico_(d, ctx) {
  var h = historicoDe_(ctx.usuario.id, dataIso_(d.desde, 'desde', true));
  h.limites = limites_(ctx);
  return h;
}

function historicoDe_(alunoId, desde) {
  var sessoes = buscar_('sessoes', { aluno_id: alunoId }, !!desde);
  var ids = {};
  sessoes.forEach(function (s) { ids[s.id] = true; });
  var series = lerTodos_('series', !!desde).filter(function (s) { return ids[s.sessao_id]; });
  if (desde) {
    sessoes = sessoes.filter(function (s) { return s.atualizado_em > desde; });
    series = series.filter(function (s) { return s.atualizado_em > desde; });
  }
  return {
    servidor_em: agora_(),
    sessoes: sessoes.map(function (s) { return publico_(s, []); }).sort(function (a, b) { return a.inicio < b.inicio ? 1 : -1; }),
    series: series.map(function (s) { return publico_(s, []); })
  };
}


// ===== 09_Importacao.gs =====
/**
 * Importação da planilha antiga (abas PLANO_ATUAL e LOGS_TREINO) para a conta de um aluno.
 *
 * Como usar (só o administrador):
 *   1. Abra o arquivo .xlsx antigo no Google Drive e use Arquivo > Salvar como Planilhas Google.
 *   2. Copie o ID da planilha nova (o trecho longo do endereço, entre /d/ e /edit).
 *   3. No app, Painel > Importar planilha antiga: veja a prévia e confirme.
 *      Ou, no editor do Apps Script: preencha IMPORTAR_PLANILHA_ID e IMPORTAR_EMAIL nas
 *      Propriedades do script e rode previaImportacao() e depois importarPlanilhaAntiga().
 *
 * Pode rodar de novo: os ids são calculados a partir do conteúdo, então nada é duplicado.
 * Fichas e exercícios da ficha que já existem não são sobrescritos (as suas mudanças ficam).
 *
 * Datas: a planilha antiga guardava a hora local sem fuso; usamos -03:00 (Brasília/Fortaleza).
 */
var IMPORTACAO_ = { FUSO: '-03:00', METODOS: { 'drop-set': 'drop-set', 'rest-pause': 'rest-pause', 'bi-set': 'bi-set', 'tri-set': 'tri-set' } };

function previaImportacao() {
  var r = importarPlanilhaAntiga_({ planilha_id: prop_('IMPORTAR_PLANILHA_ID', true), email: prop_('IMPORTAR_EMAIL', true) }, true);
  console.log(JSON.stringify(r, null, 2));
  return r;
}

function importarPlanilhaAntiga() {
  var r = importarPlanilhaAntiga_({ planilha_id: prop_('IMPORTAR_PLANILHA_ID', true), email: prop_('IMPORTAR_EMAIL', true) }, false);
  console.log(JSON.stringify(r.resumo, null, 2));
  return r;
}

/**
 * dados: { planilha_id, email, renomear?: { "nome antigo": "nome novo" }, separar_reps?: true }
 * separar_reps: na planilha antiga, valores como "42.510kg" eram carga e repetições juntas
 * (42,5 kg × 10). Com true (padrão), o app separa os dois.
 */
function importarPlanilhaAntiga_(d, soPrevia, quem) {
  var planilhaId = texto_(d.planilha_id, 'ID da planilha', 20, 100, true);
  if (!/^[A-Za-z0-9_-]+$/.test(planilhaId)) throw erro_('VALIDACAO', 'ID da planilha inválido.');
  var email = email_(d.email);
  var separarReps = d.separar_reps !== false;
  var renomear = {};
  if (d.renomear && typeof d.renomear === 'object') {
    Object.keys(d.renomear).slice(0, 100).forEach(function (k) {
      renomear[normalizarNome_(k)] = texto_(d.renomear[k], 'novo nome', 2, 80, true);
    });
  }

  var aluno = buscarUm_('usuarios', { email: email });
  if (!aluno) throw erro_('NAO_ENCONTRADO', 'Nenhuma conta com o e-mail ' + email + '. Cadastre a conta antes de importar.');

  var antiga;
  try { antiga = SpreadsheetApp.openById(planilhaId); }
  catch (x) { throw erro_('NAO_ENCONTRADO', 'Não consegui abrir a planilha antiga. Confira o ID e se ela está no seu Google Drive.'); }
  var fusoPlanilha = antiga.getSpreadsheetTimeZone ? antiga.getSpreadsheetTimeZone() : 'America/Fortaleza';
  var plano = lerAbaAntiga_(antiga, 'PLANO_ATUAL', ['divisao', 'nome_exercicio']);
  var logs = lerAbaAntiga_(antiga, 'LOGS_TREINO', ['data_hora', 'divisao_realizada', 'nome_exercicio', 'carga_utilizada']);

  var relatorio = { separados: {}, revisar: {}, sem_carga: 0 };
  var nomeFinal = function (bruto) {
    var n = String(bruto == null ? '' : bruto).replace(/\s+/g, ' ').trim();
    return renomear[normalizarNome_(n)] || n;
  };

  // ----- exercícios -----
  var catalogo = {};
  lerTodos_('exercicios').forEach(function (e) { if (e.global) catalogo[normalizarNome_(e.nome)] = e; });
  var exercicios = {};    // chave normalizada -> registro
  var gruposPorNome = {};
  plano.forEach(function (p) { if (p.grupo_muscular) gruposPorNome[normalizarNome_(nomeFinal(p.nome_exercicio))] = String(p.grupo_muscular).trim(); });
  function exercicio(nomeBruto) {
    var nome = nomeFinal(nomeBruto);
    var chave = normalizarNome_(nome);
    if (!chave) return null;
    if (!exercicios[chave]) {
      var existe = catalogo[chave];
      exercicios[chave] = existe
        ? { id: existe.id, nome: existe.nome, novo: false }
        : { id: idImportacao_('ex', chave), nome: nome, novo: true, grupo_muscular: gruposPorNome[chave] || '', usos: 0 };
    }
    return exercicios[chave];
  }

  // ----- fichas (uma por divisão: A, B, C...) -----
  var fichas = {};
  var itens = [];
  plano
    .slice()
    .sort(function (a, b) { return String(a.divisao).localeCompare(String(b.divisao)) || (Number(a.ordem) || 0) - (Number(b.ordem) || 0); })
    .forEach(function (p) {
      var div = String(p.divisao || '').trim().toUpperCase();
      var ex = exercicio(p.nome_exercicio);
      if (!div || !ex) return;
      if (!fichas[div]) {
        fichas[div] = { id: idImportacao_('fi', aluno.id + '|' + div), aluno_id: aluno.id, autor_id: aluno.id, nome: 'Treino ' + div, ordem: Object.keys(fichas).length + 1, ativa: true, _itens: 0 };
      }
      var f = fichas[div];
      f._itens++;
      var metodo = IMPORTACAO_.METODOS[normalizarNome_(p.metodo_avancado).replace(/\s+/g, '-')] || (p.metodo_avancado ? 'outro' : '');
      var reps = p.repeticoes === null || p.repeticoes === '' || p.repeticoes === undefined ? '' : String(p.repeticoes).trim();
      var repsNum = /^\d+$/.test(reps) ? Number(reps) : null;
      itens.push({
        id: idImportacao_('it', aluno.id + '|' + div + '|' + normalizarNome_(ex.nome)),
        ficha_id: f.id, exercicio_id: ex.id, ordem: f._itens,
        series: Math.max(1, Math.round(Number(p.series) || 1)),
        reps_prescritas: reps.slice(0, 40), reps_min: repsNum, reps_max: repsNum,
        carga_prescrita_kg: numeroOuNulo_(p.carga_sugerida), aumento_max_kg: null,
        carga_atual_kg: null, reps_atuais: '',
        descanso_seg: numeroOuNulo_(p.intervalo_seg), metodo: metodo,
        observacoes: String(p.observacoes || '').trim().slice(0, 500),
        _div: div, _chave: normalizarNome_(ex.nome)
      });
    });

  // ----- sessões e séries -----
  var sessoes = {};
  var series = [];
  var ocorrencias = {};
  var ultimaCarga = {}; // div|exercício -> { inicio, carga }
  logs.forEach(function (l) {
    var inicio = dataAntiga_(l.data_hora, fusoPlanilha);
    var div = String(l.divisao_realizada || '').trim().toUpperCase();
    var ex = exercicio(l.nome_exercicio);
    if (!inicio || !ex) return;
    var chaveSessao = inicio + '|' + div;
    if (!sessoes[chaveSessao]) {
      sessoes[chaveSessao] = {
        id: idImportacao_('se', aluno.id + '|' + chaveSessao),
        aluno_id: aluno.id, ficha_id: fichas[div] ? fichas[div].id : null,
        inicio: inicio, fim: inicio, observacao: 'Importado da planilha antiga (treino ' + (div || '?') + ').', _n: 0
      };
    }
    var s = sessoes[chaveSessao];
    s._n++;
    var chaveEx = chaveSessao + '|' + normalizarNome_(ex.nome);
    ocorrencias[chaveEx] = (ocorrencias[chaveEx] || 0) + 1;
    if (ex.novo) ex.usos++;
    var textos = typeof l.carga_utilizada === 'number' ? [String(l.carga_utilizada)] : String(l.carga_utilizada || '').split('/');
    var maior = null;
    textos.forEach(function (t, i) {
      var c = lerCargaAntiga_(t, separarReps);
      if (c.situacao === 'separado') contarNoRelatorio_(relatorio.separados, t.trim(), ex.nome, c);
      if (c.situacao === 'revisar') contarNoRelatorio_(relatorio.revisar, t.trim(), ex.nome, c);
      if (c.carga === null) relatorio.sem_carga++;
      if (c.carga !== null && (maior === null || c.carga > maior)) maior = c.carga;
      series.push({
        id: idImportacao_('sr', aluno.id + '|' + chaveEx + '|' + ocorrencias[chaveEx] + '|' + i),
        sessao_id: s.id, exercicio_id: ex.id, ordem: s._n * 100 + i + 1, tipo: 'normal',
        reps: c.reps, carga_kg: c.carga, rpe: numeroOuNulo_(l.percepcao_esforco)
      });
    });
    var chaveUlt = div + '|' + normalizarNome_(ex.nome);
    if (maior !== null && maior > 0 && (!ultimaCarga[chaveUlt] || ultimaCarga[chaveUlt].inicio <= inicio)) {
      ultimaCarga[chaveUlt] = { inicio: inicio, carga: maior };
    }
  });
  itens.forEach(function (i) {
    var u = ultimaCarga[i._div + '|' + i._chave];
    if (u) i.carga_atual_kg = u.carga;
  });

  var listaSessoes = Object.keys(sessoes).map(function (k) { return sessoes[k]; });
  var datas = listaSessoes.map(function (s) { return s.inicio; }).sort();
  var resumo = {
    aluno: { nome: aluno.nome, email: aluno.email },
    periodo: datas.length ? { de: datas[0], ate: datas[datas.length - 1] } : null,
    fichas: Object.keys(fichas).map(function (k) { return { nome: fichas[k].nome, exercicios: fichas[k]._itens }; }),
    exercicios_novos: Object.keys(exercicios).filter(function (k) { return exercicios[k].novo; }).length,
    exercicios_existentes: Object.keys(exercicios).filter(function (k) { return !exercicios[k].novo; }).length,
    sessoes: listaSessoes.length,
    series: series.length,
    series_sem_carga: relatorio.sem_carga
  };
  var saida = {
    resumo: resumo,
    exercicios: Object.keys(exercicios).sort().map(function (k) {
      var e = exercicios[k];
      return { nome: e.nome, novo: e.novo, grupo_muscular: e.grupo_muscular || '', parecidos: parecidos_(k, exercicios) };
    }),
    cargas_separadas: listaRelatorio_(relatorio.separados),
    cargas_para_revisar: listaRelatorio_(relatorio.revisar)
  };
  if (soPrevia) return saida;

  saida.gravado = comBloqueio_(function () {
    var admin = quem || buscarUm_('usuarios', { email: prop_('ADMIN_EMAIL', false).toLowerCase() });
    var novosEx = Object.keys(exercicios).map(function (k) { return exercicios[k]; }).filter(function (e) { return e.novo; })
      .map(function (e) { return { id: e.id, nome: e.nome, grupo_muscular: e.grupo_muscular, equipamento: '', video_url: '', criado_por: admin ? admin.id : aluno.id, global: true }; });
    var jaExistem = {};
    lerTodos_('fichas', true).forEach(function (f) { jaExistem[f.id] = f; });
    lerTodos_('ficha_itens', true).forEach(function (i) { jaExistem[i.id] = i; });
    lerTodos_('exercicios', true).forEach(function (e) { jaExistem[e.id] = e; });
    var limpar = function (o) { return publico_(o, []); };
    var r = {
      exercicios: upsertLoteSemBloqueio_('exercicios', novosEx.filter(function (e) { return !jaExistem[e.id]; })),
      fichas: upsertLoteSemBloqueio_('fichas', Object.keys(fichas).map(function (k) { return limpar(fichas[k]); }).filter(function (f) { return !jaExistem[f.id]; })),
      itens: upsertLoteSemBloqueio_('ficha_itens', itens.map(limpar).filter(function (i) { return !jaExistem[i.id]; })),
      sessoes: upsertLoteSemBloqueio_('sessoes', listaSessoes.map(limpar), { podeAlterar: function (a) { return a.aluno_id === aluno.id; } }),
      series: upsertLoteSemBloqueio_('series', series)
    };
    // Conta do dono dos dados antigos vira premium sem prazo (cortesia), se ainda não tiver.
    var idLic = idImportacao_('li', aluno.id);
    if (!buscarUm_('licencas', { id: idLic }, true)) {
      inserirSemBloqueio_('licencas', { id: idLic, usuario_id: aluno.id, origem: 'cortesia', inicio: agora_(), fim: null, concedida_por: admin ? admin.id : null, pedido_id: null });
      r.licenca = 'premium sem prazo concedido';
    } else {
      r.licenca = 'já existia';
    }
    inserirSemBloqueio_('auditoria', { usuario_id: admin ? admin.id : '', acao: 'importacao.planilha_antiga', alvo: aluno.id, detalhes: JSON.stringify(resumo).slice(0, 2000) });
    return r;
  });
  return saida;
}

// ---------- ajudantes da importação ----------

function lerAbaAntiga_(ss, nome, obrigatorias) {
  var aba = ss.getSheetByName(nome);
  if (!aba) throw erro_('VALIDACAO', 'A planilha antiga não tem a aba ' + nome + '.');
  var valores = aba.getDataRange().getValues();
  if (!valores.length) return [];
  var cab = valores[0].map(function (c) { return String(c).trim(); });
  obrigatorias.forEach(function (c) {
    if (cab.indexOf(c) < 0) throw erro_('VALIDACAO', 'Coluna ' + c + ' não encontrada na aba ' + nome + '.');
  });
  var lista = [];
  for (var i = 1; i < valores.length; i++) {
    var o = {};
    var vazio = true;
    cab.forEach(function (c, j) { o[c] = valores[i][j]; if (valores[i][j] !== '' && valores[i][j] !== null) vazio = false; });
    if (!vazio) lista.push(o);
  }
  return lista;
}

/** Hora da planilha antiga -> ISO em UTC, tratando o horário como -03:00. */
function dataAntiga_(v, fusoPlanilha) {
  var local;
  if (v instanceof Date || (v && typeof v.getTime === 'function')) {
    if (isNaN(v.getTime())) return null;
    local = Utilities.formatDate(v, fusoPlanilha, "yyyy-MM-dd'T'HH:mm:ss");
  } else {
    var m = String(v || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) local = m[3] + '-' + pad2_(m[2]) + '-' + pad2_(m[1]) + 'T' + pad2_(m[4]) + ':' + m[5] + ':' + (m[6] || '00');
    else if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(String(v || '').trim())) local = String(v).trim().replace(' ', 'T');
    else return null;
    if (local.length === 16) local += ':00';
  }
  var t = new Date(local + IMPORTACAO_.FUSO);
  return isNaN(t.getTime()) ? null : t.toISOString();
}

function pad2_(n) { return ('0' + n).slice(-2); }

function numeroOuNulo_(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = Number(String(v).replace(',', '.'));
  return isFinite(n) ? n : null;
}

/**
 * Lê um valor de carga da planilha antiga: "42.5kg", "-", "42.510kg" (= 42,5 kg × 10 repetições).
 * Decimais normais de anilha: ,5 ,25 ,75 (e ,125 etc.). Sobrando exatamente 2 dígitos (01 a 30),
 * eles são as repetições. O que não se encaixa fica como está e vai para a lista "revisar".
 */
function lerCargaAntiga_(texto, separarReps) {
  var t = String(texto == null ? '' : texto).trim().toLowerCase().replace(/\s+/g, '').replace(/kg$/, '').replace(',', '.');
  if (t === '' || t === '-' || t === '—') return { carga: null, reps: null, situacao: 'vazio' };
  var m = t.match(/^(\d{1,4})(?:\.(\d{1,6}))?$/);
  if (!m) return { carga: null, reps: null, situacao: 'revisar' };
  var inteiro = m[1];
  var dec = m[2] || '';
  var normais = ['', '0', '00', '000', '5', '50', '500', '25', '250', '75', '750', '125', '375', '625', '875'];
  if (normais.indexOf(dec) >= 0) {
    var c0 = Number(inteiro + (dec ? '.' + dec : ''));
    return { carga: c0 > 0 ? c0 : null, reps: null, situacao: c0 > 0 ? 'ok' : 'vazio' };
  }
  if (separarReps) {
    var prefixos = ['25', '75', '5', ''];
    for (var i = 0; i < prefixos.length; i++) {
      var p = prefixos[i];
      if (dec.indexOf(p) !== 0 || dec.length - p.length !== 2) continue;
      var reps = Number(dec.slice(p.length));
      if (reps >= 1 && reps <= 30) {
        return { carga: Number(inteiro + (p ? '.' + p : '')), reps: reps, situacao: 'separado' };
      }
    }
  }
  return { carga: Number(inteiro + '.' + dec), reps: null, situacao: 'revisar' };
}

function contarNoRelatorio_(mapa, texto, exercicio, c) {
  var k = texto + '|' + exercicio;
  if (!mapa[k]) mapa[k] = { texto: texto, exercicio: exercicio, carga_kg: c.carga, reps: c.reps, vezes: 0 };
  mapa[k].vezes++;
}

function listaRelatorio_(mapa) {
  return Object.keys(mapa).map(function (k) { return mapa[k]; })
    .sort(function (a, b) { return a.exercicio.localeCompare(b.exercicio, 'pt-BR') || a.texto.localeCompare(b.texto); });
}

/** Nomes que podem ser o mesmo exercício escrito de outro jeito (para você conferir). */
function parecidos_(chave, todos) {
  var palavras = chave.split(' ').filter(function (p) { return p.length > 2; });
  return Object.keys(todos).filter(function (k) {
    if (k === chave) return false;
    if (k.indexOf(chave) >= 0 || chave.indexOf(k) >= 0) return true;
    var outras = k.split(' ').filter(function (p) { return p.length > 2; });
    var comuns = palavras.filter(function (p) { return outras.indexOf(p) >= 0; }).length;
    return comuns >= 2 && comuns >= Math.min(palavras.length, outras.length);
  }).map(function (k) { return todos[k].nome; });
}

function idImportacao_(tipo, chave) {
  return 'imp_' + tipo + '_' + sha256_('importacao|' + tipo + '|' + chave).slice(0, 24);
}


// ===== 10_Pessoas.gs =====
/**
 * Fase 2: convites, vínculo personal–aluno, acompanhamento pelo personal e comentários.
 *
 * Convite = código de 8 letras/números (ou link com o código) que vale 7 dias.
 * Só o hash do código fica na planilha; quem cria vê o código uma única vez.
 * O aluno precisa aceitar: é ele quem autoriza o personal a ver os treinos dele.
 */
var ALFABETO_CONVITE_ = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I, que se confundem

// ---------- vínculo ----------

function vinculoAtivo_(personalId, alunoId) {
  if (!personalId || !alunoId || personalId === alunoId) return false;
  var p = buscarUm_('usuarios', { id: personalId });
  if (!p || !p.ativo || !p.personal_ativo) return false;
  return buscar_('vinculos_personal', { personal_id: personalId, aluno_id: alunoId })
    .some(function (v) { return v.status === 'ativo'; });
}

function exigirAlunoDoPersonal_(ctx, alunoId) {
  var u = ctx.usuario;
  if (!u.personal_ativo && !u.admin) throw erro_('PROIBIDO', 'Sem permissão.');
  var aluno = buscarUm_('usuarios', { id: id_(alunoId, 'aluno') });
  if (!aluno) throw erro_('NAO_ENCONTRADO', 'Aluno não encontrado.');
  if (!vinculoAtivo_(u.id, aluno.id)) throw erro_('PROIBIDO', 'Esta pessoa não é sua aluna.');
  return aluno;
}

/** Plano do aluno decide o limite de fichas, mesmo quando é o personal quem prescreve. */
function limitesDoAluno_(aluno) {
  var gratis = planoAtual_(aluno).tipo !== 'premium';
  return { plano: gratis ? 'gratis' : 'premium', fichas_ativas: gratis ? APP.LIMITE_FICHAS_GRATIS : null, dias_grafico: gratis ? APP.DIAS_GRAFICO_GRATIS : null, exportar: !gratis };
}

function meuVinculo_(d, ctx) {
  var u = ctx.usuario;
  var v = buscar_('vinculos_personal', { aluno_id: u.id }).filter(function (x) { return x.status === 'ativo'; })[0];
  if (!v) return { personal: null };
  var p = buscarUm_('usuarios', { id: v.personal_id });
  return { personal: p ? { vinculo_id: v.id, nome: p.nome, email: p.email, desde: v.inicio, ativo: !!(p.ativo && p.personal_ativo) } : null };
}

/** Qualquer um dos dois lados pode encerrar. As fichas ficam com o aluno, que passa a poder alterá-las. */
function encerrarVinculo_(d, ctx) {
  var u = ctx.usuario;
  var id = id_(d.vinculo_id, 'vínculo');
  return comBloqueio_(function () {
    var v = buscarUm_('vinculos_personal', { id: id });
    if (!v || (v.aluno_id !== u.id && v.personal_id !== u.id) || v.status !== 'ativo') throw erro_('NAO_ENCONTRADO', 'Vínculo não encontrado.');
    atualizarSemBloqueio_('vinculos_personal', id, { status: 'encerrado', fim: agora_() });
    inserirSemBloqueio_('auditoria', { usuario_id: u.id, acao: 'vinculo.encerrar', alvo: id, detalhes: '' });
    return { encerrado: id };
  });
}

// ---------- convites ----------

function gerarCodigo_() {
  var bytes = bytesAleatorios_(8);
  return bytes.map(function (b) { return ALFABETO_CONVITE_.charAt((b & 0xff) % ALFABETO_CONVITE_.length); }).join('');
}

function normalizarCodigo_(c) {
  var t = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (t.length !== 8) throw erro_('VALIDACAO', 'O código tem 8 letras e números.');
  return t;
}

/**
 * dados: { tipo: 'personal' } (personal convida aluno)
 *     ou { tipo: 'grupo', grupo_id, papel: 'membro' | 'personal' | 'gerente' } (gerente ou admin)
 * usos_max: quantas pessoas podem usar (1 a 50; padrão 1 para personal, 30 para grupo).
 */
function criarConvite_(d, ctx) {
  var u = ctx.usuario;
  var tipo = opcao_(d.tipo, 'tipo de convite', ['personal', 'grupo']);
  var reg = { tipo: tipo, criado_por: u.id, grupo_id: '', papel: 'aluno' };
  if (tipo === 'personal') {
    if (!u.personal_ativo) throw erro_('PROIBIDO', 'Só personal ativo convida alunos.');
  } else {
    var g = exigirGerenteDoGrupo_(ctx, d.grupo_id);
    reg.grupo_id = g.id;
    reg.papel = opcao_(d.papel || 'membro', 'papel no grupo', APP.PAPEIS_GRUPO);
    if (reg.papel === 'gerente' && !u.admin) throw erro_('PROIBIDO', 'Só o administrador define gerentes.');
  }
  reg.usos_max = numero_(d.usos_max, 'quantidade de usos', 1, 50, true) || (tipo === 'grupo' ? 30 : 1);
  var codigo = gerarCodigo_();
  reg.codigo_hash = sha256_('convite|' + codigo);
  reg.final_codigo = codigo.slice(-3);
  reg.expira_em = new Date(Date.now() + APP.CONVITE_DIAS * 864e5).toISOString();
  reg.usos = 0;
  var salvo = inserir_('convites', reg);
  var base = prop_('APP_URL', false) || '';
  return {
    id: salvo.id, codigo: codigo, expira_em: reg.expira_em, usos_max: reg.usos_max,
    link: base ? base.replace(/\/?$/, '/') + '#/convite/' + codigo : ''
  };
}

function listarConvites_(d, ctx) {
  var u = ctx.usuario;
  var agora = agora_();
  return buscar_('convites', { criado_por: u.id })
    .filter(function (c) { return !c.revogado_em && c.expira_em > agora && c.usos < c.usos_max; })
    .map(function (c) { return publico_(c, ['codigo_hash']); });
}

function revogarConvite_(d, ctx) {
  var id = id_(d.id, 'convite');
  return comBloqueio_(function () {
    var c = buscarUm_('convites', { id: id });
    if (!c || (c.criado_por !== ctx.usuario.id && !ctx.usuario.admin)) throw erro_('NAO_ENCONTRADO', 'Convite não encontrado.');
    atualizarSemBloqueio_('convites', id, { revogado_em: agora_() });
    return { revogado: id };
  });
}

function acharConvite_(codigo, u) {
  var chave = 'convite:' + u.id;
  if (tentativasEsgotadas_(chave)) throw erro_('BLOQUEADO', 'Muitos códigos errados. Espere 15 minutos.');
  var hash = sha256_('convite|' + normalizarCodigo_(codigo));
  var c = buscarUm_('convites', { codigo_hash: hash });
  if (!c || c.revogado_em || c.expira_em < agora_() || c.usos >= c.usos_max) {
    contarTentativa_(chave);
    throw erro_('CONVITE_INVALIDO', 'Código inválido ou vencido. Peça um novo a quem convidou.');
  }
  return c;
}

/** Mostra o que o convite faz antes de aceitar. */
function verConvite_(d, ctx) {
  var c = acharConvite_(d.codigo, ctx.usuario);
  var autor = buscarUm_('usuarios', { id: c.criado_por });
  var r = { tipo: c.tipo, papel: c.papel, de: autor ? autor.nome : '', expira_em: c.expira_em };
  if (c.tipo === 'grupo') {
    var g = buscarUm_('grupos', { id: c.grupo_id });
    r.grupo = g ? g.nome : '';
  } else {
    var atual = meuVinculo_({}, ctx).personal;
    r.personal_atual = atual ? atual.nome : null;
  }
  return r;
}

function aceitarConvite_(d, ctx) {
  var u = ctx.usuario;
  var c0 = acharConvite_(d.codigo, u);
  return comBloqueio_(function () {
    var c = buscarUm_('convites', { id: c0.id });
    if (c.usos >= c.usos_max) throw erro_('CONVITE_INVALIDO', 'Este convite já foi usado.');
    if (c.criado_por === u.id) throw erro_('VALIDACAO', 'Este convite é seu. Envie para outra pessoa.');
    var r;
    if (c.tipo === 'personal') {
      var p = buscarUm_('usuarios', { id: c.criado_por });
      if (!p || !p.ativo || !p.personal_ativo) throw erro_('CONVITE_INVALIDO', 'Quem convidou não está mais como personal.');
      // Um personal por vez: aceitar outro encerra o anterior.
      buscar_('vinculos_personal', { aluno_id: u.id }).forEach(function (v) {
        if (v.status === 'ativo' && v.personal_id !== p.id) atualizarSemBloqueio_('vinculos_personal', v.id, { status: 'encerrado', fim: agora_() });
      });
      var ja = buscar_('vinculos_personal', { aluno_id: u.id, personal_id: p.id }).filter(function (v) { return v.status === 'ativo'; })[0];
      if (!ja) inserirSemBloqueio_('vinculos_personal', { personal_id: p.id, aluno_id: u.id, status: 'ativo', inicio: agora_() });
      r = { tipo: 'personal', personal: p.nome };
    } else {
      var g = buscarUm_('grupos', { id: c.grupo_id });
      if (!g) throw erro_('CONVITE_INVALIDO', 'O grupo não existe mais.');
      if (c.papel === 'personal' && !u.personal_ativo) {
        throw erro_('PROIBIDO', 'Este convite é para personal. Peça ao administrador para ativar seu papel de personal.');
      }
      var m = buscar_('membros_grupo', { grupo_id: g.id, usuario_id: u.id })[0];
      if (m) atualizarSemBloqueio_('membros_grupo', m.id, { papel: maiorPapel_(m.papel, c.papel) });
      else inserirSemBloqueio_('membros_grupo', { grupo_id: g.id, usuario_id: u.id, papel: c.papel });
      r = { tipo: 'grupo', grupo: g.nome, papel: c.papel };
    }
    atualizarSemBloqueio_('convites', c.id, { usos: (c.usos || 0) + 1 });
    inserirSemBloqueio_('auditoria', { usuario_id: u.id, acao: 'convite.aceitar', alvo: c.id, detalhes: c.tipo });
    zerarTentativas_('convite:' + u.id);
    return r;
  });
}

function maiorPapel_(a, b) {
  var ordem = ['membro', 'personal', 'gerente'];
  return ordem.indexOf(a) >= ordem.indexOf(b) ? a : b;
}

// ---------- personal: alunos ----------

function listarAlunos_(d, ctx) {
  var u = ctx.usuario;
  if (!u.personal_ativo && !u.admin) throw erro_('PROIBIDO', 'Sem permissão.');
  var vinc = buscar_('vinculos_personal', { personal_id: u.id }).filter(function (v) { return v.status === 'ativo'; });
  if (!vinc.length) return [];
  var ids = {};
  vinc.forEach(function (v) { ids[v.aluno_id] = v; });
  var sessoes = lerTodos_('sessoes').filter(function (s) { return ids[s.aluno_id]; });
  var minhasFichas = {};
  lerTodos_('fichas').forEach(function (f) { if (ids[f.aluno_id]) minhasFichas[f.id] = f.aluno_id; });
  var itemDe = {};
  lerTodos_('ficha_itens').forEach(function (i) { if (minhasFichas[i.ficha_id]) itemDe[i.id] = minhasFichas[i.ficha_id]; });
  var ajustes = lerTodos_('ajustes').filter(function (a) { return ids[a.aluno_id] && !a.visto_pelo_personal; });
  var comentarios = lerTodos_('comentarios').filter(function (c) { return ids[c.aluno_id] && c.autor_id === c.aluno_id && !c.visto; });
  var h7 = new Date(Date.now() - 7 * 864e5).toISOString();
  var h30 = new Date(Date.now() - 30 * 864e5).toISOString();
  return lerTodos_('usuarios')
    .filter(function (a) { return ids[a.id]; })
    .map(function (a) {
      var s = sessoes.filter(function (x) { return x.aluno_id === a.id; });
      var ultima = s.reduce(function (m, x) { return !m || x.inicio > m ? x.inicio : m; }, null);
      return {
        id: a.id, nome: a.nome, email: a.email, vinculo_id: ids[a.id].id, desde: ids[a.id].inicio,
        plano: planoAtual_(a).tipo,
        ultimo_treino: ultima,
        treinos_7d: s.filter(function (x) { return x.inicio >= h7; }).length,
        treinos_30d: s.filter(function (x) { return x.inicio >= h30; }).length,
        ajustes_novos: ajustes.filter(function (x) { return x.aluno_id === a.id; }).length,
        comentarios_novos: comentarios.filter(function (x) { return x.aluno_id === a.id; }).length
      };
    })
    .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
}

/** Tudo o que o personal precisa para acompanhar um aluno. */
function lerAluno_(d, ctx) {
  var aluno = exigirAlunoDoPersonal_(ctx, d.aluno_id);
  var fichas = fichasDe_(aluno.id, ctx.usuario, limitesDoAluno_(aluno));
  var hist = historicoDe_(aluno.id, null);
  var nomes = {};
  lerTodos_('usuarios').forEach(function (x) { nomes[x.id] = x.nome; });
  var itens = {};
  fichas.fichas.forEach(function (f) { f.itens.forEach(function (i) { itens[i.id] = { ficha: f.nome, exercicio_id: i.exercicio_id }; }); });
  // exercícios que aparecem nas fichas e no histórico do aluno, mais os que o personal pode usar
  var vis = exerciciosVisiveis_(ctx.usuario);
  var doAluno = exerciciosVisiveis_(aluno);
  var exercicios = {};
  Object.keys(vis).concat(Object.keys(doAluno)).forEach(function (k) { exercicios[k] = publico_(vis[k] || doAluno[k], []); });
  lerTodos_('exercicios', true).forEach(function (e) {
    if (!exercicios[e.id] && hist.series.some(function (s) { return s.exercicio_id === e.id; })) exercicios[e.id] = publico_(e, []);
  });
  return {
    aluno: { id: aluno.id, nome: aluno.nome, email: aluno.email, plano: planoAtual_(aluno) },
    limites: fichas.limites,
    fichas: fichas.fichas,
    historico: { sessoes: hist.sessoes, series: hist.series },
    exercicios: Object.keys(exercicios).map(function (k) { return exercicios[k]; }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); }),
    ajustes: buscar_('ajustes', { aluno_id: aluno.id })
      .map(function (a) { var r = publico_(a, []); r.ficha = (itens[a.ficha_item_id] || {}).ficha || ''; r.exercicio_id = (itens[a.ficha_item_id] || {}).exercicio_id || ''; return r; })
      .sort(function (a, b) { return a.criado_em < b.criado_em ? 1 : -1; }),
    comentarios: comentariosDe_(aluno.id, nomes)
  };
}

function salvarFichaDoAluno_(d, ctx) {
  var aluno = exigirAlunoDoPersonal_(ctx, d.aluno_id);
  return salvarFichaPara_(ctx.usuario, aluno, d, limitesDoAluno_(aluno));
}

function excluirFichaDoAluno_(d, ctx) {
  var aluno = exigirAlunoDoPersonal_(ctx, d.aluno_id);
  var id = id_(d.id, 'ficha');
  return comBloqueio_(function () {
    var f = buscarUm_('fichas', { id: id });
    if (!f || f.aluno_id !== aluno.id || f.autor_id !== ctx.usuario.id) throw erro_('NAO_ENCONTRADO', 'Só dá para excluir fichas que você prescreveu.');
    atualizarSemBloqueio_('fichas', id, { excluido_em: agora_(), ativa: false });
    return { excluida: id };
  });
}

function marcarAjustesVistos_(d, ctx) {
  var aluno = exigirAlunoDoPersonal_(ctx, d.aluno_id);
  return comBloqueio_(function () {
    var lista = buscar_('ajustes', { aluno_id: aluno.id }).filter(function (a) { return !a.visto_pelo_personal; });
    upsertLoteSemBloqueio_('ajustes', lista.map(function (a) { return { id: a.id, visto_pelo_personal: true }; }));
    return { vistos: lista.length };
  });
}

// ---------- comentários ----------

function comentariosDe_(alunoId, nomes) {
  return buscar_('comentarios', { aluno_id: alunoId })
    .map(function (c) { var r = publico_(c, []); r.autor_nome = nomes[c.autor_id] || ''; return r; })
    .sort(function (a, b) { return a.criado_em < b.criado_em ? -1 : 1; });
}

/** Aluno: os comentários dos treinos dele. Personal: os de um aluno (dados.aluno_id). */
function listarComentarios_(d, ctx) {
  var alunoId = d.aluno_id ? exigirAlunoDoPersonal_(ctx, d.aluno_id).id : ctx.usuario.id;
  var nomes = {};
  lerTodos_('usuarios').forEach(function (x) { nomes[x.id] = x.nome; });
  return comentariosDe_(alunoId, nomes);
}

function criarComentario_(d, ctx) {
  var u = ctx.usuario;
  var sessao = buscarUm_('sessoes', { id: id_(d.sessao_id, 'treino') });
  if (!sessao) throw erro_('NAO_ENCONTRADO', 'Treino não encontrado.');
  if (sessao.aluno_id !== u.id && !vinculoAtivo_(u.id, sessao.aluno_id)) throw erro_('PROIBIDO', 'Sem permissão.');
  var texto = texto_(d.texto, 'comentário', 1, 1000, true);
  var c = inserir_('comentarios', { id: d.id ? id_(d.id) : novoId_(), sessao_id: sessao.id, aluno_id: sessao.aluno_id, autor_id: u.id, texto: texto, visto: false });
  var r = publico_(c, []);
  r.autor_nome = u.nome;
  return r;
}

/** Marca como vistos os comentários escritos pelo outro lado. */
function marcarComentariosVistos_(d, ctx) {
  var u = ctx.usuario;
  var alunoId = d.aluno_id ? exigirAlunoDoPersonal_(ctx, d.aluno_id).id : u.id;
  return comBloqueio_(function () {
    var lista = buscar_('comentarios', { aluno_id: alunoId }).filter(function (c) { return !c.visto && c.autor_id !== u.id; });
    upsertLoteSemBloqueio_('comentarios', lista.map(function (c) { return { id: c.id, visto: true }; }));
    return { vistos: lista.length };
  });
}


// ===== 11_Grupos.gs =====
/**
 * Fase 2: grupos (gerente e membros) e administração (usuários, papéis e catálogo).
 * O gerente vê só um resumo dos membros (quantos treinos fizeram), nunca cargas e séries:
 * os detalhes do treino são do aluno e do personal dele.
 */

// ---------- grupos ----------

function exigirGerenteDoGrupo_(ctx, grupoId) {
  var g = buscarUm_('grupos', { id: id_(grupoId, 'grupo') });
  if (!g) throw erro_('NAO_ENCONTRADO', 'Grupo não encontrado.');
  if (ctx.usuario.admin) return g;
  var m = buscar_('membros_grupo', { grupo_id: g.id, usuario_id: ctx.usuario.id })[0];
  if (!m || m.papel !== 'gerente') throw erro_('PROIBIDO', 'Só o gerente do grupo faz isso.');
  return g;
}

function criarGrupo_(d, ctx) {
  var nome = texto_(d.nome, 'nome do grupo', 2, 60, true);
  var descricao = texto_(d.descricao, 'descrição', 0, 300, false);
  var gerente = null;
  if (d.gerente_email) {
    gerente = buscarUm_('usuarios', { email: email_(d.gerente_email) });
    if (!gerente) throw erro_('NAO_ENCONTRADO', 'Nenhuma conta com esse e-mail. A pessoa precisa se cadastrar antes, ou envie um convite de gerente.');
  }
  return comBloqueio_(function () {
    if (lerTodos_('grupos').some(function (g) { return normalizarNome_(g.nome) === normalizarNome_(nome); })) throw erro_('DUPLICADO', 'Já existe um grupo com esse nome.');
    var g = inserirSemBloqueio_('grupos', { nome: nome, descricao: descricao });
    if (gerente) inserirSemBloqueio_('membros_grupo', { grupo_id: g.id, usuario_id: gerente.id, papel: 'gerente' });
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'grupo.criar', alvo: g.id, detalhes: nome });
    return publico_(g, []);
  });
}

function atualizarGrupo_(d, ctx) {
  var g = exigirGerenteDoGrupo_(ctx, d.id);
  var campos = {};
  if (d.nome !== undefined) campos.nome = texto_(d.nome, 'nome do grupo', 2, 60, true);
  if (d.descricao !== undefined) campos.descricao = texto_(d.descricao, 'descrição', 0, 300, false);
  return publico_(atualizar_('grupos', g.id, campos), []);
}

function excluirGrupo_(d, ctx) {
  var g = buscarUm_('grupos', { id: id_(d.id, 'grupo') });
  if (!g) throw erro_('NAO_ENCONTRADO', 'Grupo não encontrado.');
  return comBloqueio_(function () {
    var t = agora_();
    atualizarSemBloqueio_('grupos', g.id, { excluido_em: t });
    upsertLoteSemBloqueio_('membros_grupo', buscar_('membros_grupo', { grupo_id: g.id }).map(function (m) { return { id: m.id, excluido_em: t }; }));
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'grupo.excluir', alvo: g.id, detalhes: g.nome });
    return { excluido: g.id };
  });
}

/** Admin: todos. Outros: os grupos de que participa, com o papel. */
function listarGrupos_(d, ctx) {
  var u = ctx.usuario;
  var membros = lerTodos_('membros_grupo');
  var meus = {};
  membros.forEach(function (m) { if (m.usuario_id === u.id) meus[m.grupo_id] = m.papel; });
  return lerTodos_('grupos')
    .filter(function (g) { return u.admin || meus[g.id]; })
    .map(function (g) {
      var r = publico_(g, []);
      r.meu_papel = meus[g.id] || (u.admin ? 'admin' : null);
      r.membros = membros.filter(function (m) { return m.grupo_id === g.id; }).length;
      return r;
    })
    .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
}

/** Gerente e admin: membros com resumo de frequência. Membro comum: só nome do grupo e do gerente. */
function lerGrupo_(d, ctx) {
  var u = ctx.usuario;
  var g = buscarUm_('grupos', { id: id_(d.id, 'grupo') });
  if (!g) throw erro_('NAO_ENCONTRADO', 'Grupo não encontrado.');
  var membros = buscar_('membros_grupo', { grupo_id: g.id });
  var eu = membros.filter(function (m) { return m.usuario_id === u.id; })[0];
  if (!eu && !u.admin) throw erro_('PROIBIDO', 'Você não participa deste grupo.');
  var usuarios = {};
  lerTodos_('usuarios').forEach(function (x) { usuarios[x.id] = x; });
  var gerentes = membros.filter(function (m) { return m.papel === 'gerente'; }).map(function (m) { return (usuarios[m.usuario_id] || {}).nome; });
  var base = { grupo: publico_(g, []), meu_papel: eu ? eu.papel : 'admin', gerentes: gerentes.filter(Boolean) };
  if (!u.admin && eu.papel !== 'gerente') return base;

  var ids = {};
  membros.forEach(function (m) { ids[m.usuario_id] = true; });
  var sessoes = lerTodos_('sessoes').filter(function (s) { return ids[s.aluno_id]; });
  var h7 = new Date(Date.now() - 7 * 864e5).toISOString();
  var h30 = new Date(Date.now() - 30 * 864e5).toISOString();
  base.membros = membros.map(function (m) {
    var p = usuarios[m.usuario_id] || {};
    var s = sessoes.filter(function (x) { return x.aluno_id === m.usuario_id; });
    return {
      id: m.id, usuario_id: m.usuario_id, nome: p.nome || '(conta removida)', email: p.email || '', papel: m.papel,
      desde: m.criado_em,
      treinos_7d: s.filter(function (x) { return x.inicio >= h7; }).length,
      treinos_30d: s.filter(function (x) { return x.inicio >= h30; }).length,
      ultimo_treino: s.reduce(function (mx, x) { return !mx || x.inicio > mx ? x.inicio : mx; }, null)
    };
  }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
  base.resumo = {
    membros: membros.length,
    ativos_7d: base.membros.filter(function (m) { return m.treinos_7d > 0; }).length,
    treinos_30d: base.membros.reduce(function (t, m) { return t + m.treinos_30d; }, 0)
  };
  base.convites = buscar_('convites', { grupo_id: g.id })
    .filter(function (c) { return !c.revogado_em && c.expira_em > agora_() && c.usos < c.usos_max; })
    .map(function (c) { return publico_(c, ['codigo_hash']); });
  return base;
}

function definirPapelMembro_(d, ctx) {
  var g = exigirGerenteDoGrupo_(ctx, d.grupo_id);
  var papel = opcao_(d.papel, 'papel no grupo', APP.PAPEIS_GRUPO);
  if (papel === 'gerente' && !ctx.usuario.admin) throw erro_('PROIBIDO', 'Só o administrador define gerentes.');
  return comBloqueio_(function () {
    var m = buscarUm_('membros_grupo', { id: id_(d.membro_id, 'membro') });
    if (!m || m.grupo_id !== g.id) throw erro_('NAO_ENCONTRADO', 'Membro não encontrado.');
    if (m.papel === 'gerente' && !ctx.usuario.admin) throw erro_('PROIBIDO', 'Só o administrador muda um gerente.');
    if (papel === 'personal') {
      var p = buscarUm_('usuarios', { id: m.usuario_id });
      if (!p || !p.personal_ativo) throw erro_('VALIDACAO', 'Esta pessoa não tem o papel de personal ativo.');
    }
    atualizarSemBloqueio_('membros_grupo', m.id, { papel: papel });
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'grupo.papel', alvo: m.id, detalhes: papel });
    return { membro_id: m.id, papel: papel };
  });
}

function removerMembro_(d, ctx) {
  var g = exigirGerenteDoGrupo_(ctx, d.grupo_id);
  return comBloqueio_(function () {
    var m = buscarUm_('membros_grupo', { id: id_(d.membro_id, 'membro') });
    if (!m || m.grupo_id !== g.id) throw erro_('NAO_ENCONTRADO', 'Membro não encontrado.');
    if (m.papel === 'gerente' && !ctx.usuario.admin) throw erro_('PROIBIDO', 'Só o administrador remove um gerente.');
    atualizarSemBloqueio_('membros_grupo', m.id, { excluido_em: agora_() });
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'grupo.remover', alvo: m.id, detalhes: m.usuario_id });
    return { removido: m.id };
  });
}

function sairDoGrupo_(d, ctx) {
  var gid = id_(d.grupo_id, 'grupo');
  return comBloqueio_(function () {
    var m = buscar_('membros_grupo', { grupo_id: gid, usuario_id: ctx.usuario.id })[0];
    if (!m) throw erro_('NAO_ENCONTRADO', 'Você não participa deste grupo.');
    atualizarSemBloqueio_('membros_grupo', m.id, { excluido_em: agora_() });
    return { saiu: gid };
  });
}

// ---------- administração ----------

/** Liga ou desliga conta, papel de personal e de administrador. */
function atualizarUsuarioAdmin_(d, ctx) {
  var alvo = buscarUm_('usuarios', { id: id_(d.usuario_id, 'usuário') });
  if (!alvo) throw erro_('NAO_ENCONTRADO', 'Usuário não encontrado.');
  var campos = {};
  if (d.ativo !== undefined) campos.ativo = d.ativo === true;
  if (d.personal_ativo !== undefined) campos.personal_ativo = d.personal_ativo === true;
  if (d.admin !== undefined) campos.admin = d.admin === true;
  if (alvo.id === ctx.usuario.id && (campos.ativo === false || campos.admin === false)) {
    throw erro_('VALIDACAO', 'Você não pode desativar a própria conta nem tirar o seu acesso de administrador.');
  }
  if (!Object.keys(campos).length) throw erro_('VALIDACAO', 'Nada para alterar.');
  var novo = atualizar_('usuarios', alvo.id, campos);
  registrarAuditoria_(ctx.usuario.id, 'admin.usuario', alvo.id, JSON.stringify(campos));
  if (campos.ativo === false) revogarSessoesDe_(alvo.id);
  return publico_(Object.assign({}, novo, { plano: planoAtual_(novo) }), CAMPOS_OCULTOS_USUARIO_);
}

function revogarSessoesDe_(usuarioId) {
  comBloqueio_(function () {
    var t = agora_();
    var cache = CacheService.getScriptCache();
    var lista = buscar_('sessoes_login', { usuario_id: usuarioId }).filter(function (s) { return !s.revogada_em; });
    upsertLoteSemBloqueio_('sessoes_login', lista.map(function (s) { cache.remove('sess:' + s.token_hash); return { id: s.id, revogada_em: t }; }));
  });
}

/** Catálogo inteiro para o administrador: gerais, propostos e os de cada pessoa. */
function catalogoAdmin_(d, ctx) {
  var nomes = {};
  lerTodos_('usuarios').forEach(function (x) { nomes[x.id] = x.nome; });
  var usos = {};
  lerTodos_('ficha_itens').forEach(function (i) { usos[i.exercicio_id] = (usos[i.exercicio_id] || 0) + 1; });
  return lerTodos_('exercicios').map(function (e) {
    var r = publico_(e, []);
    r.autor_nome = nomes[e.criado_por] || '';
    r.usos = usos[e.id] || 0;
    return r;
  }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
}

/** Personal propõe um exercício seu para o catálogo geral. */
function proporExercicio_(d, ctx) {
  var u = ctx.usuario;
  if (!u.personal_ativo && !u.admin) throw erro_('PROIBIDO', 'Só personal propõe exercícios para o catálogo.');
  var ex = buscarUm_('exercicios', { id: id_(d.id, 'exercício') });
  if (!ex || ex.criado_por !== u.id) throw erro_('NAO_ENCONTRADO', 'Exercício não encontrado.');
  if (ex.global) throw erro_('VALIDACAO', 'Este exercício já está no catálogo geral.');
  return publico_(atualizar_('exercicios', ex.id, { status: 'proposto' }), []);
}

function decidirExercicio_(d, ctx) {
  var ex = buscarUm_('exercicios', { id: id_(d.id, 'exercício') });
  if (!ex) throw erro_('NAO_ENCONTRADO', 'Exercício não encontrado.');
  var aceitar = d.aceitar === true;
  var r = atualizar_('exercicios', ex.id, aceitar ? { global: true, status: '' } : { status: 'recusado' });
  registrarAuditoria_(ctx.usuario.id, aceitar ? 'catalogo.aceitar' : 'catalogo.recusar', ex.id, ex.nome);
  return publico_(r, []);
}

/** Admin altera qualquer exercício, inclusive tirar do catálogo geral. */
function atualizarExercicioAdmin_(d, ctx) {
  var ex = buscarUm_('exercicios', { id: id_(d.id, 'exercício') });
  if (!ex) throw erro_('NAO_ENCONTRADO', 'Exercício não encontrado.');
  var campos = {};
  if (d.nome !== undefined) campos.nome = texto_(d.nome, 'nome', 2, 80, true);
  if (d.grupo_muscular !== undefined) campos.grupo_muscular = texto_(d.grupo_muscular, 'grupo muscular', 0, 40, false);
  if (d.equipamento !== undefined) campos.equipamento = texto_(d.equipamento, 'equipamento', 0, 40, false);
  if (d.video_url !== undefined) campos.video_url = videoYoutube_(d.video_url);
  if (d.global !== undefined) campos.global = d.global === true;
  if (d.secundarios !== undefined) campos.secundarios = texto_(d.secundarios, 'músculos secundários', 0, 120, false);
  if (d.mecanica !== undefined) campos.mecanica = opcao_(d.mecanica || '', 'tipo de movimento', ['', 'composto', 'isolado', 'cardio']);
  var r = atualizar_('exercicios', ex.id, campos);
  registrarAuditoria_(ctx.usuario.id, 'catalogo.editar', ex.id, JSON.stringify(campos).slice(0, 500));
  return publico_(r, []);
}


// ===== 12_Premium.gs =====
/**
 * Fase 3: premium. Preços e chave Pix (só o administrador altera), pedidos com Pix copia e cola,
 * liberação manual pelo administrador, cortesias, lotes de licenças e saldo do personal.
 *
 * O Pix copia e cola é o "BR Code" estático do Banco Central: chave, valor, nome, cidade e um
 * identificador do pedido. Sem integração com banco, a confirmação é manual (até 2 dias úteis).
 */

// ---------- configurações e preços ----------

function config_(chave, padrao) {
  var c = buscarUm_('configuracoes', { id: chave });
  return c && c.valor !== null && c.valor !== '' ? c.valor : (padrao === undefined ? '' : padrao);
}

function lerConfigAdmin_() {
  return {
    chave_pix: config_('chave_pix'), nome_recebedor: config_('nome_recebedor'), cidade: config_('cidade'),
    incremento_padrao_kg: Number(config_('incremento_padrao_kg', APP.INCREMENTO_PADRAO_KG))
  };
}

function salvarConfigAdmin_(d, ctx) {
  var valores = {};
  if (d.chave_pix !== undefined) {
    var chave = texto_(d.chave_pix, 'chave Pix', 0, 77, false).replace(/\s+/g, '');
    if (chave && !/^[A-Za-z0-9@.+_-]+$/.test(chave)) throw erro_('VALIDACAO', 'Chave Pix inválida.');
    valores.chave_pix = chave;
  }
  if (d.nome_recebedor !== undefined) valores.nome_recebedor = texto_(d.nome_recebedor, 'nome do recebedor', 0, 60, false);
  if (d.cidade !== undefined) valores.cidade = texto_(d.cidade, 'cidade', 0, 40, false);
  if (d.incremento_padrao_kg !== undefined) valores.incremento_padrao_kg = String(numero_(d.incremento_padrao_kg, 'incremento', 0.25, 20, false));
  comBloqueio_(function () {
    Object.keys(valores).forEach(function (k) {
      if (buscarUm_('configuracoes', { id: k }, true)) atualizarSemBloqueio_('configuracoes', k, { valor: valores[k], excluido_em: null });
      else inserirSemBloqueio_('configuracoes', { id: k, valor: valores[k] });
    });
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'admin.config', alvo: Object.keys(valores).join(','), detalhes: '' });
  });
  return lerConfigAdmin_();
}

/** Preços ativos para quem está logado (aluno vê os de aluno; personal vê os dois). */
function listarPrecos_(d, ctx) {
  var u = ctx.usuario;
  return lerTodos_('precos')
    .filter(function (p) { return p.ativo && (p.publico === 'aluno' || (p.publico === 'personal' && (u.personal_ativo || u.admin))); })
    .map(function (p) { return publico_(p, []); })
    .sort(ordemPeriodo_);
}

function ordemPeriodo_(a, b) {
  var ordem = ['mensal', 'trimestral', 'semestral', 'anual'];
  return (a.publico < b.publico ? -1 : a.publico > b.publico ? 1 : 0) || ordem.indexOf(a.periodo) - ordem.indexOf(b.periodo);
}

function precosAdmin_() {
  return lerTodos_('precos').map(function (p) { return publico_(p, []); }).sort(ordemPeriodo_);
}

function salvarPrecosAdmin_(d, ctx) {
  var lista = lista_(d.precos, 'preços', 20).map(function (p) {
    return { id: id_(p.id, 'preço'), valor: numero_(p.valor, 'valor', 0.01, 9999, false), ativo: p.ativo !== false };
  });
  return comBloqueio_(function () {
    var existentes = {};
    lerTodos_('precos').forEach(function (p) { existentes[p.id] = true; });
    lista.forEach(function (p) { if (!existentes[p.id]) throw erro_('NAO_ENCONTRADO', 'Preço não encontrado.'); });
    upsertLoteSemBloqueio_('precos', lista);
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'admin.precos', alvo: '', detalhes: JSON.stringify(lista).slice(0, 1000) });
    return precosAdmin_();
  });
}

// ---------- Pix copia e cola (BR Code estático) ----------

function campoEmv_(id, valor) {
  var v = String(valor);
  return id + ('0' + v.length).slice(-2) + v;
}

function semAcento_(t, max) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 .\-]/g, '').toUpperCase().trim().slice(0, max);
}

function crc16_(texto) {
  var crc = 0xFFFF;
  for (var i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (var j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return ('0000' + crc.toString(16).toUpperCase()).slice(-4);
}

function pixCopiaECola_(chave, nome, cidade, valor, txid) {
  var conta = campoEmv_('00', 'br.gov.bcb.pix') + campoEmv_('01', chave);
  var corpo = campoEmv_('00', '01') +
    campoEmv_('26', conta) +
    campoEmv_('52', '0000') +
    campoEmv_('53', '986') +
    campoEmv_('54', Number(valor).toFixed(2)) +
    campoEmv_('58', 'BR') +
    campoEmv_('59', semAcento_(nome, 25) || 'RECEBEDOR') +
    campoEmv_('60', semAcento_(cidade, 15) || 'BRASIL') +
    campoEmv_('62', campoEmv_('05', txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25)));
  var semCrc = corpo + '6304';
  return semCrc + crc16_(semCrc);
}

// ---------- pedidos ----------

function codigoReferencia_() {
  var alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'MT' + bytesAleatorios_(8).map(function (b) { return alfabeto.charAt((b & 0xff) % alfabeto.length); }).join('');
}

function comPix_(p) {
  var r = publico_(p, []);
  var chave = config_('chave_pix');
  r.pix = (p.status === 'aguardando' || p.status === 'informado') && chave
    ? pixCopiaECola_(chave, config_('nome_recebedor'), config_('cidade'), p.valor, p.codigo_referencia)
    : '';
  r.recebedor = config_('nome_recebedor');
  return r;
}

/** dados: { periodo, quantidade? } — quantidade > 1 só para personal (licenças para os alunos). */
function criarPedido_(d, ctx) {
  var u = ctx.usuario;
  var periodo = opcao_(d.periodo, 'período', Object.keys(APP.PERIODOS));
  var tipo = d.tipo === 'personal' ? 'personal' : 'aluno';
  if (tipo === 'personal' && !u.personal_ativo) throw erro_('PROIBIDO', 'Só personal ativo compra licenças para alunos.');
  var quantidade = tipo === 'personal' ? numero_(d.quantidade, 'quantidade', 1, 100, false) : 1;
  if (Math.round(quantidade) !== quantidade) throw erro_('VALIDACAO', 'Quantidade inválida.');
  if (!config_('chave_pix')) throw erro_('INDISPONIVEL', 'A compra ainda não está disponível: falta o administrador cadastrar a chave Pix.');
  var preco = lerTodos_('precos').filter(function (p) { return p.ativo && p.publico === tipo && p.periodo === periodo; })[0];
  if (!preco) throw erro_('INDISPONIVEL', 'Este período não está à venda agora.');
  return comBloqueio_(function () {
    var abertos = buscar_('pedidos', { comprador_id: u.id }).filter(function (p) { return p.status === 'aguardando' || p.status === 'informado'; });
    if (abertos.length >= APP.MAX_PEDIDOS_ABERTOS) throw erro_('LIMITE', 'Você já tem pedidos em aberto. Pague ou cancele um deles antes.');
    var usados = {};
    lerTodos_('pedidos', true).forEach(function (p) { usados[p.codigo_referencia] = true; });
    var ref;
    do { ref = codigoReferencia_(); } while (usados[ref]);
    var p = inserirSemBloqueio_('pedidos', {
      comprador_id: u.id, tipo: tipo, periodo: periodo, quantidade: quantidade,
      valor: Math.round(preco.valor * quantidade * 100) / 100, // valor congelado no momento da compra
      codigo_referencia: ref, status: 'aguardando'
    });
    return comPix_(p);
  });
}

function meusPedidos_(d, ctx) {
  return buscar_('pedidos', { comprador_id: ctx.usuario.id })
    .sort(function (a, b) { return a.criado_em < b.criado_em ? 1 : -1; })
    .map(comPix_);
}

function informarPagamento_(d, ctx) {
  return mudarMeuPedido_(d, ctx, 'aguardando', { status: 'informado', pago_informado_em: agora_() });
}

function cancelarMeuPedido_(d, ctx) {
  return mudarMeuPedido_(d, ctx, null, { status: 'cancelado' });
}

function mudarMeuPedido_(d, ctx, deStatus, campos) {
  var id = id_(d.id, 'pedido');
  return comBloqueio_(function () {
    var p = buscarUm_('pedidos', { id: id });
    if (!p || p.comprador_id !== ctx.usuario.id) throw erro_('NAO_ENCONTRADO', 'Pedido não encontrado.');
    if (deStatus ? p.status !== deStatus : (p.status !== 'aguardando' && p.status !== 'informado')) throw erro_('VALIDACAO', 'Este pedido não pode mais ser alterado.');
    return comPix_(atualizarSemBloqueio_('pedidos', id, campos));
  });
}

// ---------- licenças ----------

function somarMeses_(iso, meses) {
  var t = new Date(iso);
  var dia = t.getUTCDate();
  t.setUTCMonth(t.getUTCMonth() + meses);
  if (t.getUTCDate() < dia) t.setUTCDate(0); // 31/01 + 1 mês = 28 ou 29/02
  return t.toISOString();
}

/** Início de uma licença nova: agora, ou o fim do premium com prazo que já está valendo (soma o período). */
function inicioDaProxima_(usuarioId) {
  var agora = agora_();
  var fim = agora;
  buscar_('licencas', { usuario_id: usuarioId }).forEach(function (l) {
    if (l.fim && l.inicio <= agora && l.fim > fim) fim = l.fim;
  });
  return fim;
}

/** regra: 'periodo:mensal' | 'dias:90' | 'ate:2027-02-15T…' | 'sem_prazo' */
function fimPorRegra_(regra, inicio) {
  if (regra === 'sem_prazo') return null;
  var m = String(regra).match(/^(periodo|dias|ate):(.+)$/);
  if (!m) throw erro_('VALIDACAO', 'Prazo inválido.');
  if (m[1] === 'periodo') return somarMeses_(inicio, APP.PERIODOS[m[2]]);
  if (m[1] === 'dias') return new Date(new Date(inicio).getTime() + Number(m[2]) * 864e5).toISOString();
  return m[2];
}

function regraDoPedido_(d) {
  var modo = opcao_(d.modo, 'prazo', ['periodo', 'dias', 'ate', 'sem_prazo']);
  if (modo === 'sem_prazo') return 'sem_prazo';
  if (modo === 'periodo') return 'periodo:' + opcao_(d.periodo, 'período', Object.keys(APP.PERIODOS));
  if (modo === 'dias') return 'dias:' + numero_(d.dias, 'dias', 1, 3650, false);
  var ate = dataIso_(d.ate, 'data final');
  if (ate <= agora_()) throw erro_('VALIDACAO', 'A data final precisa ser no futuro.');
  return 'ate:' + ate;
}

function concederLicenca_(usuarioId, regra, origem, porId, pedidoId) {
  var inicio = regra.indexOf('ate:') === 0 || regra === 'sem_prazo' ? agora_() : inicioDaProxima_(usuarioId);
  return inserirSemBloqueio_('licencas', {
    usuario_id: usuarioId, origem: origem, inicio: inicio, fim: fimPorRegra_(regra, inicio),
    concedida_por: porId || '', pedido_id: pedidoId || ''
  });
}

/** Aluno: licenças e pedidos dele. */
function minhasLicencas_(d, ctx) {
  var u = ctx.usuario;
  return {
    plano: planoAtual_(u),
    licencas: buscar_('licencas', { usuario_id: u.id }).map(function (l) { return publico_(l, []); })
      .sort(function (a, b) { return a.inicio < b.inicio ? 1 : -1; }),
    pedidos: meusPedidos_(d, ctx),
    pix_disponivel: !!config_('chave_pix')
  };
}

// ---------- administrador ----------

function listarPedidosAdmin_(d) {
  var nomes = {};
  lerTodos_('usuarios').forEach(function (u) { nomes[u.id] = u; });
  return lerTodos_('pedidos')
    .sort(function (a, b) { return a.criado_em < b.criado_em ? 1 : -1; })
    .map(function (p) {
      var r = publico_(p, []);
      var c = nomes[p.comprador_id] || {};
      r.comprador_nome = c.nome || '';
      r.comprador_email = c.email || '';
      return r;
    });
}

function liberarPedido_(d, ctx) {
  var id = id_(d.id, 'pedido');
  return comBloqueio_(function () {
    var p = buscarUm_('pedidos', { id: id });
    if (!p) throw erro_('NAO_ENCONTRADO', 'Pedido não encontrado.');
    if (p.status !== 'aguardando' && p.status !== 'informado') throw erro_('VALIDACAO', 'Este pedido já foi ' + p.status + '.');
    var r = { pedido: id };
    if (p.tipo === 'personal') {
      var novos = [];
      for (var i = 0; i < p.quantidade; i++) {
        novos.push({ id: novoId_(), personal_id: p.comprador_id, periodo_ou_fim: 'periodo:' + p.periodo, origem: 'compra', pedido_id: p.id });
      }
      upsertLoteSemBloqueio_('saldo_licencas_personal', novos);
      r.licencas_no_saldo = novos.length;
    } else {
      var l = concederLicenca_(p.comprador_id, 'periodo:' + p.periodo, 'compra', ctx.usuario.id, p.id);
      r.licenca = publico_(l, []);
    }
    atualizarSemBloqueio_('pedidos', id, { status: 'liberado', liberado_em: agora_(), liberado_por: ctx.usuario.id });
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'pedido.liberar', alvo: id, detalhes: p.codigo_referencia + ' ' + p.valor });
    return r;
  });
}

function cancelarPedidoAdmin_(d, ctx) {
  var id = id_(d.id, 'pedido');
  var obs = texto_(d.observacao, 'observação', 0, 300, false);
  return comBloqueio_(function () {
    var p = buscarUm_('pedidos', { id: id });
    if (!p || (p.status !== 'aguardando' && p.status !== 'informado')) throw erro_('VALIDACAO', 'Este pedido não pode ser cancelado.');
    atualizarSemBloqueio_('pedidos', id, { status: 'cancelado', observacao: obs });
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'pedido.cancelar', alvo: id, detalhes: obs });
    return { cancelado: id };
  });
}

/** Cortesia: { usuario_id, modo: 'dias'|'ate'|'sem_prazo'|'periodo', dias?, ate?, periodo? } */
function cortesia_(d, ctx) {
  var alvo = buscarUm_('usuarios', { id: id_(d.usuario_id, 'usuário') });
  if (!alvo) throw erro_('NAO_ENCONTRADO', 'Usuário não encontrado.');
  var regra = regraDoPedido_(d);
  return comBloqueio_(function () {
    var l = concederLicenca_(alvo.id, regra, 'cortesia', ctx.usuario.id, '');
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'licenca.cortesia', alvo: alvo.id, detalhes: regra });
    return publico_(l, []);
  });
}

function revogarLicenca_(d, ctx) {
  var id = id_(d.id, 'licença');
  return comBloqueio_(function () {
    var l = buscarUm_('licencas', { id: id });
    if (!l) throw erro_('NAO_ENCONTRADO', 'Licença não encontrada.');
    atualizarSemBloqueio_('licencas', id, { excluido_em: agora_() });
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'licenca.revogar', alvo: id, detalhes: l.usuario_id });
    return { revogada: id };
  });
}

function licencasDeUsuarioAdmin_(d) {
  var alvo = buscarUm_('usuarios', { id: id_(d.usuario_id, 'usuário') });
  if (!alvo) throw erro_('NAO_ENCONTRADO', 'Usuário não encontrado.');
  return {
    plano: planoAtual_(alvo),
    licencas: buscar_('licencas', { usuario_id: alvo.id }).map(function (l) { return publico_(l, []); }),
    saldo: alvo.personal_ativo ? saldoDe_(alvo.id) : null
  };
}

/** Lote de licenças para o personal distribuir: { personal_id, quantidade, modo, ... } */
function loteParaPersonal_(d, ctx) {
  var p = buscarUm_('usuarios', { id: id_(d.personal_id, 'personal') });
  if (!p || !p.personal_ativo) throw erro_('VALIDACAO', 'Esta pessoa não tem o papel de personal ativo.');
  var qtd = numero_(d.quantidade, 'quantidade', 1, 100, false);
  var regra = regraDoPedido_(d);
  return comBloqueio_(function () {
    var novos = [];
    for (var i = 0; i < Math.round(qtd); i++) novos.push({ id: novoId_(), personal_id: p.id, periodo_ou_fim: regra, origem: 'lote' });
    upsertLoteSemBloqueio_('saldo_licencas_personal', novos);
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'licenca.lote', alvo: p.id, detalhes: novos.length + ' ' + regra });
    return { criadas: novos.length };
  });
}

// ---------- personal: saldo e atribuição ----------

function saldoDe_(personalId) {
  var nomes = {};
  lerTodos_('usuarios').forEach(function (u) { nomes[u.id] = u.nome; });
  var licencas = {};
  lerTodos_('licencas').forEach(function (l) { licencas[l.id] = l; });
  return buscar_('saldo_licencas_personal', { personal_id: personalId }).map(function (s) {
    var r = publico_(s, []);
    r.aluno_nome = s.atribuida_a ? nomes[s.atribuida_a] || '' : '';
    var l = licencas[s.licenca_id];
    r.fim = l ? l.fim : null;
    r.revogada = !!(s.licenca_id && !l);
    return r;
  }).sort(function (a, b) { return (a.atribuida_em || '') < (b.atribuida_em || '') ? 1 : -1; });
}

function minhasLicencasPersonal_(d, ctx) {
  if (!ctx.usuario.personal_ativo && !ctx.usuario.admin) throw erro_('PROIBIDO', 'Sem permissão.');
  return { saldo: saldoDe_(ctx.usuario.id) };
}

function atribuirLicenca_(d, ctx) {
  var aluno = exigirAlunoDoPersonal_(ctx, d.aluno_id);
  return comBloqueio_(function () {
    var livres = buscar_('saldo_licencas_personal', { personal_id: ctx.usuario.id }).filter(function (s) { return !s.atribuida_a; });
    var s = d.saldo_id ? livres.filter(function (x) { return x.id === d.saldo_id; })[0] : livres[0];
    if (!s) throw erro_('SEM_SALDO', 'Você não tem licenças livres. Compre mais ou peça ao administrador.');
    var l = concederLicenca_(aluno.id, s.periodo_ou_fim, 'personal', ctx.usuario.id, s.pedido_id || '');
    atualizarSemBloqueio_('saldo_licencas_personal', s.id, { atribuida_a: aluno.id, atribuida_em: agora_(), licenca_id: l.id });
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'licenca.atribuir', alvo: aluno.id, detalhes: s.id });
    return { licenca: publico_(l, []), aluno: aluno.nome };
  });
}


// ===== 13_Programas.gs =====
/**
 * Fase 3: programas prontos, medidas corporais e exportação.
 *
 * Programa = conjunto de fichas modelo. Quem publica:
 *   administrador → para todos (marcando quais são grátis);
 *   gerente → para o próprio grupo;
 *   personal → programa privado, que ele aplica nos alunos.
 * "Usar" um programa copia as fichas para a conta do aluno.
 */
var NIVEIS_ = ['', 'iniciante', 'intermediario', 'avancado'];

function meusGrupos_(u) {
  var m = {};
  buscar_('membros_grupo', { usuario_id: u.id }).forEach(function (x) { m[x.grupo_id] = x.papel; });
  return m;
}

function programaComFichas_(p, comItens) {
  var r = publico_(p, []);
  var fichas = buscar_('programa_fichas', { programa_id: p.id }).sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
  var itens = comItens ? lerTodos_('programa_itens') : [];
  r.fichas = fichas.map(function (f) {
    var x = publico_(f, []);
    if (comItens) x.itens = itens.filter(function (i) { return i.programa_ficha_id === f.id; }).sort(function (a, b) { return a.ordem - b.ordem; }).map(function (i) { return publico_(i, []); });
    return x;
  });
  return r;
}

/** Programas que a pessoa pode usar. No grátis, os premium aparecem com cadeado (sem os exercícios). */
function listarProgramas_(d, ctx) {
  var u = ctx.usuario;
  var premium = planoEfetivo_(ctx).tipo === 'premium';
  var grupos = meusGrupos_(u);
  var nomes = {};
  lerTodos_('usuarios').forEach(function (x) { nomes[x.id] = x.nome; });
  return lerTodos_('programas')
    .filter(function (p) {
      if (!p.publicado) return false;
      return p.publico === 'todos' || (p.publico === 'grupo' && grupos[p.grupo_id]);
    })
    .map(function (p) {
      var livre = premium || p.gratis;
      var r = programaComFichas_(p, livre);
      r.bloqueado = !livre;
      r.autor_nome = nomes[p.autor_id] || '';
      return r;
    })
    .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
}

/** Programas que a pessoa escreveu (o administrador vê todos). */
function programasAutor_(d, ctx) {
  var u = ctx.usuario;
  return lerTodos_('programas')
    .filter(function (p) { return u.admin || p.autor_id === u.id; })
    .map(function (p) { return programaComFichas_(p, true); })
    .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
}

function salvarPrograma_(d, ctx) {
  var u = ctx.usuario;
  var p = d.programa && typeof d.programa === 'object' ? d.programa : {};
  var reg = {
    id: id_(p.id, 'programa'),
    nome: texto_(p.nome, 'nome do programa', 2, 80, true),
    descricao: texto_(p.descricao, 'descrição', 0, 1000, false),
    objetivo: texto_(p.objetivo, 'objetivo', 0, 60, false),
    nivel: opcao_(p.nivel || '', 'nível', NIVEIS_),
    dias_semana: numero_(p.dias_semana, 'dias por semana', 1, 7, true),
    semanas: numero_(p.semanas, 'semanas', 1, 52, true),
    publico: opcao_(p.publico || 'privado', 'quem vê', ['todos', 'grupo', 'privado']),
    grupo_id: p.publico === 'grupo' ? id_(p.grupo_id, 'grupo') : '',
    gratis: p.gratis === true,
    publicado: p.publicado !== false
  };
  if (reg.publico === 'todos' && !u.admin) throw erro_('PROIBIDO', 'Só o administrador publica para todos.');
  if (reg.publico === 'grupo') exigirGerenteDoGrupo_(ctx, reg.grupo_id);
  if (reg.publico === 'privado' && !u.personal_ativo && !u.admin) throw erro_('PROIBIDO', 'Só personal cria programas para os alunos.');
  if (reg.publico !== 'todos') reg.gratis = true; // grupo e personal: quem recebe usa, qualquer plano

  var fichas = lista_(d.fichas, 'fichas', 14).map(function (f, n) {
    var fid = id_(f.id, 'ficha');
    return {
      ficha: { id: fid, programa_id: reg.id, nome: texto_(f.nome, 'nome da ficha', 1, 60, true), ordem: n + 1 },
      itens: lista_(f.itens, 'itens', 40).map(function (i, k) {
        return {
          id: id_(i.id, 'item'), programa_ficha_id: fid, exercicio_id: id_(i.exercicio_id, 'exercício'), ordem: k + 1,
          series: numero_(i.series, 'séries', 1, 20, false),
          reps_prescritas: texto_(i.reps_prescritas, 'repetições', 0, 40, false),
          descanso_seg: numero_(i.descanso_seg, 'descanso', 0, 1800, true),
          metodo: opcao_(i.metodo || '', 'método', APP.METODOS),
          observacoes: texto_(i.observacoes, 'observações', 0, 500, false)
        };
      })
    };
  });
  if (!fichas.length) throw erro_('VALIDACAO', 'Um programa precisa de pelo menos uma ficha.');

  return comBloqueio_(function () {
    var atual = buscarUm_('programas', { id: reg.id }, true);
    if (atual && (atual.excluido_em || (atual.autor_id !== u.id && !u.admin))) throw erro_('PROIBIDO', 'Programa de outra pessoa.');
    // Para todos ou para um grupo, só exercícios do catálogo geral (quem recebe precisa enxergar).
    var exercicios = {};
    lerTodos_('exercicios').forEach(function (e) { exercicios[e.id] = e; });
    var vis = exerciciosVisiveis_(u);
    fichas.forEach(function (f) {
      f.itens.forEach(function (i) {
        var e = exercicios[i.exercicio_id];
        if (!e || !vis[e.id]) throw erro_('VALIDACAO', 'Exercício não encontrado no catálogo.');
        if (reg.publico !== 'privado' && !e.global) throw erro_('VALIDACAO', '"' + e.nome + '" é um exercício próprio. Para publicar, use exercícios do catálogo geral (ou proponha este ao administrador).');
      });
    });
    reg.autor_id = atual ? atual.autor_id : u.id;
    upsertLoteSemBloqueio_('programas', [reg]);
    // substitui fichas e itens
    var t = agora_();
    var velhasFichas = buscar_('programa_fichas', { programa_id: reg.id });
    var idsVelhas = {};
    velhasFichas.forEach(function (f) { idsVelhas[f.id] = true; });
    var mantidas = {};
    fichas.forEach(function (f) { mantidas[f.ficha.id] = true; });
    var outros = lerTodos_('programa_fichas', true).filter(function (f) { return mantidas[f.id] && f.programa_id !== reg.id; });
    if (outros.length) throw erro_('PROIBIDO', 'Identificador de ficha já usado.');
    upsertLoteSemBloqueio_('programa_fichas', fichas.map(function (f) { return Object.assign({}, f.ficha, { excluido_em: null }); })
      .concat(velhasFichas.filter(function (f) { return !mantidas[f.id]; }).map(function (f) { return { id: f.id, excluido_em: t }; })));
    var novosItens = [];
    fichas.forEach(function (f) { f.itens.forEach(function (i) { novosItens.push(Object.assign({}, i, { excluido_em: null })); }); });
    var manterItem = {};
    novosItens.forEach(function (i) { manterItem[i.id] = true; });
    var velhosItens = lerTodos_('programa_itens').filter(function (i) { return (idsVelhas[i.programa_ficha_id] || mantidas[i.programa_ficha_id]) && !manterItem[i.id]; });
    upsertLoteSemBloqueio_('programa_itens', novosItens.concat(velhosItens.map(function (i) { return { id: i.id, excluido_em: t }; })));
    return programaComFichas_(buscarUm_('programas', { id: reg.id }), true);
  });
}

function excluirPrograma_(d, ctx) {
  var id = id_(d.id, 'programa');
  return comBloqueio_(function () {
    var p = buscarUm_('programas', { id: id });
    if (!p || (p.autor_id !== ctx.usuario.id && !ctx.usuario.admin)) throw erro_('NAO_ENCONTRADO', 'Programa não encontrado.');
    atualizarSemBloqueio_('programas', id, { excluido_em: agora_(), publicado: false });
    return { excluido: id };
  });
}

/**
 * Copia as fichas do programa para um aluno.
 * dados: { id, aluno_id? } — sem aluno_id, para a própria conta; com aluno_id, o personal aplica no aluno.
 * No plano grátis, entram ativas só até o limite; as demais ficam arquivadas.
 */
function usarPrograma_(d, ctx) {
  var u = ctx.usuario;
  var p = buscarUm_('programas', { id: id_(d.id, 'programa') });
  if (!p) throw erro_('NAO_ENCONTRADO', 'Programa não encontrado.');
  var aluno = u;
  var lim;
  if (d.aluno_id) {
    aluno = exigirAlunoDoPersonal_(ctx, d.aluno_id);
    if (p.autor_id !== u.id && !(p.publicado && (p.publico === 'todos' || (p.publico === 'grupo' && meusGrupos_(u)[p.grupo_id])))) throw erro_('PROIBIDO', 'Programa não disponível.');
    lim = limitesDoAluno_(aluno);
  } else {
    var disp = p.publicado && (p.publico === 'todos' || (p.publico === 'grupo' && meusGrupos_(u)[p.grupo_id]));
    if (!disp && p.autor_id !== u.id) throw erro_('PROIBIDO', 'Programa não disponível.');
    lim = limites_(ctx);
    if (!p.gratis && lim.plano !== 'premium') throw erro_('LIMITE_PLANO', 'Este programa é do plano premium.');
  }
  var completo = programaComFichas_(p, true);
  return comBloqueio_(function () {
    var ativas = buscar_('fichas', { aluno_id: aluno.id }).filter(function (f) { return f.ativa; }).length;
    var ordemBase = buscar_('fichas', { aluno_id: aluno.id }).reduce(function (m, f) { return Math.max(m, f.ordem || 0); }, 0);
    var fichas = [];
    var itens = [];
    var arquivadas = 0;
    completo.fichas.forEach(function (f, n) {
      var ativa = lim.fichas_ativas === null || ativas < lim.fichas_ativas;
      if (ativa) ativas++; else arquivadas++;
      var fid = novoId_();
      fichas.push({ id: fid, aluno_id: aluno.id, autor_id: u.id, nome: f.nome, ordem: ordemBase + n + 1, ativa: ativa });
      f.itens.forEach(function (i) {
        itens.push({
          id: novoId_(), ficha_id: fid, exercicio_id: i.exercicio_id, ordem: i.ordem, series: i.series,
          reps_prescritas: i.reps_prescritas, reps_min: null, reps_max: null, carga_prescrita_kg: null, aumento_max_kg: null,
          carga_atual_kg: null, reps_atuais: '', descanso_seg: i.descanso_seg, metodo: i.metodo, observacoes: i.observacoes, sugestao: '', incremento_kg: null
        });
      });
    });
    upsertLoteSemBloqueio_('fichas', fichas);
    upsertLoteSemBloqueio_('ficha_itens', itens);
    inserirSemBloqueio_('auditoria', { usuario_id: u.id, acao: 'programa.usar', alvo: p.id, detalhes: aluno.id });
    return { fichas: fichas.length, arquivadas: arquivadas };
  });
}

// ---------- medidas corporais ----------

var CAMPOS_MEDIDA_ = ['peso_kg', 'gordura_pct', 'peito_cm', 'cintura_cm', 'abdomen_cm', 'quadril_cm', 'braco_d_cm', 'braco_e_cm', 'coxa_d_cm', 'coxa_e_cm', 'panturrilha_cm'];
var FAIXAS_MEDIDA_ = { peso_kg: [20, 400], gordura_pct: [2, 70] };

function alvoDasMedidas_(d, ctx) {
  if (d.aluno_id && d.aluno_id !== ctx.usuario.id) return exigirAlunoDoPersonal_(ctx, d.aluno_id);
  return ctx.usuario;
}

function listarMedidas_(d, ctx) {
  var aluno = alvoDasMedidas_(d, ctx);
  return buscar_('medidas', { aluno_id: aluno.id })
    .map(function (m) { return publico_(m, []); })
    .sort(function (a, b) { return a.data < b.data ? 1 : -1; });
}

/** No grátis, só o peso; no premium, todas as medidas. Vale o plano do aluno, mesmo quando o personal registra. */
function salvarMedida_(d, ctx) {
  var aluno = alvoDasMedidas_(d, ctx);
  var m = d.medida && typeof d.medida === 'object' ? d.medida : {};
  var premium = aluno.id === ctx.usuario.id ? limites_(ctx).plano === 'premium' : limitesDoAluno_(aluno).plano === 'premium';
  var reg = { id: id_(m.id, 'medida'), aluno_id: aluno.id, autor_id: ctx.usuario.id, data: dataIso_(m.data, 'data'), observacao: texto_(m.observacao, 'observação', 0, 300, false) };
  var algum = false;
  CAMPOS_MEDIDA_.forEach(function (c) {
    var f = FAIXAS_MEDIDA_[c] || [5, 300];
    var v = numero_(m[c], c.replace(/_/g, ' '), f[0], f[1], true);
    if (v !== null && c !== 'peso_kg' && !premium) throw erro_('LIMITE_PLANO', 'No plano grátis dá para registrar o peso. As outras medidas são do premium.');
    reg[c] = v;
    if (v !== null) algum = true;
  });
  if (!algum) throw erro_('VALIDACAO', 'Preencha pelo menos uma medida.');
  return comBloqueio_(function () {
    var atual = buscarUm_('medidas', { id: reg.id }, true);
    if (atual && atual.aluno_id !== aluno.id) throw erro_('PROIBIDO', 'Registro de outra pessoa.');
    upsertLoteSemBloqueio_('medidas', [reg]);
    return publico_(buscarUm_('medidas', { id: reg.id }), []);
  });
}

function excluirMedida_(d, ctx) {
  var id = id_(d.id, 'medida');
  return comBloqueio_(function () {
    var m = buscarUm_('medidas', { id: id });
    if (!m) throw erro_('NAO_ENCONTRADO', 'Registro não encontrado.');
    if (m.aluno_id !== ctx.usuario.id && !(m.autor_id === ctx.usuario.id && vinculoAtivo_(ctx.usuario.id, m.aluno_id))) throw erro_('PROIBIDO', 'Sem permissão.');
    atualizarSemBloqueio_('medidas', id, { excluido_em: agora_() });
    return { excluida: id };
  });
}

// ---------- exportação ----------

/**
 * Dados para o app montar as planilhas (CSV). Premium exporta os próprios; o personal, os dos alunos.
 * O app neutraliza fórmulas nas células antes de salvar o arquivo.
 */
function exportarDados_(d, ctx) {
  var aluno;
  if (d.aluno_id && d.aluno_id !== ctx.usuario.id) {
    aluno = exigirAlunoDoPersonal_(ctx, d.aluno_id);
  } else {
    aluno = ctx.usuario;
    if (limites_(ctx).plano !== 'premium') throw erro_('LIMITE_PLANO', 'Exportar é do plano premium. Para uma cópia dos seus dados, fale com o administrador.');
  }
  var h = historicoDe_(aluno.id, null);
  var ex = {};
  lerTodos_('exercicios', true).forEach(function (e) { ex[e.id] = e; });
  var fichas = {};
  buscar_('fichas', { aluno_id: aluno.id }, true).forEach(function (f) { fichas[f.id] = f.nome; });
  var sessoes = {};
  h.sessoes.forEach(function (s) { sessoes[s.id] = s; });
  var series = h.series.map(function (s) {
    var se = sessoes[s.sessao_id] || {};
    var e = ex[s.exercicio_id] || {};
    return [se.inicio || '', fichas[se.ficha_id] || '', e.nome || '', e.grupo_muscular || '', s.ordem, s.carga_kg, s.reps, s.rpe, s.tipo];
  }).sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[4] - b[4]; });
  return {
    aluno: aluno.nome,
    series: { colunas: ['data_hora', 'ficha', 'exercicio', 'grupo_muscular', 'ordem', 'carga_kg', 'repeticoes', 'rpe', 'tipo'], linhas: series },
    treinos: { colunas: ['inicio', 'fim', 'ficha', 'observacao'], linhas: h.sessoes.map(function (s) { return [s.inicio, s.fim, fichas[s.ficha_id] || '', s.observacao || '']; }) },
    medidas: { colunas: ['data'].concat(CAMPOS_MEDIDA_).concat(['observacao']), linhas: buscar_('medidas', { aluno_id: aluno.id }).map(function (m) { return [m.data].concat(CAMPOS_MEDIDA_.map(function (c) { return m[c]; })).concat([m.observacao || '']); }) }
  };
}


// ===== 14_Catalogo.gs =====
/**
 * Catálogo base de exercícios (gerado por ferramentas/catalogo.py; não edite à mão).
 * Cada item: [nome, grupo principal, músculos secundários, equipamento, mecânica].
 * Grupo principal = músculo que mais trabalha (agonista), como nos diretórios ExRx e StrengthLog.
 */
var GRUPOS_MUSCULARES = ["Peito", "Costas", "Ombros", "Trapézio", "Bíceps", "Tríceps", "Antebraço", "Abdômen", "Lombar", "Quadríceps", "Posterior de coxa", "Glúteos", "Adutores", "Panturrilha", "Corpo inteiro", "Cardio"];

var CATALOGO_BASE_ = [
  ["Supino reto com barra", "Peito", "Tríceps, Ombros (anterior)", "Barra", "composto"],
  ["Supino reto com halteres", "Peito", "Tríceps, Ombros (anterior)", "Halteres", "composto"],
  ["Supino reto na máquina", "Peito", "Tríceps, Ombros (anterior)", "Máquina", "composto"],
  ["Supino reto no Smith", "Peito", "Tríceps, Ombros (anterior)", "Smith", "composto"],
  ["Supino inclinado com barra", "Peito", "Ombros (anterior), Tríceps", "Barra", "composto"],
  ["Supino inclinado com halteres", "Peito", "Ombros (anterior), Tríceps", "Halteres", "composto"],
  ["Supino inclinado na máquina", "Peito", "Ombros (anterior), Tríceps", "Máquina", "composto"],
  ["Supino inclinado no Smith", "Peito", "Ombros (anterior), Tríceps", "Smith", "composto"],
  ["Supino declinado com barra", "Peito", "Tríceps", "Barra", "composto"],
  ["Supino declinado com halteres", "Peito", "Tríceps", "Halteres", "composto"],
  ["Supino declinado na máquina", "Peito", "Tríceps", "Máquina", "composto"],
  ["Supino com pegada fechada", "Tríceps", "Peito, Ombros (anterior)", "Barra", "composto"],
  ["Supino no chão (floor press)", "Peito", "Tríceps", "Barra", "composto"],
  ["Supino com halteres pegada neutra", "Peito", "Tríceps", "Halteres", "composto"],
  ["Supino articulado (hammer)", "Peito", "Tríceps, Ombros (anterior)", "Máquina", "composto"],
  ["Crucifixo reto com halteres", "Peito", "Ombros (anterior)", "Halteres", "isolado"],
  ["Crucifixo inclinado com halteres", "Peito", "Ombros (anterior)", "Halteres", "isolado"],
  ["Crucifixo declinado com halteres", "Peito", "", "Halteres", "isolado"],
  ["Crucifixo na máquina (voador)", "Peito", "Ombros (anterior)", "Máquina", "isolado"],
  ["Crucifixo na polia (crossover alto)", "Peito", "Ombros (anterior)", "Polia", "isolado"],
  ["Crossover baixo (polia de baixo para cima)", "Peito", "Ombros (anterior)", "Polia", "isolado"],
  ["Crossover na altura do peito", "Peito", "Ombros (anterior)", "Polia", "isolado"],
  ["Crucifixo inclinado na polia", "Peito", "Ombros (anterior)", "Polia", "isolado"],
  ["Pullover com halter", "Peito", "Costas (latíssimo), Tríceps", "Halteres", "composto"],
  ["Flexão de braço", "Peito", "Tríceps, Ombros (anterior), Abdômen", "Peso corporal", "composto"],
  ["Flexão de braço inclinada (mãos elevadas)", "Peito", "Tríceps, Ombros (anterior)", "Peso corporal", "composto"],
  ["Flexão de braço declinada (pés elevados)", "Peito", "Ombros (anterior), Tríceps", "Peso corporal", "composto"],
  ["Flexão de braço com joelhos apoiados", "Peito", "Tríceps", "Peso corporal", "composto"],
  ["Flexão de braço com palmas", "Peito", "Tríceps, Ombros (anterior)", "Peso corporal", "composto"],
  ["Mergulho nas paralelas (ênfase peito)", "Peito", "Tríceps, Ombros (anterior)", "Peso corporal", "composto"],
  ["Supino com elástico", "Peito", "Tríceps", "Elástico", "composto"],
  ["Supino na polia em pé", "Peito", "Tríceps, Ombros (anterior)", "Polia", "composto"],
  ["Arremesso de medicine ball (peito)", "Peito", "Tríceps, Ombros", "Medicine ball", "composto"],
  ["Barra fixa pronada", "Costas", "Bíceps, Antebraço", "Peso corporal", "composto"],
  ["Barra fixa supinada", "Costas", "Bíceps", "Peso corporal", "composto"],
  ["Barra fixa pegada neutra", "Costas", "Bíceps, Antebraço", "Peso corporal", "composto"],
  ["Barra fixa assistida (gravitron)", "Costas", "Bíceps", "Máquina", "composto"],
  ["Barra fixa com elástico", "Costas", "Bíceps", "Elástico", "composto"],
  ["Puxada frontal pronada", "Costas", "Bíceps, Ombros (posterior)", "Polia", "composto"],
  ["Puxada frontal supinada", "Costas", "Bíceps", "Polia", "composto"],
  ["Puxada frontal pegada neutra (triângulo)", "Costas", "Bíceps", "Polia", "composto"],
  ["Puxada frontal aberta", "Costas", "Bíceps, Ombros (posterior)", "Polia", "composto"],
  ["Puxada atrás da nuca", "Costas", "Bíceps, Ombros (posterior)", "Polia", "composto"],
  ["Puxada unilateral na polia", "Costas", "Bíceps", "Polia", "composto"],
  ["Puxada na máquina articulada", "Costas", "Bíceps", "Máquina", "composto"],
  ["Pulldown com braços estendidos", "Costas", "Tríceps (cabeça longa)", "Polia", "isolado"],
  ["Pulldown com corda", "Costas", "Tríceps (cabeça longa)", "Polia", "isolado"],
  ["Remada curvada com barra", "Costas", "Bíceps, Ombros (posterior), Lombar", "Barra", "composto"],
  ["Remada curvada supinada", "Costas", "Bíceps, Lombar", "Barra", "composto"],
  ["Remada Pendlay", "Costas", "Bíceps, Lombar", "Barra", "composto"],
  ["Remada unilateral com halter (serrote)", "Costas", "Bíceps, Ombros (posterior)", "Halteres", "composto"],
  ["Remada com halteres apoiada no banco inclinado", "Costas", "Bíceps, Ombros (posterior)", "Halteres", "composto"],
  ["Remada cavalinho (barra T)", "Costas", "Bíceps, Lombar", "Barra", "composto"],
  ["Remada cavalinho na máquina", "Costas", "Bíceps", "Máquina", "composto"],
  ["Remada sentada na polia (triângulo)", "Costas", "Bíceps, Ombros (posterior)", "Polia", "composto"],
  ["Remada sentada na polia pegada aberta", "Costas", "Ombros (posterior), Bíceps", "Polia", "composto"],
  ["Remada sentada na máquina", "Costas", "Bíceps, Ombros (posterior)", "Máquina", "composto"],
  ["Remada articulada (hammer)", "Costas", "Bíceps", "Máquina", "composto"],
  ["Remada unilateral na polia", "Costas", "Bíceps", "Polia", "composto"],
  ["Remada baixa unilateral na máquina", "Costas", "Bíceps", "Máquina", "composto"],
  ["Remada no Smith", "Costas", "Bíceps, Lombar", "Smith", "composto"],
  ["Remada invertida (australiana)", "Costas", "Bíceps, Ombros (posterior)", "Peso corporal", "composto"],
  ["Remada com kettlebell", "Costas", "Bíceps", "Kettlebell", "composto"],
  ["Remada renegada", "Costas", "Abdômen, Ombros", "Halteres", "composto"],
  ["Remada com elástico", "Costas", "Bíceps", "Elástico", "composto"],
  ["Pullover na polia", "Costas", "Peito, Tríceps (cabeça longa)", "Polia", "isolado"],
  ["Pullover na máquina", "Costas", "Peito", "Máquina", "isolado"],
  ["Levantamento terra", "Costas", "Glúteos, Posterior de coxa, Lombar, Trapézio, Antebraço", "Barra", "composto"],
  ["Levantamento terra sumô", "Glúteos", "Adutores, Quadríceps, Costas, Lombar", "Barra", "composto"],
  ["Levantamento terra com barra hexagonal", "Quadríceps", "Glúteos, Costas, Trapézio", "Barra hexagonal", "composto"],
  ["Levantamento terra parcial (rack pull)", "Costas", "Trapézio, Glúteos, Lombar", "Barra", "composto"],
  ["Levantamento terra com halteres", "Costas", "Glúteos, Posterior de coxa", "Halteres", "composto"],
  ["Levantamento terra no Smith", "Costas", "Glúteos, Posterior de coxa", "Smith", "composto"],
  ["Desenvolvimento com barra (em pé)", "Ombros", "Tríceps, Trapézio", "Barra", "composto"],
  ["Desenvolvimento com barra sentado", "Ombros", "Tríceps", "Barra", "composto"],
  ["Desenvolvimento com halteres", "Ombros", "Tríceps", "Halteres", "composto"],
  ["Desenvolvimento com halteres em pé", "Ombros", "Tríceps, Abdômen", "Halteres", "composto"],
  ["Desenvolvimento na máquina", "Ombros", "Tríceps", "Máquina", "composto"],
  ["Desenvolvimento no Smith", "Ombros", "Tríceps", "Smith", "composto"],
  ["Desenvolvimento atrás da nuca", "Ombros", "Tríceps, Trapézio", "Barra", "composto"],
  ["Desenvolvimento Arnold", "Ombros", "Tríceps", "Halteres", "composto"],
  ["Desenvolvimento com kettlebell", "Ombros", "Tríceps", "Kettlebell", "composto"],
  ["Desenvolvimento unilateral na landmine", "Ombros", "Peito, Tríceps", "Landmine", "composto"],
  ["Push press", "Ombros", "Tríceps, Quadríceps", "Barra", "composto"],
  ["Flexão em pike (pique)", "Ombros", "Tríceps", "Peso corporal", "composto"],
  ["Elevação lateral com halteres", "Ombros", "Trapézio", "Halteres", "isolado"],
  ["Elevação lateral sentado", "Ombros", "", "Halteres", "isolado"],
  ["Elevação lateral na polia", "Ombros", "", "Polia", "isolado"],
  ["Elevação lateral na máquina", "Ombros", "", "Máquina", "isolado"],
  ["Elevação lateral inclinada", "Ombros", "", "Halteres", "isolado"],
  ["Elevação lateral com elástico", "Ombros", "", "Elástico", "isolado"],
  ["Elevação frontal com halteres", "Ombros", "Peito (superior)", "Halteres", "isolado"],
  ["Elevação frontal com barra", "Ombros", "Peito (superior)", "Barra", "isolado"],
  ["Elevação frontal com anilha", "Ombros", "Peito (superior)", "Anilha", "isolado"],
  ["Elevação frontal na polia", "Ombros", "", "Polia", "isolado"],
  ["Crucifixo invertido com halteres", "Ombros", "Trapézio, Romboides", "Halteres", "isolado"],
  ["Crucifixo invertido na máquina", "Ombros", "Trapézio, Romboides", "Máquina", "isolado"],
  ["Crucifixo invertido na polia", "Ombros", "Trapézio, Romboides", "Polia", "isolado"],
  ["Face pull", "Ombros", "Trapézio, Manguito rotador", "Polia", "composto"],
  ["Remada alta com barra", "Ombros", "Trapézio, Bíceps", "Barra", "composto"],
  ["Remada alta na polia", "Ombros", "Trapézio", "Polia", "composto"],
  ["Remada alta com halteres", "Ombros", "Trapézio", "Halteres", "composto"],
  ["Abertura com elástico (band pull-apart)", "Ombros", "Trapézio, Romboides", "Elástico", "isolado"],
  ["Rotação externa de ombro na polia", "Ombros", "Manguito rotador", "Polia", "isolado"],
  ["Rotação externa de ombro com halter", "Ombros", "Manguito rotador", "Halteres", "isolado"],
  ["Rotação interna de ombro na polia", "Ombros", "Manguito rotador", "Polia", "isolado"],
  ["Rotação externa com elástico", "Ombros", "Manguito rotador", "Elástico", "isolado"],
  ["Encolhimento com barra", "Trapézio", "Antebraço", "Barra", "isolado"],
  ["Encolhimento com halteres", "Trapézio", "Antebraço", "Halteres", "isolado"],
  ["Encolhimento no Smith", "Trapézio", "", "Smith", "isolado"],
  ["Encolhimento na máquina", "Trapézio", "", "Máquina", "isolado"],
  ["Encolhimento na polia", "Trapézio", "", "Polia", "isolado"],
  ["Encolhimento com barra hexagonal", "Trapézio", "Antebraço", "Barra hexagonal", "isolado"],
  ["Rosca direta com barra", "Bíceps", "Antebraço", "Barra", "isolado"],
  ["Rosca direta com barra W", "Bíceps", "Antebraço", "Barra W", "isolado"],
  ["Rosca direta com halteres", "Bíceps", "Antebraço", "Halteres", "isolado"],
  ["Rosca alternada com halteres", "Bíceps", "Antebraço", "Halteres", "isolado"],
  ["Rosca martelo", "Bíceps", "Braquiorradial (antebraço)", "Halteres", "isolado"],
  ["Rosca martelo na polia com corda", "Bíceps", "Braquiorradial (antebraço)", "Polia", "isolado"],
  ["Rosca martelo cruzada", "Bíceps", "Braquiorradial (antebraço)", "Halteres", "isolado"],
  ["Rosca Scott com barra W", "Bíceps", "", "Barra W", "isolado"],
  ["Rosca Scott com halter", "Bíceps", "", "Halteres", "isolado"],
  ["Rosca Scott na máquina", "Bíceps", "", "Máquina", "isolado"],
  ["Rosca concentrada", "Bíceps", "", "Halteres", "isolado"],
  ["Rosca na polia com barra", "Bíceps", "Antebraço", "Polia", "isolado"],
  ["Rosca na polia unilateral", "Bíceps", "", "Polia", "isolado"],
  ["Rosca bayesiana na polia", "Bíceps", "", "Polia", "isolado"],
  ["Rosca na polia alta (duplo bíceps)", "Bíceps", "", "Polia", "isolado"],
  ["Rosca inclinada com halteres", "Bíceps", "", "Halteres", "isolado"],
  ["Rosca spider", "Bíceps", "", "Halteres", "isolado"],
  ["Rosca 21", "Bíceps", "Antebraço", "Barra", "isolado"],
  ["Rosca na máquina", "Bíceps", "", "Máquina", "isolado"],
  ["Rosca Zottman", "Bíceps", "Antebraço", "Halteres", "isolado"],
  ["Rosca arrastada (drag curl)", "Bíceps", "", "Barra", "isolado"],
  ["Rosca com elástico", "Bíceps", "", "Elástico", "isolado"],
  ["Tríceps na polia com barra reta", "Tríceps", "", "Polia", "isolado"],
  ["Tríceps na polia com barra V", "Tríceps", "", "Polia", "isolado"],
  ["Tríceps na polia com corda", "Tríceps", "", "Polia", "isolado"],
  ["Tríceps na polia pegada invertida", "Tríceps", "", "Polia", "isolado"],
  ["Tríceps unilateral na polia", "Tríceps", "", "Polia", "isolado"],
  ["Tríceps francês com halter", "Tríceps", "", "Halteres", "isolado"],
  ["Tríceps francês com barra W", "Tríceps", "", "Barra W", "isolado"],
  ["Tríceps francês na polia com corda", "Tríceps", "", "Polia", "isolado"],
  ["Tríceps testa com barra W", "Tríceps", "", "Barra W", "isolado"],
  ["Tríceps testa com halteres", "Tríceps", "", "Halteres", "isolado"],
  ["Tríceps testa na polia", "Tríceps", "", "Polia", "isolado"],
  ["Tríceps coice com halter", "Tríceps", "", "Halteres", "isolado"],
  ["Tríceps coice na polia", "Tríceps", "", "Polia", "isolado"],
  ["Tríceps mergulho no banco", "Tríceps", "Peito, Ombros (anterior)", "Peso corporal", "composto"],
  ["Tríceps mergulho nas paralelas", "Tríceps", "Peito, Ombros (anterior)", "Peso corporal", "composto"],
  ["Tríceps mergulho na máquina", "Tríceps", "Peito", "Máquina", "composto"],
  ["Tríceps na máquina", "Tríceps", "", "Máquina", "isolado"],
  ["Flexão de braço fechada (diamante)", "Tríceps", "Peito, Ombros (anterior)", "Peso corporal", "composto"],
  ["Tríceps com elástico", "Tríceps", "", "Elástico", "isolado"],
  ["Rosca inversa com barra", "Antebraço", "Bíceps", "Barra", "isolado"],
  ["Rosca inversa com barra W", "Antebraço", "Bíceps", "Barra W", "isolado"],
  ["Rosca inversa na polia", "Antebraço", "Bíceps", "Polia", "isolado"],
  ["Rosca de punho com barra", "Antebraço", "", "Barra", "isolado"],
  ["Rosca de punho com halter", "Antebraço", "", "Halteres", "isolado"],
  ["Extensão de punho com barra", "Antebraço", "", "Barra", "isolado"],
  ["Extensão de punho com halter", "Antebraço", "", "Halteres", "isolado"],
  ["Rolo de punho", "Antebraço", "", "Acessório", "isolado"],
  ["Caminhada do fazendeiro", "Antebraço", "Trapézio, Abdômen, Pernas", "Halteres", "composto"],
  ["Suspensão na barra", "Antebraço", "Costas", "Peso corporal", "isolado"],
  ["Pinça de anilhas", "Antebraço", "", "Anilha", "isolado"],
  ["Hand grip", "Antebraço", "", "Acessório", "isolado"],
  ["Abdominal supra (crunch)", "Abdômen", "", "Peso corporal", "isolado"],
  ["Abdominal completo (sit-up)", "Abdômen", "Flexores do quadril", "Peso corporal", "isolado"],
  ["Abdominal infra no solo", "Abdômen", "Flexores do quadril", "Peso corporal", "isolado"],
  ["Elevação de pernas na paralela (abdominal infra)", "Abdômen", "Flexores do quadril", "Paralela", "isolado"],
  ["Elevação de joelhos na paralela", "Abdômen", "Flexores do quadril", "Paralela", "isolado"],
  ["Elevação de pernas na barra fixa", "Abdômen", "Flexores do quadril, Antebraço", "Peso corporal", "isolado"],
  ["Elevação de joelhos na barra fixa", "Abdômen", "Flexores do quadril", "Peso corporal", "isolado"],
  ["Abdominal na máquina", "Abdômen", "", "Máquina", "isolado"],
  ["Abdominal na polia ajoelhado", "Abdômen", "", "Polia", "isolado"],
  ["Abdominal bicicleta", "Abdômen", "Oblíquos", "Peso corporal", "isolado"],
  ["Abdominal oblíquo", "Abdômen", "Oblíquos", "Peso corporal", "isolado"],
  ["Abdominal remador", "Abdômen", "Flexores do quadril", "Peso corporal", "isolado"],
  ["Abdominal canivete (V-up)", "Abdômen", "Flexores do quadril", "Peso corporal", "isolado"],
  ["Abdominal declinado", "Abdômen", "Flexores do quadril", "Banco", "isolado"],
  ["Abdominal com bola suíça", "Abdômen", "", "Bola", "isolado"],
  ["Prancha", "Abdômen", "Ombros, Glúteos", "Peso corporal", "isolado"],
  ["Prancha lateral", "Abdômen", "Oblíquos, Glúteos", "Peso corporal", "isolado"],
  ["Prancha com toque no ombro", "Abdômen", "Ombros", "Peso corporal", "isolado"],
  ["Roda abdominal", "Abdômen", "Costas (latíssimo), Ombros", "Acessório", "isolado"],
  ["Dead bug", "Abdômen", "", "Peso corporal", "isolado"],
  ["Hollow hold (canoa)", "Abdômen", "", "Peso corporal", "isolado"],
  ["Pallof press", "Abdômen", "Oblíquos", "Polia", "isolado"],
  ["Lenhador na polia (de cima para baixo)", "Abdômen", "Oblíquos, Ombros", "Polia", "composto"],
  ["Lenhador na polia (de baixo para cima)", "Abdômen", "Oblíquos, Ombros", "Polia", "composto"],
  ["Rotação russa (russian twist)", "Abdômen", "Oblíquos", "Medicine ball", "isolado"],
  ["Flexão lateral com halter", "Abdômen", "Oblíquos", "Halteres", "isolado"],
  ["Escalador (mountain climber)", "Abdômen", "Ombros, Flexores do quadril", "Peso corporal", "composto"],
  ["Limpador de para-brisa", "Abdômen", "Oblíquos", "Peso corporal", "isolado"],
  ["Prancha Copenhagen", "Adutores", "Abdômen, Oblíquos", "Banco", "isolado"],
  ["Hiperextensão lombar (banco romano)", "Lombar", "Glúteos, Posterior de coxa", "Banco", "isolado"],
  ["Extensão lombar na máquina", "Lombar", "Glúteos", "Máquina", "isolado"],
  ["Bom dia com barra", "Lombar", "Posterior de coxa, Glúteos", "Barra", "composto"],
  ["Superman (extensão no solo)", "Lombar", "Glúteos", "Peso corporal", "isolado"],
  ["Perdigueiro (bird dog)", "Lombar", "Abdômen, Glúteos", "Peso corporal", "isolado"],
  ["Agachamento livre com barra", "Quadríceps", "Glúteos, Adutores, Lombar", "Barra", "composto"],
  ["Agachamento frontal", "Quadríceps", "Glúteos, Abdômen", "Barra", "composto"],
  ["Agachamento no Smith", "Quadríceps", "Glúteos", "Smith", "composto"],
  ["Agachamento hack na máquina", "Quadríceps", "Glúteos", "Máquina", "composto"],
  ["Agachamento hack com barra", "Quadríceps", "Glúteos", "Barra", "composto"],
  ["Agachamento pêndulo", "Quadríceps", "Glúteos", "Máquina", "composto"],
  ["Agachamento goblet", "Quadríceps", "Glúteos, Abdômen", "Halteres", "composto"],
  ["Agachamento com halteres", "Quadríceps", "Glúteos", "Halteres", "composto"],
  ["Agachamento livre (peso corporal)", "Quadríceps", "Glúteos", "Peso corporal", "composto"],
  ["Agachamento com salto", "Quadríceps", "Glúteos, Panturrilha", "Peso corporal", "composto"],
  ["Agachamento no banco (box squat)", "Quadríceps", "Glúteos", "Barra", "composto"],
  ["Agachamento na landmine", "Quadríceps", "Glúteos", "Landmine", "composto"],
  ["Agachamento com cinto (belt squat)", "Quadríceps", "Glúteos", "Máquina", "composto"],
  ["Agachamento Zercher", "Quadríceps", "Glúteos, Abdômen, Costas", "Barra", "composto"],
  ["Agachamento pistol (unilateral)", "Quadríceps", "Glúteos", "Peso corporal", "composto"],
  ["Agachamento sissy", "Quadríceps", "", "Peso corporal", "isolado"],
  ["Agachamento na parede (isometria)", "Quadríceps", "Glúteos", "Peso corporal", "isolado"],
  ["Agachamento búlgaro com halteres", "Quadríceps", "Glúteos, Adutores", "Halteres", "composto"],
  ["Agachamento búlgaro no Smith", "Quadríceps", "Glúteos", "Smith", "composto"],
  ["Leg press 45°", "Quadríceps", "Glúteos, Adutores", "Máquina", "composto"],
  ["Leg press horizontal", "Quadríceps", "Glúteos", "Máquina", "composto"],
  ["Leg press vertical", "Quadríceps", "Glúteos", "Máquina", "composto"],
  ["Leg press unilateral", "Quadríceps", "Glúteos", "Máquina", "composto"],
  ["Cadeira extensora", "Quadríceps", "", "Máquina", "isolado"],
  ["Cadeira extensora unilateral", "Quadríceps", "", "Máquina", "isolado"],
  ["Extensão de joelho na polia", "Quadríceps", "", "Polia", "isolado"],
  ["Afundo com halteres", "Quadríceps", "Glúteos, Adutores", "Halteres", "composto"],
  ["Afundo com barra", "Quadríceps", "Glúteos", "Barra", "composto"],
  ["Afundo no Smith", "Quadríceps", "Glúteos", "Smith", "composto"],
  ["Afundo reverso", "Glúteos", "Quadríceps", "Halteres", "composto"],
  ["Passada (afundo caminhando)", "Quadríceps", "Glúteos, Adutores", "Halteres", "composto"],
  ["Passada com barra", "Quadríceps", "Glúteos", "Barra", "composto"],
  ["Afundo lateral", "Adutores", "Quadríceps, Glúteos", "Peso corporal", "composto"],
  ["Afundo cruzado (curtsy)", "Glúteos", "Quadríceps, Adutores", "Peso corporal", "composto"],
  ["Subida no banco (step-up)", "Quadríceps", "Glúteos", "Halteres", "composto"],
  ["Avanço com salto", "Quadríceps", "Glúteos, Panturrilha", "Peso corporal", "composto"],
  ["Salto na caixa (box jump)", "Quadríceps", "Glúteos, Panturrilha", "Caixa", "composto"],
  ["Empurrar trenó", "Quadríceps", "Glúteos, Panturrilha", "Trenó", "composto"],
  ["Mesa flexora", "Posterior de coxa", "Panturrilha", "Máquina", "isolado"],
  ["Cadeira flexora", "Posterior de coxa", "", "Máquina", "isolado"],
  ["Flexora em pé (unilateral)", "Posterior de coxa", "", "Máquina", "isolado"],
  ["Flexora unilateral deitado", "Posterior de coxa", "", "Máquina", "isolado"],
  ["Flexão de joelho na polia", "Posterior de coxa", "", "Polia", "isolado"],
  ["Flexão de joelho com caneleira", "Posterior de coxa", "", "Caneleira", "isolado"],
  ["Flexão de joelho na bola suíça", "Posterior de coxa", "Glúteos", "Bola", "isolado"],
  ["Stiff com barra", "Posterior de coxa", "Glúteos, Lombar", "Barra", "composto"],
  ["Stiff com halteres", "Posterior de coxa", "Glúteos, Lombar", "Halteres", "composto"],
  ["Stiff no Smith", "Posterior de coxa", "Glúteos", "Smith", "composto"],
  ["Levantamento terra romeno", "Posterior de coxa", "Glúteos, Lombar", "Barra", "composto"],
  ["Stiff unilateral", "Posterior de coxa", "Glúteos", "Halteres", "composto"],
  ["Flexão nórdica", "Posterior de coxa", "", "Peso corporal", "isolado"],
  ["Glute ham raise", "Posterior de coxa", "Glúteos", "Banco", "isolado"],
  ["Elevação pélvica com barra (hip thrust)", "Glúteos", "Posterior de coxa", "Barra", "composto"],
  ["Elevação pélvica na máquina", "Glúteos", "Posterior de coxa", "Máquina", "composto"],
  ["Elevação pélvica no Smith", "Glúteos", "Posterior de coxa", "Smith", "composto"],
  ["Elevação pélvica unilateral", "Glúteos", "Posterior de coxa", "Peso corporal", "composto"],
  ["Ponte de glúteo", "Glúteos", "Posterior de coxa", "Peso corporal", "composto"],
  ["Ponte de glúteo unilateral", "Glúteos", "Posterior de coxa", "Peso corporal", "composto"],
  ["Coice na polia (glúteo no cabo)", "Glúteos", "Posterior de coxa", "Polia", "isolado"],
  ["Glúteo na máquina (coice)", "Glúteos", "Posterior de coxa", "Máquina", "isolado"],
  ["Glúteo quatro apoios com caneleira", "Glúteos", "Posterior de coxa", "Caneleira", "isolado"],
  ["Glúteo 4 apoios sem peso (donkey kick)", "Glúteos", "", "Peso corporal", "isolado"],
  ["Puxada entre as pernas na polia (pull through)", "Glúteos", "Posterior de coxa", "Polia", "composto"],
  ["Cadeira abdutora", "Glúteos", "Glúteo médio e mínimo", "Máquina", "isolado"],
  ["Abdução de quadril na polia", "Glúteos", "Glúteo médio", "Polia", "isolado"],
  ["Abdução de quadril com elástico", "Glúteos", "Glúteo médio", "Elástico", "isolado"],
  ["Abdução de quadril deitado (lateral)", "Glúteos", "Glúteo médio", "Peso corporal", "isolado"],
  ["Caminhada lateral com elástico", "Glúteos", "Glúteo médio", "Elástico", "isolado"],
  ["Concha (clamshell)", "Glúteos", "Glúteo médio, rotadores", "Elástico", "isolado"],
  ["Hidrante (fire hydrant)", "Glúteos", "Glúteo médio", "Peso corporal", "isolado"],
  ["Hiperextensão reversa", "Glúteos", "Posterior de coxa, Lombar", "Máquina", "isolado"],
  ["Agachamento sumô com halter", "Glúteos", "Adutores, Quadríceps", "Halteres", "composto"],
  ["Agachamento sumô com barra", "Glúteos", "Adutores, Quadríceps", "Barra", "composto"],
  ["Agachamento cossaco", "Adutores", "Glúteos, Quadríceps", "Peso corporal", "composto"],
  ["Kettlebell swing", "Glúteos", "Posterior de coxa, Lombar, Ombros", "Kettlebell", "composto"],
  ["Frog pump", "Glúteos", "", "Peso corporal", "isolado"],
  ["Cadeira adutora", "Adutores", "", "Máquina", "isolado"],
  ["Adução de quadril na polia", "Adutores", "", "Polia", "isolado"],
  ["Adução de quadril com elástico", "Adutores", "", "Elástico", "isolado"],
  ["Adução deitado (lateral)", "Adutores", "", "Peso corporal", "isolado"],
  ["Panturrilha em pé na máquina", "Panturrilha", "Gastrocnêmio", "Máquina", "isolado"],
  ["Panturrilha sentado (máquina)", "Panturrilha", "Sóleo", "Máquina", "isolado"],
  ["Panturrilha no leg press 45°", "Panturrilha", "Gastrocnêmio", "Máquina", "isolado"],
  ["Panturrilha no leg press horizontal", "Panturrilha", "Gastrocnêmio", "Máquina", "isolado"],
  ["Panturrilha no Smith", "Panturrilha", "Gastrocnêmio", "Smith", "isolado"],
  ["Panturrilha em pé com halter (unilateral)", "Panturrilha", "Gastrocnêmio", "Halteres", "isolado"],
  ["Panturrilha no degrau (peso corporal)", "Panturrilha", "Gastrocnêmio", "Peso corporal", "isolado"],
  ["Panturrilha burrinho (donkey)", "Panturrilha", "Gastrocnêmio", "Máquina", "isolado"],
  ["Panturrilha sentado com barra", "Panturrilha", "Sóleo", "Barra", "isolado"],
  ["Elevação de ponta de pé (tibial)", "Panturrilha", "Tibial anterior", "Peso corporal", "isolado"],
  ["Arremesso (clean and jerk)", "Corpo inteiro", "Pernas, Ombros, Costas", "Barra", "composto"],
  ["Arranco (snatch)", "Corpo inteiro", "Pernas, Ombros, Costas", "Barra", "composto"],
  ["Power clean", "Corpo inteiro", "Pernas, Trapézio, Costas", "Barra", "composto"],
  ["Thruster", "Corpo inteiro", "Quadríceps, Ombros, Glúteos", "Barra", "composto"],
  ["Thruster com halteres", "Corpo inteiro", "Quadríceps, Ombros", "Halteres", "composto"],
  ["Burpee", "Corpo inteiro", "Peito, Pernas", "Peso corporal", "cardio"],
  ["Levantamento turco (turkish get-up)", "Corpo inteiro", "Ombros, Abdômen, Glúteos", "Kettlebell", "composto"],
  ["Arremesso de medicine ball no chão (slam)", "Corpo inteiro", "Abdômen, Ombros, Costas", "Medicine ball", "composto"],
  ["Corda naval (battle rope)", "Corpo inteiro", "Ombros, Abdômen", "Corda", "cardio"],
  ["Wall ball", "Corpo inteiro", "Quadríceps, Ombros", "Medicine ball", "composto"],
  ["Esteira", "Cardio", "", "Aparelho de cardio", "cardio"],
  ["Esteira inclinada (caminhada)", "Cardio", "Glúteos, Panturrilha", "Aparelho de cardio", "cardio"],
  ["Bicicleta ergométrica", "Cardio", "Quadríceps", "Aparelho de cardio", "cardio"],
  ["Bicicleta horizontal", "Cardio", "Quadríceps", "Aparelho de cardio", "cardio"],
  ["Spinning (bike indoor)", "Cardio", "Quadríceps, Glúteos", "Aparelho de cardio", "cardio"],
  ["Elíptico (transport)", "Cardio", "Pernas, Braços", "Aparelho de cardio", "cardio"],
  ["Escada (simulador)", "Cardio", "Glúteos, Quadríceps, Panturrilha", "Aparelho de cardio", "cardio"],
  ["Remo ergômetro", "Cardio", "Costas, Pernas", "Aparelho de cardio", "cardio"],
  ["Air bike", "Cardio", "Pernas, Braços", "Aparelho de cardio", "cardio"],
  ["Pular corda", "Cardio", "Panturrilha", "Corda", "cardio"],
  ["Polichinelo", "Cardio", "", "Peso corporal", "cardio"],
  ["Corrida", "Cardio", "Pernas", "Ao ar livre", "cardio"],
  ["Caminhada", "Cardio", "Pernas", "Ao ar livre", "cardio"]
];

/** Nomes antigos ou populares → nome do catálogo. "?" no fim: confirmar o equipamento. */
var APELIDOS_CATALOGO_ = {
  "Crucifixo Máquina": "Crucifixo na máquina (voador)",
  "Supino Máquina": "Supino reto na máquina",
  "Supino Inclinado": "Supino inclinado com halteres?",
  "Tríceps Mergulho": "Tríceps mergulho na máquina?",
  "Tríceps Corda": "Tríceps na polia com corda",
  "Tríceps Pulley Barra V": "Tríceps na polia com barra V",
  "Escada": "Escada (simulador)",
  "Cadeira Extensora": "Cadeira extensora",
  "Cadeira Flexora": "Cadeira flexora",
  "Cadeira Abdutora": "Cadeira abdutora",
  "Cadeira Adutora": "Cadeira adutora",
  "Leg Press 45°": "Leg press 45°",
  "Agachamento Smith": "Agachamento no Smith",
  "Panturrilha no Leg Horizontal": "Panturrilha no leg press horizontal",
  "Esteira": "Esteira",
  "Elevação Lateral": "Elevação lateral com halteres",
  "Desenvolvimento c/ Halter": "Desenvolvimento com halteres",
  "Crucifixo Invertido Máquina": "Crucifixo invertido na máquina",
  "Encolhimento c/ Halter": "Encolhimento com halteres",
  "Abdômen Completo": "Abdominal na máquina?",
  "Abdômen Infra na Paralela": "Elevação de pernas na paralela (abdominal infra)",
  "Remada Curvada c/ Barra": "Remada curvada com barra",
  "Remada na Máquina": "Remada sentada na máquina",
  "Puxada Pronada": "Puxada frontal pronada",
  "Puxada supinada": "Puxada frontal supinada",
  "Rosca Direta c/ Halter": "Rosca direta com halteres",
  "Rosca Scott na Máquina": "Rosca Scott na máquina",
  "Rosca Inversa": "Rosca inversa com barra?",
  "Levantamento Terra": "Levantamento terra",
  "Panturrilha Sentadilha": "Panturrilha sentado (máquina)",
  "Supino reto": "Supino reto com barra",
  "Supino": "Supino reto com barra",
  "Peck deck": "Crucifixo na máquina (voador)",
  "Voador": "Crucifixo na máquina (voador)",
  "Crossover": "Crucifixo na polia (crossover alto)",
  "Pulley frente": "Puxada frontal pronada",
  "Puxada frente": "Puxada frontal pronada",
  "Puxada alta": "Puxada frontal pronada",
  "Remada baixa": "Remada sentada na polia (triângulo)",
  "Serrote": "Remada unilateral com halter (serrote)",
  "Agachamento livre": "Agachamento livre com barra",
  "Agachamento": "Agachamento livre com barra",
  "Leg press": "Leg press 45°",
  "Hack": "Agachamento hack na máquina",
  "Hip thrust": "Elevação pélvica com barra (hip thrust)",
  "Elevação pélvica": "Elevação pélvica com barra (hip thrust)",
  "Stiff": "Stiff com barra",
  "Terra": "Levantamento terra",
  "Rosca direta": "Rosca direta com barra",
  "Rosca alternada": "Rosca alternada com halteres",
  "Tríceps pulley": "Tríceps na polia com barra reta",
  "Tríceps testa": "Tríceps testa com barra W",
  "Tríceps francês": "Tríceps francês com halter",
  "Desenvolvimento": "Desenvolvimento com halteres",
  "Elevação frontal": "Elevação frontal com halteres",
  "Encolhimento": "Encolhimento com halteres",
  "Panturrilha em pé": "Panturrilha em pé na máquina",
  "Panturrilha sentada": "Panturrilha sentado (máquina)",
  "Abdominal": "Abdominal supra (crunch)",
  "Bike": "Bicicleta ergométrica",
  "Elíptico": "Elíptico (transport)",
  "Transport": "Elíptico (transport)",
  "Remo": "Remo ergômetro"
};


// ===== 15_Semear.gs =====
/**
 * Carga do catálogo base (14_Catalogo.gs) e junção de exercícios repetidos.
 *
 * semear (administrador, com prévia):
 *   1. Nomes antigos conhecidos (APELIDOS_CATALOGO_) viram o nome padrão. Se o nome padrão já existe
 *      como outro exercício, os dois são juntados: fichas, séries e programas passam para o padrão.
 *      Apelidos marcados com "?" só entram se o administrador confirmar (o equipamento é suposição).
 *   2. Exercícios do catálogo que ainda não existem são criados no catálogo geral.
 *   3. Os que já existem com o mesmo nome ganham grupo, músculos secundários, equipamento e tipo
 *      de movimento quando esses campos estão vazios (ou com grupo fora da lista padrão).
 * Pode rodar de novo: nada é duplicado.
 */

function idCatalogo_(nome) {
  return 'cat_' + sha256_('catalogo|' + normalizarNome_(nome)).slice(0, 24);
}

function planoSemeadura_(confirmados) {
  confirmados = confirmados || {};
  var todos = lerTodos_('exercicios');
  var porNome = {};
  todos.forEach(function (e) { porNome[normalizarNome_(e.nome)] = porNome[normalizarNome_(e.nome)] || e; });
  var base = {};
  CATALOGO_BASE_.forEach(function (c) { base[normalizarNome_(c[0])] = c; });

  var renomear = [];
  var juntar = [];
  var duvidas = [];
  var tocados = {};
  Object.keys(APELIDOS_CATALOGO_).forEach(function (antigo) {
    var alvoBruto = APELIDOS_CATALOGO_[antigo];
    var duvidoso = /\?$/.test(alvoBruto);
    var alvo = alvoBruto.replace(/\?$/, '');
    var ex = porNome[normalizarNome_(antigo)];
    if (!ex || normalizarNome_(antigo) === normalizarNome_(alvo)) return;
    var item = { antigo: ex.nome, novo: alvo, id: ex.id };
    if (duvidoso && !confirmados[ex.nome]) { duvidas.push(item); return; }
    var existente = porNome[normalizarNome_(alvo)];
    if (existente && existente.id !== ex.id) { item.para_id = existente.id; juntar.push(item); }
    else renomear.push(item);
    tocados[normalizarNome_(alvo)] = true;
  });

  var criar = [];
  var completar = [];
  CATALOGO_BASE_.forEach(function (c) {
    var k = normalizarNome_(c[0]);
    var ex = porNome[k];
    if (!ex) {
      if (!tocados[k]) criar.push(c);
      return;
    }
    var campos = {};
    if (ex.global && ex.nome !== c[0]) campos.nome = c[0]; // mesma palavra, grafia do catálogo
    if (!ex.grupo_muscular || GRUPOS_MUSCULARES.indexOf(ex.grupo_muscular) < 0) campos.grupo_muscular = c[1];
    if (!ex.secundarios && c[2]) campos.secundarios = c[2];
    if (!ex.equipamento && c[3]) campos.equipamento = c[3];
    if (!ex.mecanica) campos.mecanica = c[4];
    if (Object.keys(campos).length) completar.push({ id: ex.id, nome: ex.nome, campos: campos });
  });
  return { renomear: renomear, juntar: juntar, duvidas: duvidas, criar: criar, completar: completar, base: base };
}

/** dados: { confirmar: ["Supino Inclinado", ...] } — apelidos com "?" que o administrador aceitou. */
function semearCatalogo_(d, soPrevia, ctx) {
  var confirmados = {};
  (Array.isArray(d.confirmar) ? d.confirmar : []).slice(0, 100).forEach(function (n) { if (typeof n === 'string') confirmados[n] = true; });
  var plano = planoSemeadura_(confirmados);
  var resumo = {
    catalogo: CATALOGO_BASE_.length,
    criar: plano.criar.length,
    completar: plano.completar.length,
    renomear: plano.renomear.map(function (r) { return { antigo: r.antigo, novo: r.novo }; }),
    juntar: plano.juntar.map(function (r) { return { antigo: r.antigo, novo: r.novo }; }),
    duvidas: plano.duvidas.map(function (r) { return { antigo: r.antigo, novo: r.novo }; }),
    grupos: GRUPOS_MUSCULARES
  };
  if (soPrevia) return resumo;

  comBloqueio_(function () {
    var autor = ctx.usuario.id;
    // renomear (e completar com os dados do catálogo)
    upsertLoteSemBloqueio_('exercicios', plano.renomear.map(function (r) {
      var c = plano.base[normalizarNome_(r.novo)] || [];
      return { id: r.id, nome: r.novo, grupo_muscular: c[1] || '', secundarios: c[2] || '', equipamento: c[3] || '', mecanica: c[4] || '', global: true };
    }));
    // juntar repetidos
    plano.juntar.forEach(function (r) { mesclarSemBloqueio_(r.id, r.para_id); });
    // completar campos vazios
    upsertLoteSemBloqueio_('exercicios', plano.completar.map(function (x) { return Object.assign({ id: x.id }, x.campos); }));
    // criar os que faltam
    var existentes = {};
    lerTodos_('exercicios', true).forEach(function (e) { existentes[e.id] = true; });
    upsertLoteSemBloqueio_('exercicios', plano.criar
      .map(function (c) {
        return { id: idCatalogo_(c[0]), nome: c[0], grupo_muscular: c[1], secundarios: c[2], equipamento: c[3], mecanica: c[4], video_url: '', criado_por: autor, global: true, status: '', excluido_em: null };
      })
      .filter(function (x) { return !existentes[x.id]; }));
    inserirSemBloqueio_('auditoria', { usuario_id: autor, acao: 'catalogo.semear', alvo: '', detalhes: JSON.stringify({ criar: resumo.criar, renomear: resumo.renomear.length, juntar: resumo.juntar.length }) });
  });
  resumo.feito = true;
  return resumo;
}

/** Junta dois exercícios: tudo o que usa "de" passa a usar "para"; "de" sai do catálogo. */
function mesclarSemBloqueio_(deId, paraId) {
  if (deId === paraId) throw erro_('VALIDACAO', 'Escolha dois exercícios diferentes.');
  var de = buscarUm_('exercicios', { id: deId });
  var para = buscarUm_('exercicios', { id: paraId });
  if (!de || !para) throw erro_('NAO_ENCONTRADO', 'Exercício não encontrado.');
  var r = {};
  ['ficha_itens', 'series', 'programa_itens'].forEach(function (tabela) {
    var lista = lerTodos_(tabela, true).filter(function (x) { return x.exercicio_id === deId; });
    upsertLoteSemBloqueio_(tabela, lista.map(function (x) { return { id: x.id, exercicio_id: paraId }; }));
    r[tabela] = lista.length;
  });
  var campos = { excluido_em: agora_(), status: 'juntado:' + paraId };
  atualizarSemBloqueio_('exercicios', deId, campos);
  if (!para.video_url && de.video_url) atualizarSemBloqueio_('exercicios', paraId, { video_url: de.video_url });
  return r;
}

function mesclarExercicios_(d, ctx) {
  var de = id_(d.de, 'exercício');
  var para = id_(d.para, 'exercício');
  return comBloqueio_(function () {
    var r = mesclarSemBloqueio_(de, para);
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'catalogo.juntar', alvo: de, detalhes: para + ' ' + JSON.stringify(r) });
    return r;
  });
}

/** Pelo editor do Apps Script: prévia e carga do catálogo (usa o ADMIN_EMAIL como autor). */
function previaCatalogo() {
  var r = semearCatalogo_({}, true, null);
  console.log(JSON.stringify(r, null, 2));
  return r;
}

function carregarCatalogo() {
  var admin = buscarUm_('usuarios', { email: prop_('ADMIN_EMAIL', true).toLowerCase() });
  if (!admin) throw new Error('Cadastre a conta do administrador antes.');
  var r = semearCatalogo_({}, false, { usuario: admin });
  console.log(JSON.stringify(r, null, 2));
  return r;
}
