/*jslint browser: true*/
/*global Tangram, gui */
console.log('mapillary');
var picking = false;
var clicking = false;
map = (function () {
// (function () {
    // 'use strict';

    var locations = {
        'Oakland': [37.8044, -122.2708, 15],
        'New York': [40.70531887544228, -74.00976419448853, 15],
        'Seattle': [47.5937, -122.3215, 15],
        'Malmö': [55.6060, 13.0010, 15]
    };

    var map_start_location = locations['Malmö'];

    /*** URL parsing ***/

    // leaflet-style URL hash pattern:
    // #[zoom],[lat],[lng]
    var url_hash = window.location.hash.slice(1, window.location.hash.length).split('/');
    keytext = "";
    window.keytext = keytext;
    valuetext = "";
    window.valuetext = valuetext;

    if (url_hash.length >= 3) {
        map_start_location = [url_hash[1],url_hash[2], url_hash[0]];
        // convert from strings
        map_start_location = map_start_location.map(Number);
    }

    if (url_hash.length == 5) {
        keytext = unescape(url_hash[3]);
        valuetext = unescape(url_hash[4]);
    }

    // Put current state on URL
    window.updateURL = function() {
        // if (picking) return;
        // console.log(window.location.hash);
        var map_latlng = map.getCenter();
        var url_options = [map.getZoom().toFixed(1), map_latlng.lat.toFixed(4), map_latlng.lng.toFixed(4), escape(keytext), escape(valuetext)];
        window.location.hash = url_options.join('/');
    }

    /*** Map ***/

    var map = L.map('map',
        {"keyboardZoomOffset" : .05}
    );

    var layer = Tangram.leafletLayer({
        scene: 'scene.yaml',
        numWorkers: 2,
        attribution: '<a href="https://mapzen.com/tangram" target="_blank">Tangram</a> | &copy; OSM contributors | <a href="https://mapzen.com/" target="_blank">Mapzen</a>',
        unloadInvisibleTiles: false,
        updateWhenIdle: false
    });

    window.layer = layer;
    var scene = layer.scene;
    window.scene = scene;

    // setView expects format ([lat, long], zoom)
    map.setView(map_start_location.slice(0, 3), map_start_location[2]);
    map.on('moveend', updateURL);

    function updateKey(value) {
        keytext = value;

        for (layer in scene.config.layers) {
            if (layer == "earth") continue;
            scene.config.layers[layer].properties.key_text = value;
        }
        // not sure why but this seems to prevent an intermediate step of all-red roads
        // setTimeout(function(){scene.rebuildGeometry();}, 5);
        scene.rebuildGeometry();
        // scene.requestRedraw();
        updateURL(); 
    }

    function updateValue(value) {
        valuetext = value;

        for (layer in scene.config.layers) {
            if (layer == "earth") continue;
            scene.config.layers[layer].properties.value_text = value;
        }
        // not sure why but this seems to prevent an intermediate step of all-red roads
        // setTimeout(function(){scene.rebuildGeometry();}, 5);
        scene.rebuildGeometry();
        // scene.requestRedraw();
        updateURL();            
    }

    // Create dat GUI
    var gui = new dat.GUI({ autoPlace: true, hideable: false, width: 300 });
    function addGUI () {
        gui.domElement.parentNode.style.zIndex = 5; // make sure GUI is on top of map
        window.gui = gui;

        gui.keyinput = keytext;
        var keyinput = gui.add(gui, 'keyinput').name("key").listen();

        gui.valueinput = valuetext;
        var valueinput = gui.add(gui, 'valueinput').name("value").listen();
        
        updateKey(keytext);
        updateValue(valuetext);
        keyinput.onChange(function(value) {
            updateKey(value);
        });
        valueinput.onChange(function(value) {
            updateValue(value);
        });

        //select input text when you click on it
        keyinput.domElement.id = "keyfilter";
        keyinput.domElement.onclick = function() { this.getElementsByTagName('input')[0].select(); };
        valueinput.domElement.id = "valuefilter";
        valueinput.domElement.onclick = function() { this.getElementsByTagName('input')[0].select(); };

        gui.clear = function() {
            clearValues();
        };
        var clear = gui.add(gui, 'clear')
        
        var now = new Date().getTime();
        gui.min = 1370000000000;
        var min = gui.add(gui, 'min', 1370000000000, now).name("min date");
        min.onChange(function(value) {
            scene.config.layers["mapillary-sequences"].properties.min = value;
            scene.rebuildGeometry();
        });

        gui.max = now;
        var max = gui.add(gui, 'max', 1370000000000, now).name("max date");
        max.onChange(function(value) {
            scene.config.layers["mapillary-sequences"].properties.max = value;
            scene.rebuildGeometry();
        });

        gui.newest = '#00ff00';
        var newest = gui.addColor(gui, 'newest');
        newest.onChange(function(value) {
            scene.config.layers["mapillary-sequences"].properties.newest = value;
            scene.rebuildGeometry();
        });

        gui.oldest = '#0000ff';
        var oldest = gui.addColor(gui, 'oldest');
        oldest.onChange(function(value) {
            scene.config.layers["mapillary-sequences"].properties.oldest = value;
            scene.rebuildGeometry();
            // scene.requestRedraw();
        });
        
    }

    var selectionImage = {};
    var spinner = "";
    var trying = [];

    function getJSON(url, callback) {
        var xmlhttp = new XMLHttpRequest();
        xmlhttp.onreadystatechange = function() {
            if (xmlhttp.readyState == 4) {
                // console.log(xmlhttp.status, trying);
                if (xmlhttp.status == 200) {
                    var response = JSON.parse(xmlhttp.responseText);
                    console.log("response:", typeof(response), response.length, response)
                    if (typeof(response) == "object" && response.length > 0) {
                        // console.log("response:", response, response.length)
                        callback(response);
                    }
                    return;
                }
            }
            if (selectionImage.src == spinner) {
                selectionImage.src = "";
            }
        }
        xmlhttp.open("GET", url, true);
        xmlhttp.send();
        return xmlhttp;
    }

    function fetchMapillaryImage(location) {

        var dist = 100000 / Math.pow(map.getZoom().toFixed(1), 2); 
        // console.log(dist);
        var url = "http://api.mapillary.com/v1/im/close?lat=" + location.lat + "&lon=" + location.lng + "&distance=" + dist + "&limit=1"

        // if (trying.length > 0) {
        //     trying.pop().abort();
        // }
        // trying.push(getJSON(url, handle));
        getJSON(url, handle);

        function handle(data) {
            // trying.pop();
            key = data[0].key
            var imageurl = "http://images.mapillary.com/" + key + "/thumb-320.jpg";
            selectionImage.src = imageurl;
        }
    }

    // Feature selection
    function initFeatureSelection () {
        // Selection info shown on hover
        window.selection_info = document.createElement('div');
        selection_info.setAttribute('class', 'label');
        selection_info.style.display = 'block';
        selection_info.style.zindex = 1000;

        
        // Show selected feature on hover
        scene.container.addEventListener('mousemove', function (event) {
            if (picking && !clicking) return;
            var pixel = { x: event.clientX, y: event.clientY };

            var latlng = map.layerPointToLatLng(new L.Point(pixel.x, pixel.y));

            scene.getFeatureAt(pixel).then(function(selection) {    
                if (!selection) {
                    return;
                }
                var feature = selection.feature;
                if (feature != null) {
                    if (feature.properties != null) {
                        selection_info.style.left = (pixel.x + 5) + 'px';
                        selection_info.style.top = (pixel.y + 15) + 'px';
                        var obj = JSON.parse(JSON.stringify(feature.properties));
                        clearLabel();
                        for (x in feature.properties) {
                            if (x == "keys" || x == "cas" ) continue;
                            val = feature.properties[x]
                            var line = document.createElement('span');
                            line.setAttribute("class", "labelLine");
                            line.setAttribute("key", x);
                            line.setAttribute("value", val);
                            line.innerHTML = x + " : " + val;
                            line.onmousedown = function(e){e.stopPropagation()};
                            line.onmouseup = function(e){setValuesFromSpan(e)};
                            selection_info.appendChild(line);
                        }
                    scene.container.appendChild(selection_info);
                    selectionImage = document.createElement("img");
                    selectionImage.src = "spinner.gif";
                    spinner = toString(selectionImage.src);
                    selection_info.appendChild(selectionImage);

                    fetchMapillaryImage(latlng);

                    } else clearLabel();
                }
                else clearLabel();
            });

            // Don't show labels while panning
            if (scene.panning == true) clearLabel();

        });

        // empty label
        function clearLabel() {
            if (selection_info.parentNode == null) return;
            while (selection_info.firstChild) {
                selection_info.removeChild(selection_info.firstChild);
            }
            selection_info.parentNode.removeChild(selection_info);
        }

        var clickhash = map.getCenter();

        // catch mousedown
        scene.container.onmousedown = function (event) {
            clicking = true;
            clickhash = map.getCenter().lat + map.getCenter().lng;
        };

        // catch mouseup
        scene.container.onmouseup = function (event) {
            clicking = false;
            // check to see if the mouse moved since the mousedown
            hashcheck = map.getCenter().lat + map.getCenter().lng;
            if ( clickhash == hashcheck ) {
                // no mousemove, it was a click
                picking = !picking;
                var menuVisible = (selection_info.parentNode != null);
                if (!menuVisible && picking || !picking) {
                    // clicked on empty space, clear filter
                    clearValues();
                }
            } else {
                // mousemove, it was a drag
                picking = false;
            }
        };
    }

    window.clearValues = function() {
        if (selection_info.parentNode != null) selection_info.parentNode.removeChild(selection_info);
        picking = false;
        keytext = "";
        valuetext = "";
        gui.keytext= "";
        gui.keyinput= "";
        gui.valuetext= "";
        gui.valueinput= "";
        updateKey(keytext);
        updateValue(valuetext);
        updateURL();
    }
    window.setValuesFromSpan = function(e) {
        span = e.target;
        keytext = span.getAttribute("key");
        valuetext = span.getAttribute("value");
        gui.keytext=span.getAttribute("key");
        gui.keyinput=span.getAttribute("key");
        gui.valuetext=span.getAttribute("value");
        gui.valueinput=span.getAttribute("value");
        updateKey(keytext);
        updateValue(valuetext);
        updateURL();
        e.stopPropagation();
        return false;
    }

    // Add map
    window.addEventListener('load', function () {
        // Scene initialized
        layer.on('init', function() {
            addGUI();
            var keyfilter = document.getElementById('keyfilter').getElementsByTagName('input')[0];
            if (keyfilter.value.length == 0) keyfilter.focus();
            else keyfilter.select();

            initFeatureSelection();
        });
        layer.addTo(map);
    });

    return map;

}());

