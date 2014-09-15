'use strict'
/* Harvard Parser
    Author: Luke Van Horn
    License: MIT
    Description: Parses Harvard Course Catelog for the X-Search Tool
*/
var fs = require('graceful-fs');
var util = require('util');
var async = require('async');
var moment = require('moment');
var es = require('event-stream');
var readline = require('readline');
var fulltext = require('./fulltext.js');
var edge = require('edge');
var search = fulltext.load('classes', 'search');
var browse = fulltext.load('classes', 'browse');

/* this uses edge.js to run c# console program.  node.js has issue loading secure site */
var loadHtml = edge.func(function () {/*
    #r "System.Net.dll"

    using System.Net;
	using System.Threading.Tasks;

    public class Startup
    {
        public async Task<object> Invoke(object input)
        {
			WebClient client = new WebClient();

			return client.DownloadString((string)input);
        }
    }
*/});



var pos = process.argv[2] || 0;
var page = 25;
var address = "https://coursecatalog.harvard.edu/icb/icb.do?keyword=CourseCatalog&panel=icb.pagecontent695860%3Arsearch%3Ffq_coordinated_semester_yr%3D%26fq_school_nm%3D%26q%3D%26sort%3Dcourse_title%2Basc%26start%3D0%26submit%3DSearch&pageid=icb.page335057&pageContentId=icb.pagecontent695860&view=search&viewParam_fq_coordinated_semester_yr=&viewParam_fq_school_nm=&viewParam_q=&viewParam_sort=course_title+asc&viewParam_start=POS&viewParam_submit=Search&viewParam_context=catalog";
var max = 0;
var data = {};
var schools = [];
var hFile = fs.createWriteStream('data/harvard.json');
hFile.setMaxListeners(0);

function getNextPage() {
	if(pos > max) {
		complete();
		return;
	}
	
	console.log(pos + ' of ' + max);
	
	loadHtml(address.replace('POS',pos), function (error, html) {
		if (error) { 
			console.log(error);
			throw error;
		}
		
		if(max == 0) {
			var result = html.match(/<span style="font-size: 80%; color: #666;">  \(of (.*)\)<\/span>/);
			max = result ? +(result[1].replace(',','')) : 0;
		}
				
		extract(html, function() {					
			pos += page;

			process.nextTick(function() { getNextPage(); } );
		});
		
	});
}

function readFromFile() {

	var rd = readline.createInterface({
		input: fs.createReadStream('data/harvard.html'),
		output: process.stdout,
		terminal: false
	});

	var html = '';
	
	rd.on('line', function(line) {
	
		rd.pause();
		html += line;
		
		pos++;
	
		if(pos % 25 == 0 || pos == max) {
			console.log(pos);		
			extract(html, function() {
				html = '';
				rd.resume();
			});			
		} else {
			rd.resume();
		}	
	});
	
	rd.on('end', function(){
		complete();
		return;	
	});
	
}

function extract(html, next) {
	
	var result;
	var pattern = /<tr class="course"|<\/tbody>/g;
	var first = 0;
	var records = [];
	
	while((result = pattern.exec(html)) != null) {
		if(first > 0) {				
			var course = parse(html.substring(first,result.index));

			records.push(course);			
		}

		first = result.index;
	}
	

	async.each(records, function(course, callback) {
		var rec = JSON.stringify(course);
		
		async.waterfall([
			function(step) {
				//update the fulltext search index
				search.add(rec, course, course.id, function() {
					step();
				});			
			},
			function(step) {
				if(!course.title) {
					return step();
				}
				//update the fulltext browse index
				var key = (course.title.lastIndexOf(" - ") > -1 ? (course.title.substr(course.title.lastIndexOf(" - ") + 3, 1) + "00") : (course.title.substr(0, 1) + "00"));
				browse.add(key, course, course.id, function() {
					step();
				});			
			},			
			function(step) {
				//write to main db
				hFile.write(rec + '\n', function(e) {
					step();
				})
			},
			function(step) {
				//write school db
				if(course.school) {
					var sname = course.school.replace(/\s/g,'');
					if(schools.indexOf(course.school) === -1) {
						schools.push(course.school);

						data[sname] = fs.createWriteStream('data/' + sname + '.json');	
						data[sname].write('[' + rec, function(e){
							step();
						})						
					} else {
						data[sname].write(',\n' + rec, function(e){
							step();
						});					
					} 
				}					
			}
		],function(e){ callback(); });
	},
	function(e) {
		if(e) {
			console.log(e);
		}
		
		next();	
	});
};

function parse(html) {
	var fields = [ 'link', 'title', 'name', 'school', 'semester', 'faculty'];

	//remove line breaks
	html = html.replace(/[\r\n\t]*/g,'')  //replace newline, carraige returns and tabs
		.replace(/<tr class="moredetailcontent[^>]*>/g,'\n') //split into 2 parts with newline
		.replace(/<\/?t(r|d)[^>]*>/g,'') //remove open/close table tags 
		.replace(/<br>/g,'<br/>'); //normalize any <br> tags to </br>	
		
	//remove span from course id sub section id exists
	html = html.replace(/<span class="section">(.*)<\/span>\)/g,'$1)');

	//parse title, id, school, semester and link
	var course = {};
		
	var result = html.match(/viewParam_q=id:(\w_\w+_\d+_\d+_.*)&amp;.*shape="rect">(.*)<\/a>\s+\((.*)\)<\/span><br\/>(.*)(?=&nbsp;)\s?&nbsp;&nbsp;\s?(.*)(?=&nbsp;)\s?&nbsp;&nbsp;\s?(?=<br\/>)?\s?(?:<br\/>)?\s?([^<]*)/);	
		
	var i = 0;
	if(result) {
		while(i < fields.length) {
			course[fields[i]] = (result[i+1] ? result[i+1].trim() : null);
			i++;
		}
		
		course.id = course.link;
	}
	
	//if(course.semester && html.match(/<a class\="moredetails"/)) {
	//	course.faculty = html.substring(html.indexOf(course.semester + course.semester.length), html.indexOf('<a class\="moredetails"'));
	//	course.faculty = course.faculty.replace(/&nbsp;/,'').replace(/<br\/>/,'').trim();
	//}
	
	//if(course.faculty) {
	//	result = course.faculty.match(/\s?&nbsp;&nbsp;\s?<br\/>(.*)<br\/>/);
	//	course.faculty = result ? result[1] : '';
	//}
	
	course.description = html.substr(html.search(/\n/) + 1);	
	
	result = course.description.match(/<strong>Location:  <\/strong>(.*)<\/p>/);
	course.location = result ? result[1] : '';
	
	course.meets = '';
	var meets = (/<li class="meet"><abbr style="text-decoration: none; border: none;" title="(\w+)">/g);
	while((result = meets.exec(html)) != null) {
		course.meets += (course.meets.length > 0 ? ',' : '') + result[1];
	}
	
	result = (/<span class="time">(.*)<\/span>/g).exec(html);
	course.time = result ? result[1] : '';
	
	return course;
}

function complete() {
	fs.writeFileSync('data/harvardschools.json', '[' + schools.join(',') + ']');
	schools.forEach(function(school) {
		var sname = school.replace(/\s/g,'');
		data[sname].end(']');
	});
	hFile.end();
}

if(pos == 0) {
	search.drop(function(){
		//start it off
		getNextPage();
		//readFromFile();
	});
} else {
	getNextPage();
}