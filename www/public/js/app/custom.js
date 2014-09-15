var myList = {};
var mode = "search";

var QueryString = function () {
  // This function is anonymous, is executed immediately and 
  // the return value is assigned to QueryString!
  var query_string = {};
  var query = window.location.search.substring(1);
  var vars = query.split("&");
  for (var i=0;i<vars.length;i++) {
    var pair = vars[i].split("=");
    	// If first entry with this name
    if (typeof query_string[pair[0]] === "undefined") {
      query_string[pair[0]] = pair[1];
    	// If second entry with this name
    } else if (typeof query_string[pair[0]] === "string") {
      var arr = [ query_string[pair[0]], pair[1] ];
      query_string[pair[0]] = arr;
    	// If third or later entry with this name
    } else {
      query_string[pair[0]].push(pair[1]);
    }
  } 
    return query_string;
} ();

function search() {
	mode = "search";
	
	getJSON('/find', {keywords: $("#keywords").val() }, function(data){
		results = data;	
					
		update();					
	});
}

function getId(id) {
	mode = "list";
	
	$("#resultCount").html('');
	getJSON('/get', {id: id}, function(data){
		results = data;	
					
		update();					
	});
}

function browse(letter) {
	mode = "browse";

	getJSON('/browse', {keywords: letter.toLowerCase() }, function(data){
		results = data;	
					
		update();					
	});
}

function viewList() {
	mode = "list";
	
	results = [];
	for(var prop in myList) {
		results.push(myList[prop]);
	}
					
	update();					
}

function update() {
	var data = results;
	var errors = 0;		
	
	d3.select("#results").selectAll('p').remove();
	d3.select("#results").append('p').html('<img src="/images/loading.gif" alt="loading" />'); 
	
	if(mode != "list") {
		var strict = $("#strictChk").prop('checked');
		var fall = $("#fallChk").prop('checked');
		var spring = $("#springChk").prop('checked');
		var mit = $("#mitChk").prop('checked');
		var harvard = $("#harvardChk").prop('checked');
	}
	if(mode == "search") {
		var share = '<a target="_blank" href="http://';
		
		share += (window.location.host + '?keywords=' + escape($("#keywords").val()));
		share += (strict ? '&exact=checked' : '');
		share += (fall ? '&fall=checked' : '');
		share += (spring ? '&spring=checked' : '');
		share += (mit ? '&mit=checked' : '');
		share += (harvard ? '&harvard=checked' : '');			
		share += '"><i style="font-size: 12px" class="glyphicon glyphicon-share"></i> share</a>';		
		
		$("#filter").html(share);		
	}
	
	d3.select("#results").selectAll('p').remove();
	if(!data || data.length == 0) {
		$("#resultCount").html('0 results');
		return;
	}
	
	if(mode != "list" && (!fall || !spring || !mit || !harvard || strict)) { 
		data = data.filter(function(d) {
			if(!d.document || !d.document.school) {	
				errors++;						
				return false;
			}
			
			if(!fall || !spring && d.document.semester) {
				var semester = Array.isArray(d.document.semester) ? d.document.semester : [d.document.semester];
		
				if(!fall && semester.some(function(s) { return (s.toLowerCase().indexOf('fall') > -1); })) {
					return false;
				}
			
				if(!spring && semester.some(function(s) { return (s.toLowerCase().indexOf('spring') > -1); })) {
					return false;
				}
			}
			
			if(!mit && d.document && d.document.school && d.document.school.toLowerCase().indexOf('mit') == 0) {
				return false;
			}
			
			if(!harvard) {
				if(d.document && d.document.school && d.document.school.toLowerCase().indexOf('mit') > -1) {
					return true;
				} else  {
					return false;
				}				
			} 
			
			if(strict && d.document) {
  
				var regexExpression ="\b" + $("#keywords").val().toLowerCase() + "\b";
				var regex = new RegExp(regexExpression, "i");
				var found = false;
				
				for (var prop in d.document) {
				    if ((' ' + d.document[prop].toString().toLowerCase() + ' ').indexOf((' ' + $("#keywords").val().toLowerCase() + ' ')) > -1) {
				      found = true;
				    }
			  	}
				  
				if(!found) {
					return false;
				}  
			}
			
			return true;
		});
	}
	
	$("#resultCount").html(data.length + ' results' + (errors > 0 ? ', errors: ' + errors : ''));
	
	var p = d3.select("#results").selectAll('p')
	.data(data)
	.enter().append('p')
	.attr('class','course');									
	
	p.append('h3').html(function(d){
			if(!d.document || !d.document.school) {							
				return "";
			}
			
			if(d.document.school.toLowerCase().indexOf('harvard') > -1) {
				return (d.document ? '<a target="_blank" href="https://coursecatalog.harvard.edu/icb/icb.do?keyword=CourseCatalog&pageContentId=icb.pagecontent695860&view=detail&viewParam_q=id:' + d.document.link + '">' + d.document.title + '</a>' : '');
			}
			
			return (d.document ? '<a target="_blank" href="http://course.mit.edu/a/' + d.document.id + '">' + d.document.title + '</a>' : '');
		})
		.attr('class', function(d) {return (d.document && d.document.school && d.document.school.toUpperCase() == 'MIT') ? 'mit' : 'harvard'; });
		
	p.append('span').html(function(d) {
		if(!d.document) {
			return;
		}
		var semester = Array.isArray(d.document.semester) ? d.document.semester.join().toLowerCase() : d.document.semester;
		var	faculty = Array.isArray(d.document.faculty) ? d.document.faculty.join() : d.document.faculty;		
		var meets = (d.document.meets ? d.document.meets : '');
		meets += d.document.time ? '<br />' + d.document.time : '';

		var link = '<a href="#" onclick="javascript: saveClass(\'' + d.id.trim() + '\',this);"><i class="glyphicon glyphicon-plus"></i> add to cart</a>';
		if(myList && myList[d.id]) {
			link = '<a href="#" onclick="javascript: removeClass(\'' + d.id.trim() + '\',this);"><i class="glyphicon glyphicon-minus"></i> remove from cart</a>';			
		}
		
		var share = '<a target="_blank" href="http://' + window.location.host + '?id=' + d.id + '"><i class="glyphicon glyphicon-share"></i> share</a>';
		
		var content = d.document.school;
		content += (semester ? ', (' + semester + ')' : '');
		content += (faculty ? '<br />' + faculty : '');
		content += (meets ? '<br />' + meets : '');
		content += '<br />' + link + '<br />' + share + '<br /><br />'; 
		
		return content; 
	});
	
	p.append('span').html(function(d) {
		if(!d.document) {
			return;
		}
	
		return d.document ? d.document.description : '';
	});
	

	
	highlight();			
}

