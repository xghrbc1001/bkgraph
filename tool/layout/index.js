var ForceLayout = require('./ForceLayout');
var TreeLayout = require('./TreeLayout');
var Graph = require('../common/Graph');
var Tree = require('../common/Tree');
var vec2 = require('../common/vector');
var config = require('./config');

function layout(data, opts) {
    opts = opts || {};
    for (var name in config) {
        if (!(name in opts)) {
            opts[name] = config[name];
        }
    }
    opts.width = opts.width || 1280;
    opts.height = opts.height || 800;
    opts.layerDistance = opts.layerDistance || [];

    var noPosition = data.entities.filter(function (entity) {
        return entity.position == null;
    }).length > 0;

    var graph = getGraph(data, opts);

    // if (noPosition) {
        radialTreeLayout(graph, opts);
    // }
    forceLayout(graph, opts);

    graph.eachNode(function (node) {
        node.data.position = node.layout.position;
    });
}

function radialTreeLayout(graph, opts) {
    var cx = opts.width / 2;
    var cy = opts.height / 2;
    var tree = Tree.fromGraph(graph)[0];
    
    var root = tree.root;
    // 第一层节点均匀排布，大的子树相离尽量远
    if (root.children.length > 2) {
        for (var i = 0; i < root.children.length; i++) {
            var child = root.children[i];
            child.__size = 0;
            root.children[i].traverse(function () {
                child.__size++;
            });
        }
        root.children.sort(function (a, b) {
            return b.__size - a.__size;
        });
        var res = [root.children[0], root.children[1]];
        var currentIdx = 1;
        for (i = 2; i < root.children.length; i++) {
            res.splice(currentIdx, 0, root.children[i]);
            currentIdx += 2;
            if (currentIdx > res.length) {
                currentIdx = 1;
            }
        }
        root.children = res;
    }

    tree.traverse(function (treeNode) {
        var graphNode = graph.getNodeById(treeNode.id);
        treeNode.layout = {
            width: graphNode.layout.size * 2,
            height: graphNode.layout.size * 2
        };
    }, this);
    var layout = new TreeLayout();

    layout.layerPadding = function (level) {
        return opts.layerDistance[level] || 200;
    };
    layout.run(tree);

    var min = [Infinity, Infinity];
    var max = [-Infinity, -Infinity];
    tree.traverse(function (treeNode) {
        vec2.min(min, min, treeNode.layout.position);
        vec2.max(max, max, treeNode.layout.position);
    });
    var width = max[0] - min[0] + 0.1;
    var height = max[1] - min[1];

    tree.traverse(function (treeNode) {
        var graphNode = graph.getNodeById(treeNode.id);
        var x = treeNode.layout.position[0];
        var y = treeNode.layout.position[1];
        var r = y;
        var rad = x / width * Math.PI * 2;

        graphNode.layout.position = [
            // 以中心节点为圆心
            r * Math.cos(rad) + cx,
            r * Math.sin(rad) + cy
        ];
        treeNode.layout.angle = rad;
    }, this);

    // 第一层节点均匀分布
    if (tree.root.children.length <= 4) {
        var gap = Math.PI * 2 / tree.root.children.length;
        var angle = 0;
        for (var i = 0; i < tree.root.children.length; i++) {
            var child = tree.root.children[i];
            var r = child.layout.position[1];
            var graphNode = graph.getNodeById(child.id);
            if (i === 0) {
                angle = child.layout.angle;
            } else {
                angle += gap;
            }

            graphNode.layout.position = [
                r * Math.cos(angle) + cx,
                r * Math.sin(angle) + cy
            ];
        }
    }
}

function forceLayout(graph, opts) {

    var forceLayout = new ForceLayout();
    forceLayout.scaling = Math.sqrt(graph.nodes.length / 100) * 12;
    forceLayout.edgeLength = Math.max(graph.nodes.length / 100 * 150, 100);
    forceLayout.preventNodeOverlap = true;
    forceLayout.preventNodeEdgeOverlap = true;
    forceLayout.center = [opts.width / 2, opts.height / 2];

    var layerDistance = opts.layerDistance.slice();
    for (var i = 1; i < layerDistance.length; i++) {
        layerDistance[i] = layerDistance[i - 1] + layerDistance[i];
    }
    forceLayout.layerConstraint = opts.layerConstraint;
    forceLayout.layerDistance = layerDistance;

    graph.eachNode(function (n) {
        n.layout.mass = 15;
    });
    forceLayout.init(graph);

    var count = 0;
    while (count < 50 && !forceLayout.isStable()) {
        forceLayout.step(10);
        count += 1;
    }
    console.log(count * 10);
}

function getGraph(data, opts) {
    var graph = new Graph(true);
    // 映射数据
    var max = -Infinity;
    var min = Infinity;
    var minRadius = opts.minRadius || 30;
    var maxRadius = opts.maxRadius || 40;

    data.entities.forEach(function (entity) {
        min = Math.min(min, entity.hotValue);
        max = Math.max(max, entity.hotValue);
    });
    var diff = max - min;

    data.entities.forEach(function (entity) {
        var n = graph.addNode(entity.id, entity);
        var r = diff > 0 ?
            (entity.hotValue - min) * (maxRadius - minRadius) / diff + minRadius
            : (maxRadius + minRadius) / 2;

        n.layout = {
            position: entity.position,
            size: r,
            mass: 1,
            layer: +entity.layerCounter
        };

        if (+entity.layerCounter === 0) {
            n.layout.position = [opts.width / 2, opts.height / 2];
            n.layout.size = 70;
        }
    });

    data.relations.forEach(function (relation) {
        if (!relation.isExtra) {
            var e = graph.addEdge(relation.fromID, relation.toID, relation);
            if (e) {
                e.layout = {
                    weight: 20
                }
            }
        }
    });

    return graph;
}

module.exports = layout;