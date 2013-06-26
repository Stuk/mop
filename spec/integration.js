/*global describe,it,expect */
var spawn = require("child_process").spawn;
var FS = require("q-io/fs");
var PATH = require("path");
var Q = require("q");

var optimize = require("../optimize");

var DEBUG = false;
var TIMEOUT = 30000;

describe("mopping", function () {

    describe("Mr", function () {
        [
            "simple",
            "module"
        ].forEach(function (name) {
            it(name, function (done) {
                var self = this;

                var location = PATH.join(__dirname, "fixtures", name);
                test(name, location, done).
                fail(function (error) {
                    self.fail(error);
                })
                .finally(done);
            }, TIMEOUT);
        });
    });
});

/**
 * Wrap executing a command in a promise
 * @param  {string} command command to execute
 * @param  {Array<string>} args    Arguments to the command.
 * @param  {string} cwd     The working directory to run the command in.
 * @return {Promise}        A promise for the completion of the command.
 */
function exec(command, args, cwd) {
    var deferred = Q.defer();
    var proc = spawn(command, args, {
        cwd: cwd,
        stdio: DEBUG ? "inherit" : "ignore"
    });
    proc.on('exit', function(code) {
        if (code !== 0) {
            deferred.reject(new Error(command + " " + args.join(" ") + " in " + location + " exited with code " + code));
        } else {
            deferred.resolve();
        }
    });
    return deferred.promise;
}

// Wrap shelling removing node_modules and running `npm install` in a promise.
function npmSetup(location) {
    var nodeModulesPath = PATH.join(location, "node_modules");
    return FS.removeTree(nodeModulesPath)
    // swallow failure for when node_modules does not exist
    .fail(function () {})
    .then(function () {
        return FS.makeDirectory(nodeModulesPath);
    })
    .then(function () {
        // copy Mr and Montage into the node_modules
        return Q.all([
            FS.copyTree("node_modules/mr", PATH.join(nodeModulesPath, "mr")),
            FS.copyTree("node_modules/montage", PATH.join(nodeModulesPath, "montage"))
        ]);
    })
    .then(function () {
        // install any other dependencies
        return exec("npm", ["install"], location);
    });
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
    if (DEBUG) {
        console.log("Serving", location, "at", serverUrl);
    }

    return [server, serverUrl];
}

/**
 * Starts up PhantomJS with a webdriver interface
 * @return {Promise<wd>} Promise for an initialized browser from wd.js
 */
function phantom() {
    var wd = require("wd");

    var phantomProc = spawn("phantomjs", ["--webdriver=127.0.0.1:8910"], {
        stdio: DEBUG ? "inherit" : "ignore"
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

function test(name, location) {
    var buildLocation = PATH.join(location, "builds", name);

    var config = {
        // If debug pass undefined so we get default output, otherwise disable
        out: DEBUG ? void 0 : {}
    };

    return npmSetup(location)
    .then(function () {
        return optimize(location, config);
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
    });
}
