var Require = require("mr/require");
var Bootstrap = require("mr/bootstrap-node");
// var Bootstrap = require("montage");

var fs = require("fs"),
    http = require("http"),
    url = require("url");

var STATIC_DIR = __dirname + "/../static";

var package = process.argv[2];

console.log("Reading", package);

// var config;
var config = {};
config.makeLoader = function(config) {
    var load = Require.makeLoader(config);
    return function (id, module) {
        return load(id, module).fail(function(err) {
            console.log("Ignoring '" + id + "'");
            module.id = module.id + " (ignored)";
            module.ignored = true;
            return {}
        });
    };
};

Bootstrap.loadPackage(package, config)
.then(function (loader) {
    return loader.deepLoad("core/project-controller")
    .then(function () {
        return loader.modules;
    })
    .then(function (modules) {
        var ids = Object.keys(modules), nodes = [], links = [];
        ids.forEach(function (id, index) {
            var module = modules[id];

            nodes.push({ id: module.id, ignored: module.ignored });

            (module.dependencies || []).forEach(function (dep) {
                // HACK
                if (dep.indexOf("./") === 0) {
                    dep = dep.substr(2);
                }
                var targetIndex = ids.indexOf(dep);

                // links is an array of objects, where "source" is the index
                // in the nodes array of the source, and "target" is the index
                // in the nodes array of the target
                if (targetIndex !== -1) {
                    links.push({ source: index, target: ids.indexOf(dep)});
                }
            });
        });

        return { nodes: nodes, links: links};
    })
    .then(function (data) {
        http.createServer(function (request, response) {
            var path = url.parse(request.url).path;
            switch (path) {
                case "/index.html":
                case "/d3.min.js":
                case "/graph.js":
                case "/style.css":
                    response.end(fs.readFileSync(STATIC_DIR + path, "utf8"), "utf8");
                    break;
                case "/data.json":
                    response.end(JSON.stringify(data), "utf8");
                    break;
                default:
                    response.end("404", "utf8");
            }
        }).listen(8000);

        console.log("Server started at http://127.0.0.1:8000");
        console.log("Press Ctrl+C to end");
    });
}).done();
