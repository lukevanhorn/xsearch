x-search 
=======
Author: Luke Van Horn
License: MIT


Harvard / MIT course catelog parse and search tool.  See it live:  http://unisearch.azurewebsites.net

Requirements:
<pre>
    node.js with edge.js package
    .NET 4.x framework
    Microsoft Azure account. (can be hosted for free on shared website instance)
</pre>

This projects consists of 3 parts:

1. Parser(s).  These node.js apps read the course lists from the Harvard and MIT websites, parse the individual classes and create full-text search indexes.
2. Agenda iCal Generator.   Creates .ics files for each school.  This allows for importing into google calendar. 
3. Website.  Search, browse and create user lists.   

# Step 1): Run the parsers.  

If this isn't the first run, delete any files and subdirectories from the search and browse folders.

The Harvard parser makes an Edge call to .NET for pulling the raw html as node.js was not working well with https.  The MIT parser uses 100% node.js.  

From the root project directory, run:
    <pre>node harvardparser</pre>
then:
    <pre>node mitparser</pre>

Full json formated course lists will be saved into the data directory.  Full-text search indexes are generated in the browse and search folders.  
Zip both of these directories and copy to the www folder.  These will need to be extracted on the server once deployed.


# Step 2): Generate iCal files

Edit the harvardcal.js and mitcal.js with the desired semester dates.

From the project root directory, run:
    <pre>node harvardcal</pre>
then: 
    <pre>node mitcal</pre>

The ics files will be generated in the data folder.  Import these to google calendar for each school.  
Generate a custom link in the google calendar settings area (include all school calendars), then update /www/public/calendar.html with the new iframe code. 


# Step 3): Publish the Website to Azure

If you don't have an account, create one for free here: http://www.windowsazure.com

Log into the portal and create a new website.  Use dropbox or git to deploy files in the www folder.  

Open the project in Monaco (VS Online) or ssh into the website VM and extract the search.zip and browse.zip into the root directories.   

Note, webserver.js doesn't handle the static file serving and instead leverages IIS.  All static documents live in the public folder.  




