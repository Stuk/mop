/*global describe,it,expect */
var spawn = require("child_process").spawn;
var PATH = require("path");
var Q = require("q");

var optimize = require("../optimize");

describe("mopping", function () {

    describe("Mr", function () {
        [
            "simple"
        ].forEach(function (name) {
            it(name, function (done) {
                var location = PATH.join(__dirname, "fixtures", name);
                test(name, location, done);
            });
        });
    });
});


// Wrap shelling out to `npm install` in a promise
function npmInstall(location) {
    var deferred = Q.defer();
    var proc = spawn("npm", ["install"], {
        cwd: location,
        stdio: "inherit"
    });
    proc.on('exit', function(code) {
        if (code !== 0) {
            deferred.reject(new Error("npm install in " + location + " exited with code " + location));
        } else {
            deferred.resolve();
        }
    });
    return deferred.promise;
}

/**
 * Serves a directory
 * @param  {string} location Path to the directory to serve
 * @return {string}          URL to the server
 */
function serve(location) {
    var joey = require("joey");

    var server = joey
    .error(true)
    .fileTree(location)
    .server();

    server.listen(0).done();

    var serverPort = server.node.address().port;
    var serverUrl = "http://127.0.0.1:" + serverPort + "/";
    console.log("Serving", location, "at", serverUrl);

    return [server, serverUrl];
}

/**
 * Starts up PhantomJS with a webdriver interface
 * @return {Promise<wd>} Promise for an initialized browser from wd.js
 */
function phantom() {
    var wd = require("wd");

    var phantomProc = spawn("phantomjs", ["--webdriver=127.0.0.1:8910"], {
        stdio: "inherit"
    });

    var browser = wd.promiseRemote("127.0.0.1", 8910);

    // Kill phantom when the browser is quit
    var originalQuit = browser.quit;
    browser.quit = function () {
        return originalQuit.call(browser)
        .finally(function () {
            phantomProc.kill();
        });
    };

    // wait for Ghost Driver to start running
    return Q.delay(2000)
    .then(function () {
        return browser.init();
    })
    .then(function () {
        return browser;
    });
}

function run(browser, url) {
    var POLL_TIME = 250;

    return browser.get(url)
    .then(function () {
        var done = Q.defer();

        var poll = function() {
            browser.execute("return window.done").then(function (isDone) {
                if (isDone) {
                    done.resolve();
                } else {
                    setTimeout(poll, POLL_TIME);
                }
            }, done.reject);
        };
        poll();

        return done.promise;
    })
    .then(function () {
        return browser.execute("return window.error");
    });
}

function test(name, location, done) {
    var buildLocation = PATH.join(location, "builds", name);

    npmInstall(location)
    .then(function () {
        return optimize(location);
    })
    .then(function () {
        var value = serve(buildLocation),
            server = value[0],
            url = value[1];
        return phantom().then(function (browser) {
            return run(browser, url + "index.html")
            .then(function (value) {
                server.stop();
                browser.quit().done();
                return value;
            });
        });
    })
    .then(function (error) {
        expect(error).toBe(null);
    })
    .fail(function (error) {
        expect(false).toBe(true);
        console.error(error.stack);
    })
    .finally(function () {
        done();
    });
}
