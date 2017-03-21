define(function (require) {

    "use strict";

    var $                   = require('jquery'),
        _                   = require('underscore'),
        Backbone            = require('backbone'),
        tether              = require('tether'),
        d3                  = require('d3'),
        d3tip               = require('d3tip'),
        highcharts          = require('highcharts'),
        bootstrap           = require('bootstrap'),
        poeData             = require('json!../../../data/poeData.json'),
        poeDB               = require('json!../../../data/jsonDB.json'),
        // d3line              = require('d3linegraph'),
        d3line = require('js/utilities/d3linegraph'),

        // ProjectItem           = require('../views/projectItem'),
        HTML                = require('text!html/sites/PoeLadder.html'),
        // projectsData        = require('json!data/projects.json'), 
        // svgBike             = require('text!svg/svgBike.svg')
        template = _.template(HTML);

    var searchCharacters = [];

    return Backbone.View.extend({
        el:'#mainContent',

        charTableTemplate: _.template("<% _.each(models, function(item) { %>" + 
                                "<tr class='dead<%= item.isdead %>'>" +
                                "<td><%= item.name %></td> " +
                                // "<td><%= item.isdead %></td>" +
                                "<td><%= item.level %></td>" +
                                "<td><%= item.class %></td>" +
                                "<td><%= item.rank %></td>" +
                                // "<td><div class='legendColor'></div></td>" +
                                // "<td>Remove</td>" +
                                "<tr/> <% }) %>"),

        initialize: function(){
            var self = this;

        },
        convertCSVtoJSON: function(csv){
            //var csv is the CSV file with headers
            var lines=csv.split("\n");

            var result = [];

            var headers=lines[0].split(",");

            for(var i=1;i<lines.length;i++){

              var obj = {};
              var currentline=lines[i].split(",");

              for(var j=0;j<headers.length;j++){
                  obj[headers[j]] = currentline[j];
              }

              result.push(obj);

            }

            //return result; //JavaScript object
            return JSON.stringify(result); //JSON

        },
        render: function () {
            var self = this;
            self.undelegateEvents();
            self.$el.html(template());

            var myEfficientFn = _.debounce(self.onResize, 100);
            $(window).resize(myEfficientFn);

            self.onResize();


            $("#myInput").on("keyup",function(e){

                self.characterSearch(e.target.value);
            });
            // console.log(svgBike);

            if(window.innerWidth <= 600) {
                self.rearrangeForMobile();
            }

            self.drawBarGraph();


            // search stuff
            if(window.location.hash) {
              // Fragment exists

                if(window.location.hash){
                    var hashItems = (window.location.hash).split("#poe/")[1];

                    // hashItems = hashItems.replace('&',' ');

                    if(hashItems){
                        hashItems.toString();
                        hashItems = hashItems.replace(/\+/g, ' ');
                        self.characterSearch(hashItems);
                        $("#myInput").val(hashItems);
                    } 
                }
            }

            self.drawHighchart();

            return this;
        },
        prepHighcharts:function(data,namesArray){
            // console.log("prepHighcharts");
            // console.log("data");
            // console.log(data);
            
            var self = this;

            var lineGraphData = [],
                oneChar = [];


            var mostXP = 0;
            var leastXP = 45000000000;
            var timeEntries = [];

            _.each(data,function(d){
                if(Number(d.exp) > mostXP){ mostXP = Number(d.exp)};

                if(Number(d.exp) < leastXP){ leastXP = Number(d.exp)};

                if(!_.contains(timeEntries,d.date)){
                    timeEntries.push(d.date);
                }
            });


            var lineGraphMetrics = {
                minDate: new Date(_.min(data, function(d){ return Date.parse(d.date); }).date),
                maxDate: new Date(_.max(data, function(d){  return Date.parse(d.date); }).date),
                maxXP: mostXP,
                minXP: leastXP
            };
            
            console.log("maxXP");
            console.log(mostXP);
            console.log("leastXP");
            console.log(leastXP);
            console.log("timeEntries");
            console.log(timeEntries);

            _.each(namesArray,function(val,key){
                var oneChar = {
                    name: val,
                    data: []
                };
                _.map(data,function(v,k){
                    if(v.name.toLowerCase() == val.toLowerCase()){

                        var d = v.date;

                        var year = d.split("-")[0];
                        var month = d.split("-")[1];
                        var day = d.split("-")[2].split(" ")[0];
                        var hour = d.split("-")[2].split(" ")[1].split(":")[0]
                        var minute = d.split("-")[2].split(" ")[1].split(":")[1]


                        v.date = Date.UTC(year, month, day, hour, minute);

                        var n = Number(v.exp);
                        v.exp = n;



                        oneChar.data.push([v.date,v.exp]);
                    }
                })
                lineGraphData.push(oneChar);
            });

            var newLineGraphData = []

            // character
            
            console.log("lineGraphData");
            console.log(lineGraphData);
            console.log("newLineGraphData");
            console.log(newLineGraphData);

            var highchartStart = timeEntries[0];



            // var year = highchartStart.split("-")[0];
            

            self.drawHighchart(lineGraphData,highchartStart);

            // self.drawLineGraph(lineGraphData,lineGraphMetrics);
        },
        drawHighchart: function(lineGraphData,highchartStart){
            var self = this;

            Highcharts.setOptions({
                lang: {
                    thousandsSep: ','
                }
            });

            Highcharts.chart('HCcontainer', {
                chart: {
                    type: 'spline'
                },
                title: {
                    text: ''
                },
                subtitle: {
                    text: ''
                },
                xAxis: {
                    type: 'datetime',
                    dateTimeLabelFormats: { // don't display the dummy year
                        month: '%e. %b',
                        year: '%b'
                    },
                    title: {
                        text: 'Date'
                    }
                },
                yAxis: {
                    title: {
                        text: 'Experience'
                    },
                    min: 0
                },
                tooltip: {
                    headerFormat: '<b>{series.name}</b><br>',
                    pointFormat: '{point.x:%e. %b}: {point.y} experience'
                },

                plotOptions: {
                    spline: {
                        marker: {
                            enabled: true
                        }
                    }
                },

                series: lineGraphData
            });



        },
        prepTableData:function(namesArray,data){

            var self = this;

            var tableData = [],
                lastIndex = 0;

            // console.log(searchCharacters);
            var lowerCaseData = data; 

            lowerCaseData = _.map(lowerCaseData,function(d){ d.name = d.name.toLowerCase(); return d });

            _.each(namesArray,function(val,key){
                lastIndex = _.findLastIndex(lowerCaseData, { name: val.toLowerCase() });

                console.log("lastIndex");
                console.log(lastIndex);
                if(lastIndex == -1){
                    return;
                }
                tableData.push(data[lastIndex]);
            });

            console.log("tableData");
            console.log(tableData);

            self.makeCharacterTable(tableData);
            
        },
        makeCharacterTable:function(data){
            var self = this;

            data = _.sortBy(data, function(d){ 
                    return -d.exp; 
            });

            $("tbody#charTable").html( self.charTableTemplate({ models: data}));

            // var tableRow = $("#charTable > tr > td").filter(function() {
            //     return $(this).text() == data[0].name;
            // }).closest("tr");

            // $(tableRow).find(".legendColor").css("background-color",strokeColor);


        },
        getDavesData: function(namesArray){
            var self = this;


            var namesArrayString = namesArray.join("+");
            window.history.pushState('object or string', 'Rip', "#poe/" + namesArrayString);

            var newURL = "http://poe.davidzeiser.com/?names=" + namesArrayString;

            // "http://poe.davidzeiser.com/?names=energypizza+muslims+nitrodubs+obamathejew+shripper"

            d3.xhr(newURL, function(error, data){

                var data = $.parseJSON(self.convertCSVtoJSON(data.response));

                console.log("Daves data:");
                console.log(data);

                _.each(data,function(v,k){
                    if(v.name == "" || v.name == undefined){
                        data.splice(k,1);
                    }
                })

                // self.drawLineGraph2(data);
                // self.prepLineData(data,namesArray);

                self.prepHighcharts(data,namesArray);


                self.prepTableData(namesArray,data);

                
            });
        },
        drawBarGraph: function(){



            var margin = {top: 20, right: 20, bottom: 30, left: 40},
                width = 1800 - margin.left - margin.right,
                height = 400 - margin.top - margin.bottom;
            
            var formatPercent = d3.format(".2s");
            
            var x = d3.scale.ordinal()
                .rangeRoundBands([0, width], .1, 1);
            
            var y = d3.scale.linear()
                .range([height, 0]);
            
            var xAxis = d3.svg.axis()
                .scale(x)
                .orient("bottom");
            
            var yAxis = d3.svg.axis()
                .scale(y)
                .orient("left")
                .tickFormat(formatPercent);

            var tip = d3.tip()
                .attr('class', 'd3-tip')
                .offset([-10, 0])

                .html(function(d) {

                return "<strong>"+ d.character.name +"</strong>" + "</br>" 
                        + "<strong>Level:</strong> <span style='color:red'>" + d.character.level + "</span>" + "</br>"
                        + "<strong>Class:</strong> <span style='color:red'>" + d.character.class + "</span>" + "</br>"
                        + "<strong>Experience:</strong> <span style='color:red'>" + d.frequency.toLocaleString() + "</span>";
            });


            
            var svg = d3.select("#poeLadder").append("svg")
                .attr('class','simpleBarSVG')
                // .attr("width", width + margin.left + margin.right)
                .attr("width", '100%')
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            svg.call(tip);
            
            // d3.json("data/poeData.json", function(error, data) {
            d3.xhr("http://api.pathofexile.com/ladders/Hardcore%20Legacy?offset=0&limit=80", function(error, data){

                // console.log(JSON.parse(data.response));

                data = d3.shuffle(JSON.parse(data.response).entries);
            
                data.forEach(function(d) {
                    d.frequency = d.character.experience;
                    // d.letter = d.character.name.slice(0,5) + "..";
                    d.letter = d.rank;
                });
            
                x.domain(data.map(function(d) { return d.letter; }));
                y.domain([0, d3.max(data, function(d) { return d.frequency; })]);
            
                svg.append("g")
                    .attr("class", "x axis")
                    .attr("transform", "translate(0," + height + ")")
                    .call(xAxis);
            
                svg.append("g")
                    .attr("class", "y axis")
                    .call(yAxis)
                    .append("text")
                    .attr("transform", "rotate(-90)")
                    .attr("y", 6)
                    .attr("dy", ".71em")
                    .style("text-anchor", "end")
                    .text("Experience");
            
                svg.selectAll(".bar")
                    .data(data)
                    .enter().append("rect")
                    .attr("class", "bar")
                    .attr("x", function(d) { return x(d.letter); })
                    .attr("width", x.rangeBand())
                    .attr("y", function(d) { return y(d.frequency); })
                    .attr("height", function(d) { return height - y(d.frequency); })
                    .attr("fill", function(d){ return classColor(d.character.class); })
                    .on('mouseover', tip.show)
                    .on('mouseout', tip.hide);

                d3.select("input#sortVals").on("change", change);
                d3.select("input#sortClass").on("change", sortClass);

                // have class sort trigger that happens after sort
            
                var sortTimeout = setTimeout(function() {
                    d3.select("input#sortVals").property("checked", true).each(change);
                }, 1500);
            
                function change() {

                    clearTimeout(sortTimeout);
            
                    // Copy-on-write since tweens are evaluated after a delay.
                    var x0 = x.domain(data.sort(this.checked
                        ? function(a, b) { return b.frequency - a.frequency; }
                        : function(a, b) { return d3.ascending(a.letter, b.letter); })
                        .map(function(d) { return d.letter; }))
                        .copy();
                
                    svg.selectAll(".bar")
                        .sort(function(a, b) { return x0(a.letter) - x0(b.letter); });
                
                    var transition = svg.transition().duration(750),
                        delay = function(d, i) { return i * 50; };
                
                    transition.selectAll(".bar")
                        .delay(delay)
                        .attr("x", function(d) { return x0(d.letter); });
                
                    transition.select(".x.axis")
                        .call(xAxis)
                        .selectAll("g")
                        .delay(delay);
                }

                function sortClass(){
                    var x0 = x.domain(data.sort(this.checked
                        ? function(a, b) { 
                            return d3.ascending(a.character.class, b.character.class); }
                        : function(a, b) { 
                            return d3.ascending(a.letter, b.letter);  })
                        .map(function(d) { return d.letter; }))
                        .copy();

                     svg.selectAll(".bar")
                        .sort(function(a, b) { return x0(a.character.class) - x0(b.character.class); });
                
                    var transition = svg.transition().duration(750),
                        delay = function(d, i) { return i * 50; };
                
                    transition.selectAll(".bar")
                        .delay(delay)
                        .attr("x", function(d) { return x0(d.letter); });
                
                    transition.select(".x.axis")
                        .call(xAxis)
                        .selectAll("g")
                        .delay(delay);
                }

                function classColor(x){
                    var color = "steelblue";

                    switch (x){

                        case "Hierophant":
                            color = "Tomato";
                            break;
                        case "Pathfinder":
                            color = "Navy";
                            break;
                        case "Berserker":
                            color = "Yellow";
                            break;
                        case "Champion":
                            color = "LawnGreen";
                            break;
                        case "Chieftain":
                            color = "DarkRed";
                            break;
                        case "Gladiator":
                            color = "DarkSlateGray";
                            break;
                        case "Guardian":
                            color = "Peru";
                            break;
                        case "Inquisitor":
                            color = "CadetBlue";
                            break;
                        case "Elementalist":
                            color = "Goldenrod";
                            break;
                        case "Assassin":
                            color = "Indigo";
                            break;
                        case "Slayer":
                            color = "Thistle";
                            break;
                        case "Necromancer":
                            color = "Pink";
                            break;
                        case "Raider":
                            color = "MediumSeaGreen";
                            break;
                        case "Juggernaut":
                            color = "MediumVioletRed";
                            break;
                        case "Beserker":
                            color = "DarkOliveGreen";
                            break;
                        case "Trickster":
                            color = "Teal";
                            break;
                        case "Occultist":
                            color = "Aquamarine";
                    }

                    return color;
                
                }
            });
        
        },
        characterSearch: _.debounce(function(data){
            var self = this;
            // do something
            var namesArray = [];

            searchCharacters = [];

            _.each(data.split(" "),function(val,key){
                if(val.length > 4 ) {
                    namesArray.push(val);
                }
            });

            console.log(namesArray);

            if(namesArray.length){
                self.getDavesData(namesArray);
            }

        }, 1000),
        prepLineData: function(data,namesArray){

            var self = this;

            var lineGraphData = [],
                oneChar = [];


            var mostXP = 0;
            var leastXP = 45000000000;

            _.each(data,function(d){
                if(Number(d.exp) > mostXP){ mostXP = Number(d.exp)};

                if(Number(d.exp) < leastXP){ leastXP = Number(d.exp)};

            });


            var lineGraphMetrics = {
                minDate: new Date(_.min(data, function(d){ return Date.parse(d.date); }).date),
                maxDate: new Date(_.max(data, function(d){  return Date.parse(d.date); }).date),
                maxXP: mostXP,
                minXP: leastXP
            };
            

            console.log("maxXP");
            console.log(mostXP);
            console.log("leastXP");
            console.log(leastXP);

            _.each(namesArray,function(val,key){
                var oneChar = [];
                _.map(data,function(v,k){
                    if(v.name.toLowerCase() == val.toLowerCase()){
                        var d = new Date(v.date);
                        v.date = d;

                        var n = Number(v.exp);
                        v.exp = n;
                        oneChar.push(v);
                    }
                })
                lineGraphData.push(oneChar);

            });

            console.log("lineGraphMetrics");
            console.log(lineGraphMetrics);

            self.drawLineGraph(lineGraphData,lineGraphMetrics);
        },


        // OLD scan with dynamodb
        getCharacterData:function(charName){
            var url = "https://a1r5av60jd.execute-api.us-east-1.amazonaws.com/latest/scan/" + charName;

            var jqxhr = $.get( url, function() {
                console.log( "jqxhr success" );
            })
            .done(function(data) {
                console.log( "jqxhr success" );
                console.log(data);
            })
            .fail(function() {
                console.log( "jqxhr error" );
            })
            .always(function() {
                console.log( "jqxhr finished" );
            });
        },

        drawLineGraph: function(lineGraphData,lineGraphMetrics){

            $("#poeLine").empty();

            var margin = {top: 80, right: 80, bottom: 80, left: 80},
                width = 960 - margin.left - margin.right,
                height = 500 - margin.top - margin.bottom;

            var parse = d3.time.format("%b %Y").parse;

            // Scales and axes. Note the inverted domain for the y-scale: bigger is up!
            var x = d3.time.scale().range([0, width]),
                y = d3.scale.linear().range([height, 0]),
                xAxis = d3.svg.axis().scale(x).ticks(5).tickSize(-height).tickSubdivide(true),
                yAxis = d3.svg.axis().scale(y).ticks(4).orient("right");

            // An area generator, for the light fill.
            var area = d3.svg.area()
                .interpolate("monotone")
                .x(function(d) { return x(d.date); })
                .y0(height)
                // .y1(function(d) { return y(d.price); });
                .y1(function(d) { return y(d.exp); });

            // A line generator, for the dark stroke.
            var line = d3.svg.line()
                .interpolate("monotone")
                // .x(function(d) { return x(d.date); })
                // .y(function(d) { return y(d.price); });
                .x(function(d) { 
                    // console.log("d.date: " + d.date);
                    return x(d.date); })
                .y(function(d) { 
                    // console.log("d.exp: " + d.exp);
                    return y(d.exp); });

            var tip = d3.tip()
                .attr('class', 'd3-tip2')
                .direction('nw')
                .offset([-10, 0])

                .html(function(d) {
                    // console.log("d");
                    // console.log(d);

                    return "<strong>"+ d[0].name +"</strong>" + "</br>";
                    // + "<strong>Level:</strong> <span style='color:red'>" + d.character.level + "</span>" + "</br>"
                    // + "<strong>Class:</strong> <span style='color:red'>" + d.character.class + "</span>" + "</br>"
                    // + "<strong>Experience:</strong> <span style='col;or:red'>" + d.frequency.toLocaleString() + "</span>";
            });

            d3.csv("readme.csv", type, function(error, data) {



              // Compute the minimum and maximum date, and the maximum price.
              // x.domain([values[0].date, values[values.length - 1].date]);
              // y.domain([0, d3.max(values, function(d) { return d.price; })]).nice();

            x.domain([lineGraphMetrics.minDate, lineGraphMetrics.maxDate]);
            y.domain([Number(lineGraphMetrics.minXP) - 10000000, Number(lineGraphMetrics.maxXP) + 10000000]).nice();

              // Add an SVG element with the desired dimensions and margin.
              var svg = d3.select("#poeLine").append("svg")
                  .attr("width", width + margin.left + margin.right)
                  .attr("height", height + margin.top + margin.bottom)
                .append("g")
                  .attr("transform", "translate(" + margin.left + "," + margin.top + ")")

            svg.call(tip);


              // Add the clip path.
              svg.append("clipPath")
                  .attr("id", "clip")
                .append("rect")
                  .attr("width", width)
                  .attr("height", height);

              // Add the x-axis.
              svg.append("g")
                  .attr("class", "x axis")
                  .attr("transform", "translate(0," + height + ")")
                  .call(xAxis);

              // Add the y-axis.
              svg.append("g")
                  .attr("class", "y axis")
                  .attr("transform", "translate(" + width + ",0)")
                  .call(yAxis);

              var colors = d3.scale.category10();
              svg.selectAll('.line')
                .data(lineGraphData)
                // .data([values, msft, ibm])
                .enter()
                  .append('path')
                    .attr('class', 'line')
                    .style('stroke', function(d) {
                        var strokeColor = colors(Math.random() * 50);

                        var tableRow = $("#charTable > tr > td").filter(function() {
                            if(d[0] == undefined) return;
                            return $(this).text() == d[0].name;
                        }).closest("tr");
                        $(tableRow).find(".legendColor").css("background-color",strokeColor);
                        // console.log(tableRow);
                        // $("#charTable > tr").
                      return strokeColor;
                    })
                    .attr('clip-path', 'url(#clip)')
                    .attr('d', function(d) {
                        // console.log("dddddd");
                        // console.log(d);
                      return line(d);
                    })
                    .on('mouseover', tip.show)
                    .on('mouseout', tip.hide);

              /* Add 'curtain' rectangle to hide entire graph */
              var curtain = svg.append('rect')
                .attr('x', -1 * width)
                .attr('y', -1 * height)
                .attr('height', height)
                .attr('width', width)
                .attr('class', 'curtain')
                .attr('transform', 'rotate(180)')
                .style('fill', '#ffffff')

              /* Optionally add a guideline */
              var guideline = svg.append('line')
                .attr('stroke', '#333')
                .attr('stroke-width', 0)
                .attr('class', 'guide')
                .attr('x1', 1)
                .attr('y1', 1)
                .attr('x2', 1)
                .attr('y2', height)

              /* Create a shared transition for anything we're animating */
              var t = svg.transition()
                .delay(750)
                .duration(6000)
                .ease('linear')
                .each('end', function() {
                  d3.select('line.guide')
                    .transition()
                    .style('opacity', 0)
                    .remove()
                });

              t.select('rect.curtain')
                .attr('width', 0);
              t.select('line.guide')
                .attr('transform', 'translate(' + width + ', 0)')

              d3.select("#show_guideline").on("change", function(e) {
                guideline.attr('stroke-width', this.checked ? 1 : 0);
                curtain.attr("opacity", this.checked ? 0.75 : 1);
              })

            });

            // Parse dates and numbers. We assume values are sorted by date.
            function type(d) {
              d.date = parse(d.date);
              d.price = +d.price;
              return d;
            }   
        },
        rearrangeForMobile: function(){
            var featureDiv = $(".featurette");

            _.each(featureDiv,function(feature){
                var col5 = $(feature).find(".col-md-5");

                $(feature).find(".col-md-5").remove();
                $(feature).prepend(col5);
            });
        },
        onResize: function(){
            if(window.innerHeight <= 600) {
                $("#homeContainer").css("padding","4rem 0");
            }
            else{
                $("#homeContainer").css("padding","12rem 0 2rem");
            }
        },
        doSearch: function(e){

            var myFunction = function() {
              // Declare variables 
              var input, filter, table, tr, td, i;
              input = e.target;
              filter = input.value.toUpperCase();
              table = $("#myTable");
              // tr = table.getElementsByTagName("tr");
              tr = $("#myTable").find("tr");

              // Loop through all table rows, and hide those who don't match the search query
              for (i = 0; i < tr.length; i++) {
                td = tr[i].getElementsByTagName("td")[0];
                if (td) {
                  if (td.innerHTML.toUpperCase().indexOf(filter) > -1) {
                    tr[i].style.display = "";
                  } else {
                    tr[i].style.display = "none";
                  }
                } 
              }
            }
            myFunction();
        },
        drawBetterLineGraph: function(){

            function log(text) {
              if (console && console.log) console.log(text);
              return text;
            }

            (function() {
              var margin = {top: 30, right: 10, bottom: 50, left: 60},
                  chart = d3LineWithLegend()
                            .xAxis.label('Time (ms)')
                            .width(width(margin))
                            .height(height(margin))
                            .yAxis.label('Voltage (v)');


              var svg = d3.select('#test1 svg')
                  .datum(generateData())

              svg.transition().duration(500)
                  .attr('width', width(margin))
                  .attr('height', height(margin))
                  .call(chart);


              chart.dispatch.on('showTooltip', function(e) {
              var offset = $('#test1').offset(), // { left: 0, top: 0 }
                    left = e.pos[0] + offset.left,
                    top = e.pos[1] + offset.top,
                    formatter = d3.format(".04f");

                var content = '<h3>' + e.series.label + '</h3>' +
                              '<p>' +
                              '<span class="value">[' + e.point[0] + ', ' + formatter(e.point[1]) + ']</span>' +
                              '</p>';

                nvtooltip.show([left, top], content);
              });

              chart.dispatch.on('hideTooltip', function(e) {
                nvtooltip.cleanup();
              });




              $(window).resize(function() {
                var margin = chart.margin();

                chart
                  .width(width(margin))
                  .height(height(margin));

                d3.select('#test1 svg')
                  .attr('width', width(margin))
                  .attr('height', height(margin))
                  .call(chart);

                });




              function width(margin) {
                var w = $(window).width() - 20;

                return ( (w - margin.left - margin.right - 20) < 0 ) ? margin.left + margin.right + 2 : w;
              }

              function height(margin) {
                var h = $(window).height() - 20;

                return ( h - margin.top - margin.bottom - 20 < 0 ) ? 
                          margin.top + margin.bottom + 2 : h;
              }


              //data
              function generateData() {
                var sin = [],
                    sin2 = [],
                    cos = [],
                    cos2 = [],
                    r1 = Math.random(),
                    r2 = Math.random(),
                    r3 = Math.random(),
                    r4 = Math.random();

                for (var i = 0; i < 100; i++) {
                  sin.push([ i, r1 * Math.sin( r2 +  i / (10 * (r4 + .5) ))]);
                  cos.push([ i, r2 * Math.cos( r3 + i / (10 * (r3 + .5) ))]);
                  sin2.push([ i, r3 * Math.sin( r1 + i / (10 * (r2 + .5) ))]);
                  cos2.push([ i, r4 * Math.cos( r4 + i / (10 * (r1 + .5) ))]);
                }

                return [
                  {
                    data: sin,
                    label: "Sine Wave"
                  },
                  {
                    data: cos,
                    label: "Cosine Wave"
                  },
                  {
                    data: sin2,
                    label: "Sine2 Wave"
                  },
                  {
                    data: cos2,
                    label: "Cosine2 Wave"
                  }
                ];
              }

            });

        },


    });
});
