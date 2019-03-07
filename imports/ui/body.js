import { Template } from 'meteor/templating';
 
import { Githubitems } from '../api/repo.js';
import { Githubcount } from '../api/repo.js';
 
import '../api/repo.js';
import './body.html';


Template.body.onCreated(function bodyOnCreated() {
  //this.state = new ReactiveDict();
  Meteor.subscribe('githubitems');
  Meteor.subscribe('githubcount');
});


Template.body.helpers({
  repos() {
  	return Githubitems.find().fetch();
  }
});

Template.gitcount.helpers({
	repocount(){
	 	var allcount = Githubcount.find().fetch();
	 	return allcount[allcount.length -1].repocount;
	 }
	//repocount : '10'
});

Template.gitcountchart.rendered = function() {
    //var chart = nv.models.lineChart()
    var chart = nv.models.lineWithFocusChart();
    //   .margin({left: 100})  //Adjust chart margins to give the x-axis some breathing room.
    //   .useInteractiveGuideline(true)  //We want nice looking tooltips and a guideline!
    //   .transitionDuration(350)  //how fast do you want the lines to transition?
    //   .showLegend(true)       //Show the legend, allowing users to turn on/off line series.
    //   .showYAxis(true)        //Show the y-axis
    //   .showXAxis(true)        //Show the x-axis
    // ;

    nv.addGraph(function() {
      	chart.xAxis.axisLabel('Date').tickFormat(
      	function(d) { 
          return d3.time.format('%x')(new Date(d)) 
    	});
      	chart.x2Axis.axisLabel('Date').tickFormat(
      	function(d) { 
          return d3.time.format('%x')(new Date(d)) 
    	});
	    chart.yAxis.axisLabel('Repos').tickFormat(d3.format('d'));
	    chart.y2Axis.axisLabel('Repos').tickFormat(d3.format('d'));
	    var repoData = construcdata();
	    d3.select('#chart svg').datum(
	      repoData
	    ).call(chart);
	    nv.utils.windowResize(function() { chart.update(); });
	    return chart;
	    });

	    this.autorun(function () {
	    	var repoData = construcdata();
	      	d3.select('#chart svg').datum(
	        	repoData
	      ).call(chart);
	      chart.update();
	    });
	};

function construcdata(){
	var data = [];
	for (const gitcountdata of Githubcount.find().fetch()){
		data.push(
		{
			x: gitcountdata.time,
			y: gitcountdata.repocount
		});
	}
	return[
    {
      values: data,
      key: 'Total repo',
      color: '#7770ff',
      area: true      //area - set to true if you want this line to turn into a filled area chart.
    },
    ];
}
