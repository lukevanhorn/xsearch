var app = require('http').createServer(handler);
var url = require('url');
var fs = require('fs');
var querystring = require('querystring');
var fulltext = require('fulltext');
var search = fulltext.load('classes', 'search');
var browse = fulltext.load('classes', 'browse');

app.listen(process.env.PORT || 8080);

function handler (req, res) {

    try {
        
    	var filepath = req.url;
        var keywords;
        
        var result = req.url.match(/\/([\w.\/]+)?[$\?\b]?(?:keywords\=)?(\S*)?/);
    
        console.log(result);
        if(result && result.length > 0) {
            filepath = result[1];      
            keywords = result[2];
        }
        
        var fn = search;
        
        if(filepath === 'browse') {
            fn = browse;
            keywords += "00";
        }
        
    	fn.find(keywords, { take: 1000, skip: 0, strict: true }, function(count, docs) {
    		var results = '';
    		docs.forEach(function(doc) {
    			results += (results != '' ? ',' : '') + JSON.stringify(doc);
    		});
            
    		res.writeHead(200, {'Content-Type': 'text/json'});
    		return res.end('[' + results + ']');				
    	});	  
            
    } catch(e) {
        res.writeHead(500);
        return res.end(e);    
    }
}