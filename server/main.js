
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo'
import { Promise } from "meteor/promise";
import { ValidatedMethod } from "meteor/mdg:validated-method";
import { Githubcount } from  '../imports/api/repo.js';
import { Githubitems } from  '../imports/api/repo.js';
var providerUrl = "https://api.github.com/search/repositories?q=cardano&sort=stars&order=desc&page=1&per_page=100";
var firstupdate = true;
var newreposids = [];


function parse_link_header(header) {
    if (header.length === 0) {
        throw new Error("input must not be of zero length");
    }

    // Split parts by comma
    var parts = header.split(',');
    var links = {};
    // Parse each part into a named link
    for(var i=0; i<parts.length; i++) {
        var section = parts[i].split(';');
        if (section.length !== 2) {
            throw new Error("section could not be split on ';'");
        }
        var url = section[0].replace(/<(.*)>/, '$1').trim();
        var name = section[1].replace(/rel="(.*)"/, '$1').trim();
        links[name] = url;
    }
    return links;
}

Meteor.startup(() => {
  //code to run on server at startup
	SyncedCron.add({
	  	name: 'Update githubdata every day',
	  	schedule: function(parser) {
	    // parser is a later.parse object
	    	return parser.text('every 1 days');
	  	},
	 	job: () => updateGithubRepos.call({}, (err, data) => {})
	});
	SyncedCron.start();
});


export const updateGithubRepos = new ValidatedMethod({
  name: "updateGithubRepos",
  validate: null,
  run({}) {
    //if (!shouldUpdate("GitHub", "repos")) return;
    providerUrl = "https://api.github.com/search/repositories?q=cardano&sort=stars&order=desc&page=1&per_page=100";
	firstupdate = true;
	newreposids = [];
	loopthrougpages();
	Githubitems.remove({
        _id: { $nin: newreposids }
    });
  }
});


let loopthrougpages= async () => 
    {
    	while ( providerUrl != undefined)
	    {
		    await CallGitHubApi()
		    .then(rslv => {
				// it was successful
			})
			.catch(err => {
				// an error occurred, call the done function and pass the err message

			});
		}
	}


function CallGitHubApi(){
    return new Promise(function(resolve, reject) {
      	HTTP.get(
        providerUrl,
        {
          headers: {
            "User-Agent": "emurgo/bot",
          }
        },
        (err, resp) => {
        	//console.log(resp.headers.link);
          	if (resp && resp.statusCode === 200) {
            // Insert each repo into the repos collection
            //console.log(parse_link_header(resp.headers.link).next);
            providerUrl = parse_link_header(resp.headers.link).next;
            if(firstupdate)
            {
	            Githubcount.insert({
		    		repocount: resp.data.total_count,
		    		time: new Date(),
			    });
			    firstupdate = false;
	        }
            for (const repo of resp.data.items) {
            Githubitems.upsert(
                {
                  _id: repo.id
                },
                {
                  _id: repo.id,
                  name: repo.name,
                  full_name: repo.full_name,
                  url: repo.html_url
                }
              );
            }
            // Remove all repos that were not in the result.
            // We do not just remove all repos because other updates may be going on at the same time that rely on the Repos collection
             const repoIds = resp.data.items.map(a => a.id);
             newreposids.push(repoIds);
             //logUpdate("GitHub", "repos");
            resolve('success');
          } else {
          	providerUrl = undefined;
            reject(err);
          }
        }
      );
    });
}

