/* MIT Calendar Generator
    Author: Luke Van Horn
    License: MIT
    Description: Generates .ics files for import into google calendar
*/

var fs = require('graceful-fs');
var util = require('util');
var async = require('async');
var moment = require('moment');
var es = require('event-stream');
var readline = require('readline');


/* change these based on the semester */

/* fall 2014 */

var semester = 'fall';
var lastDay = '20141211T000000Z';

var weekdays = {
	'Monday':'20140908',
	'Tuesday':'20140902',
	'Wednesday':'20140903',
	'Thursday':'20140904',
	'Friday':'20140905',
	'Saturday':'20140906',
	'Sunday':'20140907'	
};


/* spring 2015 */
/*
var semester = 'spring';
var lastDay = '20150515T000000Z';
var weekdays = {
	'Monday':'20150209',
	'Tuesday':'20150203',
	'Wednesday':'20150204',
	'Thursday':'20150205',
	'Friday':'20150206',
	'Saturday':'20150207',
	'Sunday':'20150208'	
};
*/

/* end of custom settings */


var dayAbv = {
	'Monday':'MO',
	'Tuesday':'TU',
	'Wednesday':'WE',
	'Thursday':'TH',
	'Friday':'FR',
	'Saturday':'SA',
	'Sunday':'SU'	
}


var cFile = fs.createWriteStream('data/mit.ics');


cFile.write('BEGIN:VCALENDAR' + '\n'
	+'PRODID:-//Google Inc//Google Calendar 70.9054//EN' + '\n'
	+'VERSION:2.0' + '\n'
	+'CALSCALE:GREGORIAN' + '\n'
	+'METHOD:PUBLISH' + '\n'
	+'X-WR-CALNAME:Mit' + '\n'
	+'X-WR-TIMEZONE:America/New_York' + '\n'
	+'X-WR-CALDESC:' + '\n'
	+'BEGIN:VTIMEZONE' + '\n'
	+'TZID:America/New_York' + '\n'
	+'X-LIC-LOCATION:America/New_York' + '\n'
	+'BEGIN:DAYLIGHT' + '\n'
	+'TZOFFSETFROM:-0500' + '\n'
	+'TZOFFSETTO:-0400' + '\n'
	+'TZNAME:EDT' + '\n'
	+'DTSTART:19700308T020000' + '\n'
	+'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU' + '\n'
	+'END:DAYLIGHT' + '\n'
	+'BEGIN:STANDARD' + '\n'
	+'TZOFFSETFROM:-0400' + '\n'
	+'TZOFFSETTO:-0500' + '\n'
	+'TZNAME:EST' + '\n'
	+'DTSTART:19701101T020000' + '\n'
	+'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU' + '\n'
	+'END:STANDARD' + '\n'
	+'END:VTIMEZONE' + '\n', 
	function(e){
		
		var rd = readline.createInterface({
			input: fs.createReadStream('data/mit.json'),
			output: process.stdout,
			terminal: false
		});

		rd.on('line', function(line) {
			rd.pause();
			line = line.replace('[{','{').replace('}]','}').replace('},','}');
			var course = JSON.parse(line);
			if(!course.meets || !course.time || !course.semester.toLowerCase().match(semester)) {
				return rd.resume();
			}
			
			if(course.time.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/)) {
				async.eachSeries(course.time.split(';'), function(time,callback){
					console.log('time: ' + time);
					course.meets = time.replace(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(.*)/,'$1').trim();
					course.time = time.replace(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(.*)/,'$2').trim();
					createEvent(course, function(event) {
						if(!event) {
							callback();							
						} else  {
							cFile.write(event, function() {
								callback();
							});	
						}
					});						
				},function() {
					return rd.resume();
				});
			} else {
				createEvent(course, function(event) {
					if(!event) {
						rd.resume()						
					} else  {
						cFile.write(event, function() {
							rd.resume()	
						});	
					}
				});	
			}
		});

		rd.on('close', function(){
			cFile.write('END:VCALENDAR' + '\n');
		});
	});


function createEvent(course,callback) {
	
	var start = getStartTime(course.time);
	var end = getEndTime(course.time);
		
	var meets = course.meets.split(',');
	var byday = '';	
	for(var i = 0; i < meets.length; i++) {
		byday += ((i > 0 ? ',' : '') + dayAbv[meets[i]]);
	}	
	
	var day = weekdays[meets[0]];

	callback('BEGIN:VEVENT' 
			+ '\n' + 'DTSTART;TZID=America/New_York:' + day + 'T' + start
			+ '\n' + 'DTEND;TZID=America/New_York:' + day + 'T' + end
			+ '\n' + 'RRULE:FREQ=WEEKLY;UNTIL=' + lastDay + ';BYDAY=' + byday
			+ '\n' + 'DESCRIPTION:' + course.description 
			+ '\n' + 'LOCATION:' + course.location
			+ '\n' + 'STATUS:CONFIRMED'
			+ '\n' + 'SUMMARY:' + course.title
			+ '\n' + 'END:VEVENT' + '\n');
}

function getStartTime(time) {

	var start = (time.indexOf('-') > 0) ? time.substr(0,time.indexOf('-')) : time;
	if(start.match(/p\.?m\.?/)){
		start = start.replace('p.m.','').trim().replace(/(\d{1,2}):(\d{2}?)/, function(s,m1,m2){ return (((Number(m1) + (Number(m1) < 12 ? 12 : 0) + '').lpad('0',2) + (m2).lpad('0',2) + '00'));});
	}
	else {
		start = start.replace('a.m.','').trim().replace(/(\d{1,2}):(\d{2}?)/,function(s,m1,m2){ return ((m1).lpad('0',2) + (m2).lpad('0',2) + '00');});
	}
	
	return start;
}

function getEndTime(time) {
	if(time.indexOf('-') < 0) {
		return (+(getStartTime(time)) + 100000) + '';
	}
	
	var end = time.substr(time.indexOf('-') + 1).trim();
	if(end.match(/<\/span>/)) {
		end = end.substr(0,end.indexOf('<'));
	}

	if(end.match(/p\.?m\.?/)){
		end = end.replace('p.m.','').trim().replace(/(\d{1,2}):(\d{2}?)/, function(s,m1,m2){ return (((Number(m1) + (Number(m1) < 12 ? 12 : 0) + '').lpad('0',2) + (m2).lpad('0',2) + '00'));});
	}
	else {
		end = end.replace('a.m.','').trim().replace(/(\d{1,2}):(\d{2}?)/,function(s,m1,m2){ return ((m1).lpad('0',2) + (m2).lpad('0',2) + '00');});
	}
	
	return end;
}

String.prototype.lpad = function(padString, length) {
	var str = this;
    while (str.length < length)
        str = padString + str;
    return str;
}
 