
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo'
import { Promise } from "meteor/promise";
import { ValidatedMethod } from "meteor/mdg:validated-method";
import { Githubcount } from  '../imports/api/repo.js';
import { Githubitems } from  '../imports/api/repo.js';
import { Githubcommits } from  '../imports/api/repo.js';

var searchUrl; //store the next page of repo the get
var firstupdate;	//bool to check if the github total repo is needed to be updated
var newreposids;	//to store the repoids from the latest update
var commitUrl;	//store the commit_url
var tmpcount;	//store the no. of commits temperory 
var done;	//bool to check if all commit is calculated
var RepoUpdated;  //bool to check if the repo is updated porperly

function Reset(){
	searchUrl = "https://api.github.com/search/repositories?q=cardano&sort=stars&order=desc&page=1&per_page=100";
	firstupdate = true;
	commitUrl = "";
	tmpcount = 0;
	done = false;
	newreposids = [];
	RepoUpdated = false;
}

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
	  	name: 'Update githubdata everyday at 0401',
	  	schedule: function(parser) {
	    // parser is a later.parse object
	    	return parser.text('at 04:01am everyday');
	  	},
	 	job: () => updateGithubRepos.call({}, (err, data) => {})
	});
	SyncedCron.start();
	//updateGithubRepos.call({}, (err, data) => {});
});


export const updateGithubRepos = new ValidatedMethod({
  name: "updateGithubRepos",
  validate: null,
  run({}) {
    Reset();
    while(!RepoUpdated)
    {
		loopthrougpages();
	}
  }
});



let loopthrougpages= async () => 
    {
    	while ( searchUrl != undefined)
	    {
		    await CallGitHubSearchApi()
		    .then(rslv => {
		    	RepoUpdated = true;
			})
			.catch(err => {
				RepoUpdated = false;
			});
		}
		if(RepoUpdated)
		{
			await RemoveOldRepo().then(rslv => {
			});
			for (const repo of Githubitems.find().fetch())
		    // const repo = Githubitems.findOne();
		    {
		    	tmpcount = 0;	//reset the tmpcount to 0
		    	commitUrl = repo.commits_url;	//get the commit_url from mongodb
		    	console.log(commitUrl);
		    	done = false;
				 	await CallGitHubCommitApi(repo,1)
				    .then(rslv => {
						// it was successful
					})
					.catch(err => {
						// an error occurred, call the done function and pass the err message
						console.log(err);
					});
					if(!done)
					{
						await CallGitHubCommitApi(repo,2)
					    .then(rslv => {
							// it was successful

						})
						.catch(err => {
							// an error occurred, call the done function and pass the err message
							console.log(err);
						});
					}
				await AddNewCommit(repo).then(rslv => {
				});
			}
		}
		console.log(5);
	}

function RemoveOldRepo(){
    return new Promise(function(resolve, reject) {
       		Githubitems.remove({
			 	_id: { $nin: newreposids }
			});
			resolve();
    });
}


function AddNewCommit(repo){
    return new Promise(function(resolve, reject) {
				Githubcommits.insert(
                {
                  repoid: repo._id,
                  name: repo.name,
                  count: tmpcount,
                  time: new Date(),
                }
              );
			resolve();
    });
}



function CallGitHubCommitApi(repo, attempt){
    return new Promise(function(resolve, reject) { 	
      	HTTP.get(
        commitUrl,
        {
          headers: {
            "User-Agent": "emurgo/bot",
            "Authorization": "token 9ca4a0a8b56ef08dc08b7b8ca8b9cc07d02d2ea2"
          }
        },
        (err, resp) => {

          	if (resp && resp.statusCode === 200 ) {
          		if(attempt == 1){
          			var link;
          			try{
          				link = parse_link_header(resp.headers.link).last;
          			}
          			catch(error){}
          			if( link  == undefined) //which means there are less then 100 commits in this response and calculate the no. of commits in this page
          			{	          			
          				var Jresp = JSON.parse(resp.content);
						tmpcount = Jresp.length;
						done = true;
						console.log("total :" + tmpcount);

          			}
          			else //which means there are 100 commits in this response, get the last page - 1 and multiply it by 100, to get the number of commits before the last page
          			{
			            commitUrl = link;
						var match = /[(\&)]([^=]+)\=([^&#]+)/.exec(commitUrl);
						var page = match[2]-1;
						tmpcount = page*100;
					}
				}
				else if(attempt == 2){ // add the commits in the last page with the previous result
          			var Jresp = JSON.parse(resp.content);
					tmpcount += Jresp.length;
					done = true;
					console.log("total :" + tmpcount);

				}
            	resolve();
          } else {
          	console.log("error");
          	done = true;
            reject(err);
          }
        }
      );
    });
}

function CallGitHubSearchApi(){
    return new Promise(function(resolve, reject) {
      	HTTP.get(
        searchUrl,
        {
          headers: {
            "User-Agent": "emurgo/bot",
            "Authorization": "token 9ca4a0a8b56ef08dc08b7b8ca8b9cc07d02d2ea2"
          }
        },
        (err, resp) => {
          	if (resp && resp.statusCode === 200) {
            // Insert each repo into the repos collection
            searchUrl = parse_link_header(resp.headers.link).next;
            if(firstupdate)
            {
	            Githubcount.insert({
		    		repocount: resp.data.total_count,
		    		time: new Date(),
			    });
			    firstupdate = false;
	        }
            for (const repo of resp.data.items) {
            //update the mongodatabase for the repo
            Githubitems.upsert(
                {
               	  _id: repo.id
                },
                {
                  _id: repo.id,
                  repoid: repo.id,
                  name: repo.name,
                  full_name: repo.full_name,
                  description: repo.description,
                  url: repo.html_url,
                  commits_url: repo.commits_url.slice(0,-6)+"?per_page=100",
                }
              );

            }
            // Ready to remove all repos that were not in the result.
             const repoIds = resp.data.items.map(a => a.id);
             for (const id of repoIds)
             {
             	newreposids.push(id);
             }

            resolve('success');
          } else {
          	searchUrl = undefined;
            reject(err);
          }
        }
      );
    });
}

