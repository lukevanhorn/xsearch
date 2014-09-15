'use strict'
/* MIT Parser
    Author: Luke Van Horn
    License: MIT
    Description: Parses MIT Course Catelog for the X-Search Tool
*/
var http = require('http');
var fs = require('graceful-fs');
var util = require('util');
var async = require('async');
var moment = require('moment');
var es = require('event-stream');
var readline = require('readline');
var fulltext = require('./fulltext.js');
var search = fulltext.load('classes', 'search');
var browse = fulltext.load('classes', 'browse');

var pages = ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','x','y','z'];
var subjects = [];
var subject = null;
var page = 0;
var pos = process.argv[2] || 0;

var address = "http://student.mit.edu/catalog/mPOS.html";

var data = {};
var schools = [];

var hFile = fs.createWriteStream('data/mit.json');
hFile.setMaxListeners(0);


function getNextPage() {

	if(pos == subjects.length) {
		complete();
		return;
	}
	subject = subjects[pos];

	console.log(subjects[pos].category + pages[page]);
		
	http.get(address.replace('POS',subjects[pos].category + pages[page]), function (res) {
		var body = '';
		res.setEncoding('utf8');
		
		if(res.statusCode != 200) {
			//next subject
			pos++;
			page = 0;
			
			return process.nextTick(function() { getNextPage(); } );
		}
		
		res.on('data', function (chunk) {
			body += chunk;
		});
		
	    res.on('end', function() {
			extract(body, function() {					
				page++;

				process.nextTick(function() { getNextPage(); } );
			});
		});
		
		res.on('error', function(e) {
			pos++;
			page = 0;
			return process.nextTick(function() { getNextPage(); } );
		});

	}).on('error', function(e) {
		if(res.statusCode != 200) {
			console.log(e);
			//next subject
			pos++;
			subject = subjects[pos];
			page = 0;
			
			return process.nextTick(function() { getNextPage(); } );
		}
	});
}

function readCategories(callback) {

	var rs = fs.createReadStream('data/mitcat.json');
		 

	rs.pipe(es.wait())
		.pipe(es.split())
		.pipe(es.parse())
		.pipe(es.map(function(data, cb) {
			subjects.push(data);		
			console.log(data);
			cb(null,data);                        
		}))
		.pipe(es.wait(function(e,text){
			callback();
		}));
}

function extract(html, next) {
	
	var result;
	var pattern = /<a name="[\d\w]{1,2}\.[\d\w]{1,5}"><\/a>|<\/tbody>/g;
	var first = 0;
	var records = [];
	
	while((result = pattern.exec(html)) != null) {
		if(first > 0) {				
			var course = parse(html.substring(first,result.index));
			if(course) {
				records.push(course);
			}			
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
				var key = (course.title.indexOf(" ") > -1 ? (course.title.substr(course.title.indexOf(" ") + 1, 1) + "00") : (course.title.substr(0, 1) + "00"));
				browse.add(key, course, course.id, function() {
					step();
				});			
			},				
			function(step) {
				//write to main db
				hFile.write(rec + '\n', function(e) {
					step();
				})
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
	var fields = [ 'time', 'location'];

	if(html.match(/Not offered academic year 2014-2015/) || !html.match(/fall.gif/)) {
		return null;
	}
	
	//remove line breaks
	html = html.replace(/[\r\n\t]*/g,'');  //replace newline, carraige returns and tabs

	var result = html.match(/<img alt="______" src="\/icns\/hr.gif"><br>(.*)(?=<\/p>)/);
	var description = result ? result[1] : '';
	
	html = html.replace(/<br>/g,'') //normalize any <br> tags to </br>	
			.replace(/<img[^>]*>/g,''); //image tags
			
	//parse id
	var result = html.match(/<a name="([\d\w]{1,2}\.[^"]*)"><\/a>/);
	var course = { 
					id: (result ? result[1] : ''),
					school: 'MIT', 
					subject: subject.name, 
					semester: 'Fall',
					description: description.replace(/^<br><br>/g, '')
				};
	
	result = html.match(/<h3>(.*)(?=<\/h3>)/);
	course.title = result ? result[1] : '';

	result = html.match(/<b>Lecture:<\/b> <i>([^<]*)<\/i> \(<a href="http:\/\/whereis.mit.edu\/map-jpg\?mapterms=\d*">(\d*-\d*)[^<]<\/a>\)/);

	var i = 0;
	if(result) {
		while(i < fields.length) {
			course[fields[i]] = (result[i+1] ? result[i+1].trim() : null);
			i++;
		}
	}
	
	if(course.time && course.time.match(/,/)) {
		var meetings = course.time.split(',');
		course.time = '';
		course.meets = '';
		for(i= 0; i < meetings.length; i++) {
			result = meetings[i].match(/([A-Z]*)(\d*)/);
			var daypart = result ? result[1] : '';
			var timepart = result ? result[2] : '';
			var days = parseMITDays(daypart.trim());
			course.meets += (course.meets.length > 0 ? ',' + days : days);			
			var time = parseMITTime(timepart.trim());
			if(course.time.length > 0) {
				course.time += '; ';
			} 
			course.time += days.replace(/,/g, ' ' + time + '; ') + ' ' + time;
		}
		course.time.trim();		
	} else if(course.time) {
		result = course.time.match(/([A-Z]*)(\d*)/);
		course.meets = result ? result[1] : '';
		course.time = result ? result[2] : '';		
		
		if(course.meets) {
			course.meets = parseMITDays(course.meets.trim());
		}
		if(course.time) {
			course.time = parseMITTime(course.time.trim());
		}		
	}

	return course;
}
function parseMITDays(str) {
	var val = '';
	var i = 0;
	
	while(i < str.length) {
		if(isNumeric(str[i])) {
			val += ((val.length > 0 ? ', ' : '') + str.substr(i));
			i = str.length;
		} else {	
			switch(str[i]) {
				case 'M': 
					val += ((val.length > 0 ? ',' : '') + 'Monday');
					break;
				case 'T': 
					val += ((val.length > 0 ? ',' : '') + 'Tuesday');
					break;
				case 'W': 
					val += ((val.length > 0 ? ',' : '') + 'Wednesday');
					break;
				case 'R': 
					val += ((val.length > 0 ? ',' : '') + 'Thursday');
					break;
				case 'F': 
					val += ((val.length > 0 ? ',' : '') + 'Friday');
					break;
				case 'S': 
					val += ((val.length > 0 ? ',' : '') + 'Saturday');
					break;
				case 'U': 
					val += ((val.length > 0 ? ',' : '') + 'Sunday');
					break;					
									
			}
		}
		
		i++;
	}
	
	return val;
}

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function parseMITTime(str) {
	str = str.replace(/EVE \(/, '').replace(/ PM\)/,'');
	var start = str;
	var end;
	if(str.match(/-/)) {
		start = expandTime(str.split('-')[0]);
		end = expandTime(str.split('-')[1]);
	} else {
		end = expandTime(start,1);		
		start = expandTime(start);
	}
	
	return start + ' - ' + end;

}

function expandTime(str, add) {
	add = add || 0;
	
	var hour = str;
	var min = '00';
	if(str.match(/\./)) {
		hour = str.split('.')[0];
		min = str.split('.')[1];
	}
	if(add) {
		hour = +hour + add;
		if(+hour > 12) {
			hour = +hour - 12;
		}
	}	
	
	if(+hour < 12 && +hour > 7) {
		return hour + ':' + min + ' a.m.';
	} else {
		return hour + ':' + min + ' p.m.';
	}
}

function complete() {
	hFile.end();
}

readCategories(function(){
	getNextPage();
});