function saveClass(id,elem) {
	if(myList[id] != null) {
		alert("Item is already in your list");
	}
	
	$.each(results, function(i,d) {
		if(d.id == id) {
			myList[id] = d;
			$(elem)[0].outerHTML = '<a href="#" onclick="javascript: removeClass(\'' + id.trim() + '\',this);"><i class="glyphicon glyphicon-minus"></i> remove from cart</a>';
		}
	});
	
	saveList();
}

function removeClass(id,elem) {

	if(!myList[id]) {
		return;
	}
	
	delete myList[id];
	
	saveList();
		
	if(window.location.pathname.indexOf('list') > -1) {
		window.location.reload();
	} else {
		$(elem)[0].outerHTML = '<a href="#" onclick="javascript: saveClass(' + id + ');"><i class="glyphicon glyphicon-plus"></i> add to cart</a>';
	}
}

function loadList() {
	if(typeof(Storage) !== "undefined") {
		try {
			myList = JSON.parse(localStorage.getItem("ClassList") || {});
		}catch(e){
			myList = {};
		}
	} 
}

function saveList() {
	if(typeof(Storage) !== "undefined") {
		try {
		localStorage.setItem("ClassList", JSON.stringify(myList) );
		} catch(e){}
	} 
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
					val += ((val.length > 0 ? ', ' : '') + 'Monday');
					break;
				case 'T': 
					val += ((val.length > 0 ? ', ' : '') + 'Tuesday');
					break;
				case 'W': 
					val += ((val.length > 0 ? ', ' : '') + 'Wednesday');
					break;
				case 'R': 
					val += ((val.length > 0 ? ', ' : '') + 'Thursday');
					break;
				case 'F': 
					val += ((val.length > 0 ? ', ' : '') + 'Friday');
					break;
				case 'S': 
					val += ((val.length > 0 ? ', ' : '') + 'Saturday');
					break;
				case 'U': 
					val += ((val.length > 0 ? ', ' : '') + 'Sunday');
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

function highlight() {
	return;  //temp disable
	
	if($("#highlightChk").prop('checked')) {
		var strict = $("#strictChk").prop('checked');		
		myHilitor = new Hilitor("results");
		myHilitor.setMatchType('open');	
		var keywords = (strict ? ' ' + $("#keywords").val() + ' ' : $("#keywords").val());
		myHilitor.apply(keywords);							
	} else {
		myHilitor.remove();
	}				
}
	
function addError(error) {
	var self = this;
	
	$("#status").html(error);
}

function getJSON(url, data, onSuccess, onError, onComplete ) {

    $.ajax({
        type : "GET",
        url : url,
        data: data,
        dataType : 'json',
		beforeSend : function() {
			d3.select("#results").selectAll('p').remove();
			d3.select("#results").append('p').html('<img src="/images/load.gif" alt="loading" />'); 	
		},
        success : function(data) {             
                if(onSuccess) {
                    onSuccess(data);
                }
        },
        error : function(xhr, status, error) {
            if(onError) {
                onError(xhr.responseText);
            } else {
                addError(xhr.responseText);
            }           
        },
        complete: function() {
            if(onComplete) {
                onComplete();
            }
        }
    });
}