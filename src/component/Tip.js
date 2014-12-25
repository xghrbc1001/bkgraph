define(function (require) {
    
    var Component = require('./Component');
    var zrUtil = require('zrender/tool/util');
    var etpl = require('etpl');
    var Sizzle = require('Sizzle');
    var util = require('../util/util');
    var bkgLog = require('../util/log');

    etpl.compile(require('text!../html/tip.html'));

    var Tip = function () {

        Component.call(this);

        this._isMouseenter = false;

        var self = this;
        util.addEventListener(this.el, 'click', function (e) {
            self._dispatchClick(e);
        });

        util.addEventListener(this.el, 'mouseenter', function (e) {
            self._isMouseenter = true;
            self.show();
            bkgLog({
                type: 'zhishitupuhover',
                target: self._logParam,
                area: 'tip'
            });
        });

        util.addEventListener(this.el, 'mouseleave', function (e) {
            self._isMouseenter = false;
            self.hide();
        });
    }

    Tip.prototype.type = 'TIP';

    Tip.prototype.initialize = function (kg, data) {

        this._kgraph = kg;

        this.el.className = 'bkg-tip-wrapper hidden';

        return this.el;
    }

    Tip.prototype._fixData = function (data) {
        // tag 
        var tagData = data.singleTag || data.pairTag || [];
        var tagWordLength = 0;
        for (var i = 0, len = tagData.length; i < len; i++) {
            tagWordLength += tagData[i].text.length;
            if (tagWordLength > 20) {
                tagData = tagData.slice(0, i);
                break;
            }
        }
        data.singleTag ? ( data.singleTag = tagData ) : '';
        data.pairTag ? ( data.pairTag = tagData ) : '';
        return data;
    };

    Tip.prototype.setData = function (data, n, isRelation) {
        data = this._fixData(data);
        this.render(data, n, isRelation);
    };

    Tip.prototype.render = function (data, n, isRelation) {
        
        data.arrowType = this._getDirection(n, isRelation);

        this._setPosition(data.arrowType, n, isRelation);

        if (isRelation) {
            var relationTipRenderer = etpl.getRenderer('relationTip');
            this.el.innerHTML = relationTipRenderer(data);
            this._logParam = [
                                // from entity
                                data.fromID,
                                data.fromEntity.layerCounter,
                                // to entity
                                data.toID,
                                data.toEntity.layerCounter,
                                data.id,
                                data.isExtra ? 1 : 0,
                                data.isSpecial ? 1 : 0
                            ].join(',');
        } else {
            var entityTipRenderer = etpl.getRenderer('entityTip');
            this.el.innerHTML = entityTipRenderer(data);
            this._logParam = data.id + ',' + data.layerCounter;
        }

        this.show();
    };

    Tip.prototype._getDirection = function (n, isRelation) {

        var position = n.entity.el.position;
        var leftPos = position[0];
        var topPos = position[1];

        if (isRelation) {
            leftPos = n.entity.el.style.cx;
            topPos = n.entity.el.style.cy;
        }

        var graphMain = this._kgraph.getComponentByType('GRAPH');
        var zr = graphMain.getZR();
        var layer = zr.painter.getLayer(0);
        leftPos += layer.position[0];
        topPos += layer.position[1];

        // 缩放
        var zoom = layer.__zoom || 1;
        leftPos *= zoom;
        topPos *= zoom;

        var windowWidth = document.body.clientWidth;
        var windowHeight = document.body.clientHeight;

        var direction = 'left';

        if (leftPos > windowWidth * 0.75) {
            direction = 'right';
            if (topPos > windowHeight * 0.85) {
                direction = 'bottom';
            }
            if (topPos < windowHeight * 0.15) {
                direction = 'top';
            }
        }
        else {
            if (topPos > windowHeight * 0.85) {
                direction = 'bottom';
            }
            if (topPos < windowHeight * 0.15) {
                direction = 'top';
            }
        }

        return direction;
    };

    Tip.prototype._setPosition = function (direction, n, isRelation) {
        var position = n.entity.el.position;
        var leftPos = position[0];
        var topPos = position[1];

        if (isRelation) {
            leftPos = n.entity.el.style.cx;
            topPos = n.entity.el.style.cy;
        }

        var graphMain = this._kgraph.getComponentByType('GRAPH');
        var zr = graphMain.getZR();
        var layer = zr.painter.getLayer(0);

        // 缩放
        var zoom = layer.__zoom || 1;
        leftPos *= zoom;
        topPos *= zoom;

        leftPos += layer.position[0];
        topPos += layer.position[1];

        var style = util.getStyle(this.el);

        switch (direction) {
            case 'top':
                leftPos -= parseInt(style.width) / 2 + parseInt(style.paddingLeft);
                if (isRelation) {
                    topPos += n.entity.el.style.a;
                }
                else {
                    topPos += (parseInt(style.paddingBottom) + 10) * zoom ;
                }
                break;

            case 'right':
                topPos -= parseInt(style.height) / 2 + parseInt(style.paddingTop);
                if (isRelation) {
                    leftPos -= parseInt(style.width) + n.entity.el.style.b * 1.5;
                }
                else {
                    leftPos -= parseInt(style.width) + n.entity.radius + 10;
                }
                leftPos -= parseInt(style.paddingLeft) + 15;
                break;

            case 'bottom':
                leftPos -= parseInt(style.width) / 2 + parseInt(style.paddingLeft);
                if (isRelation) {
                    topPos -= parseInt(style.height) + n.entity.el.style.a * 2;
                }
                else {
                    topPos -= parseInt(style.height) + n.entity.radius + 10;
                }
                topPos -= (parseInt(style.paddingBottom)) * zoom + 15;
                break;

            case 'left':
                topPos -= parseInt(style.height) / 2 + parseInt(style.paddingLeft);
                if (isRelation) {
                    leftPos += n.entity.el.style.b * 1.5 * zoom;
                }
                else {
                    leftPos += n.entity.radius * zoom + 10;
                }
                leftPos -= (parseInt(style.paddingLeft) - 15) * zoom;
                break;
        }

        // sidebar展开时左移
        var sideBar = this._kgraph.getComponentByType('SIDEBAR');
        if (!util.hasClass(sideBar.el, 'hidden')) {
            leftPos -= sideBar.el.clientWidth / 2;
        }
        
        this.el.style.left = leftPos + 'px';
        this.el.style.top = topPos + 'px';
    };

    /**
     * 显示
     */
    Tip.prototype.show = function () {
        if (util.hasClass(this.el, 'hidden')) {
            util.removeClass(this.el, 'hidden');

            bkgLog({
                type: 'zhishitupushow',
                target: this._logParam,
                area: 'tip'
            });
        }
    };

    /**
     * 隐藏
     */
    Tip.prototype.hide = function () {
        if (!util.hasClass(this.el, 'hidden') && !this._isMouseenter) {
            util.addClass(this.el, 'hidden');

            bkgLog({
                type: 'zhishitupuhide',
                target: this._logParam,
                area: 'tip'
            });
        }
    };

    /**
     * 切换显示隐藏
     */
    Tip.prototype.toggle = function () {
        if (util.hasClass(this.el, 'hidden')) {
            this.show(this._logParam);
        }
        else {
            this.hide(this._logParam);
        }
    };

    Tip.prototype._dispatchClick = function (e) {
        var target = e.target || e.srcElement;

        var current = target;
        while (current && current.nodeName.toLowerCase() !== 'a') {
            current = current.parentNode;
        }

        if (current) {
            var linkArea = current.getAttribute('data-area');
            bkgLog({
                type: 'zhishitupulink',
                target: [
                            this._logParam,
                            current.getAttribute('title'),
                            current.getAttribute('href')
                        ].join(','),
                area: 'tip-' + linkArea
            });
        }
    };

    zrUtil.inherits(Tip, Component);

    return Tip;
});