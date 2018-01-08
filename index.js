// Dependencies

require('dotenv').config();
var http = require("request"),
    _ = require("underscore"),
    async = require("async"),
    cors = require('cors'),
    moment = require('moment'),
    path = require('path'),
    bodyParser = require('body-parser')
    elasticsearch = require('elasticsearch'),
    elastic = new elasticsearch.Client({
        host: process.env.ES,
        log: 'trace'
    }),
    schedule = require('node-schedule');

// App setup

const filter = process.env.FILTER;
const apiuser = process.env.APIUSER;
const apipass = process.env.APIPASS;
const jira = process.env.JIRA;


const express = require('express');
const app = express();

var leadStatusses = ["In Progress", "Awaiting Code Review", "In code review", "Awaiting QA Dev", "In QA Dev", "Awaiting UAT"]
var nonLeadStatusses = ['Backlog', 'Awaiting Development', 'Done']
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use('/', express.static(path.join(__dirname, 'public')))


var issues = [],
    defaultFields = {
        "index": "stories",
        "type": "stories",
        "body": {}
    }


// Fetch all data

var fetchIssues = function (jql, qType, gnext) {

    var url = "https://"+apiuser+":"+apipass+"@"+jira+"/search?expand=changelog&maxResults=1000&jql=" + jql
    http(url, function (err, response, body) {
        var body = JSON.parse(body);
        var l = {};
        async.map(body.issues, function (issue, cb) {
            var x = {}
            x.key = issue.key;
            x.issueType = issue.fields.issuetype.name;
            x.status = issue.fields.status.statusCategory.name;
            x.realStatus = issue.fields.status.name
            x.epic = issue.fields.customfield_10800;
            x.labels = issue.fields.labels;
            if (issue.fields.resolution) x.resolution = issue.fields.resolution.name;
            x.description = issue.fields.summary;
            x.title = issue.fields.customfield_10801;
            x.sp = issue.fields.customfield_10105 || 0;
            if (issue.fields.fixVersions.length > 0) {
                x.releaseDate = issue.fields.fixVersions[0].releaseDate;
                x.releaseName = issue.fields.fixVersions[0].name
            }
            x.history = []
            x.lead = 0;
            var y = {}
            y.status = "Created";
            y.dt = issue.fields.created;
            x.history.push(y);

            // Map Histories

            var historyItems = issue.changelog.histories.map(function (history) {
                var filterStatus = history.items.filter(function (historyItem) {
                    return (historyItem.field == "status")
                })
                filterStatus.forEach(function (fs) {
                    y = {}
                    y.status = fs.toString;
                    y.dt = history.created;
                    x.history.push(y)
                    return;
                })
                return;
            })

            x.history.forEach(function (historyItem, index) {

                var start = moment(historyItem.dt);
                var end = (typeof(x.history[index + 1]) == "undefined") ?  moment(): moment(x.history[index + 1].dt);

                // We don't want to count weekends
                var weekendCounter = 0;
                var start2 = start;
                while (start2 <= end) {

                    if (start.format('ddd') == 'Sat' || start.format('ddd') == 'Sun') {
                        weekendCounter++; //add 1 to your counter if its not a weekend day
                    }
                    start2.add(1, "days");
                }
                x.history[index].duration = moment.duration(end.diff(moment(historyItem.dt))).asSeconds()
                x.history[index].start = moment(historyItem.dt);
                x.history[index].end = end;
                x.history[index].weekendDays = weekendCounter
                if (leadStatusses.includes(historyItem.status)) {
                    x.lead =+ x.history[index].duration;
                }

            })

            var statusHistory = {};
            x.history.map(function (item) {
                if (!statusHistory[item.status]) {
                    statusHistory[item.status] = {};
                    statusHistory[item.status].duration = 0;
                }
                statusHistory[item.status].duration += (item.duration || 0);
                return;
            })
            x.durationPerStatus = [];
            x.durationPerStatusFlat = {}
            Object.keys(statusHistory).forEach(function (item) {
                var y = {}
                y.label = item;
                y.duration = statusHistory[item].duration;
                x.durationPerStatusFlat[item.replace(/ /g, "_")] = statusHistory[item].duration;
                x.durationPerStatus.push(y);
            })
            x.lead = moment.duration(x.lead, "seconds").asDays().toFixed(2)
            cb(null, x);
        }, function (err, items) {
            //gnext(items);
            // Push items to ES here
            items.forEach(function (i) {
                elastic.index({
                    index: "stories",
                    type: qType || "stories",
                    id: i.key,
                    body: i
                }, function (err, r) {
                    if (err) console.log(err);
                })
            });

            // Add to epic
            async.map(items, function (i, next) {
                if (!l[i.epic]) {
                    l[i.epic] = []
                }
                l[i.epic].push(i);

                next(null, i)
            }, function (err, r) {
                issues = l;
                gnext(l);
            })
        });
    });
}

// Fetch data from last release

app.get("/fetchRelease", function (req, res) {
    var jql = "(fixVersion=latestReleasedVersion()) AND filter="+filter+" and resolution in (Fixed, Done)";
    var qType = "stories"
    fetchIssues(jql, qType, function (item) {
        res.json(item);
    })
})

// Fetch data from tickets that are currently ongoing

app.get("/fetchOngoing", function (req, res) {
    var jql = "filter = "+filter+" AND status not in ('Backlog', 'Awaiting Development', 'Done') AND issuetype not in ('Epic', 'UX', 'Problem', 'Service Request', 'Follow Up')";
    var qType = "ongoing";
    defaultFields.type = "ongoing"
    defaultFields.body = {query: {match_all: {}}}
    elastic.deleteByQuery(defaultFields, function(err, r) {
        fetchIssues(jql, qType, function (items) {
            res.json(items);
        })
    })
})

// Fetch tickets that are fixed or done in current sprint

var getCurrent = function(next) {
    var jql = "filter="+filter+" and resolution in (Fixed, Done) and resolved >=  -14d and type != 'Epic' and fixVersion is EMPTY";
    var qType = "currentSolved";
    defaultFields.type = "currentSolved"
    defaultFields.body = {query: {match_all: {}}}
    elastic.deleteByQuery(defaultFields, function(err, r) {
        if (!err) {
            fetchIssues(jql, qType, function (items) {
                next(items);
            })
        }
    })
}

app.get("/fetchCurrentResolved", function(req, res) {
    getCurrent(function(data) {
        res.json(data);
    })
})

/* Get List of releases */

var getReleases = function (limit, next) {
    var q = {
        "aggs": {
            "releaseNames": {
                "terms": {
                    "field": "releaseName.keyword"
                },
                "aggs": {
                    "releaseDates": {
                        "max": {
                            "field": "releaseDate"
                        }
                    }
                }
            }
        }
    };

    elastic.search({
        index: "stories", type: "stories", body: q
    }).then(function (body) {
        var releases = body.aggregations.releaseNames.buckets.map(function (bucket) {
            return {key: bucket.key, date: moment(bucket.releaseDates.value).format("YYYY-MM-DD")}
        });
        next(_.sortBy(releases, function (o) {
            return o.date
        }).reverse().slice(0, limit));
    }, function (error) {
        console.trace(error.message)
    })
}

// API get releases

app.get("/releases", function (req, res) {
    getReleases(6, function (releases) {
        res.json(releases)
    })
})


var processReleaseData = function (results, next) {
    var release = {}

    release.types = results.aggregations.types.buckets.map(function (bucket) {
        return {
            key: bucket.key,
            count: bucket.doc_count,
            lead: moment.duration((bucket.avgTimeAwaitingCodeReview.value + bucket.avgTimeAwaitingQADev.value + bucket.avgTimeInCodeReview.value + bucket.avgTimeInProgress.value + bucket.avgTimeInQADev.value) / bucket.doc_count, "seconds").asDays().toFixed(2)
        }
    });
    release.issues = results.hits.hits.map(function (item) {
        const x = release.types.filter(t => t.key.toLowerCase() == item._source.issueType.toLowerCase())
        item._source.referenceLead = x[0].lead || 0;
        return item._source
    });
    release.sp = {};
    release.sp.total = results.aggregations.sp.value;
    var missiontemp = results.aggregations.label.buckets.filter(function (type) {
        if (type.key == "mission") {
            return type
        }
        else {
            return false;
        }
    })
    if (missiontemp.length) {
        release.sp.mission = missiontemp[0].sp.value;
    }
    var oMissionTemp = results.aggregations.label.buckets.filter(function (type) {
        if (type.key == "other-mission") {
            return type
        }
        else {
            return false;
        }
    })

    if (oMissionTemp.length) {
        release.sp.otherMission = oMissionTemp[0].sp.value;
    }
    //release.sp.oMission = results.aggregations.label.buckets["other-mission"].sp.value || 0;
    next(release);
}

/* Get Data of 5 last sprints */

app.get("/avgReleases", function (req, res) {
    getReleases(6, function (releases) {
        releases.shift();
        releaseNames = releases.map(function (release) {
            return release.key;
        })
        var q = {
            "size": 1000,
            "query": {
                "terms": {
                    "releaseName.keyword": releaseNames
                }
            },
            "aggs": {
                "types": {
                    "terms": {
                        "field": "issueType.keyword"
                    },
                    "aggs": {
                        "avgTimeCreated": {
                            "sum": {
                                "field": "durationPerStatusFlat.Created"
                            }
                        },
                        "avgTimeAwaitingDevelopment": {
                            "sum": {
                                "field": "durationPerStatusFlat.Awaiting_Development"
                            }
                        },
                        "avgTimeInProgress": {
                            "sum": {
                                "field": "durationPerStatusFlat.In_Progress"
                            }
                        },
                        "avgTimeAwaitingCodeReview": {
                            "sum": {
                                "field": "durationPerStatusFlat.Awaiting_Code_Review"
                            }
                        },
                        "avgTimeInCodeReview": {
                            "sum": {
                                "field": "durationPerStatusFlat.In_code_review"
                            }
                        },
                        "avgTimeAwaitingQADev": {
                            "sum": {
                                "field": "durationPerStatusFlat.Awaiting_QA_Dev"
                            }
                        },
                        "avgTimeInQADev": {
                            "sum": {
                                "field": "durationPerStatusFlat.In_QA_Dev"
                            }
                        }
                    }
                },
                "label": {
                    "terms": {
                        "field": "labels.keyword"
                    },
                    "aggs": {
                        "sp": {
                            "sum": {
                                "field": "sp"
                            }
                        }
                    }
                },
                "sp": {
                    "sum": {
                        "field": "sp"
                    }
                }
            }
        }
        defaultFields.body = q;
        elastic.search(defaultFields).then(
            function (results) {
                processReleaseData(results, function (data) {
                    res.json(data);
                })
            },
            function (error) {
            }
        )
    })
});

/* Get Key data from given sprint */

app.get("/releases/:release", function (req, res) {

    var q = {
        "size": 100,
        "query": {
            "term": {"releaseName.keyword": req.params.release}
        },
        "aggs": {
            "types": {
                "terms": {
                    "field": "issueType.keyword"
                },
                "aggs": {
                    "avgTimeCreated": {
                        "sum": {
                            "field": "durationPerStatusFlat.Created"
                        }
                    },
                    "avgTimeAwaitingDevelopment": {
                        "sum": {
                            "field": "durationPerStatusFlat.Awaiting_Development"
                        }
                    },
                    "avgTimeInProgress": {
                        "sum": {
                            "field": "durationPerStatusFlat.In_Progress"
                        }
                    },
                    "avgTimeAwaitingCodeReview": {
                        "sum": {
                            "field": "durationPerStatusFlat.Awaiting_Code_Review"
                        }
                    },
                    "avgTimeInCodeReview": {
                        "sum": {
                            "field": "durationPerStatusFlat.In_code_review"
                        }
                    },
                    "avgTimeAwaitingQADev": {
                        "sum": {
                            "field": "durationPerStatusFlat.Awaiting_QA_Dev"
                        }
                    },
                    "avgTimeInQADev": {
                        "sum": {
                            "field": "durationPerStatusFlat.In_QA_Dev"
                        }
                    }
                }
            },
            "label": {
                "terms": {
                    "field": "labels.keyword"
                },
                "aggs": {
                    "sp": {
                        "sum": {"field": "sp"}
                    }
                }

            },
            "sp": {
                "sum": {"field": "sp"}
            }
        }
    }
    defaultFields.body = q;
    defaultFields.type = "stories"
    elastic.search(defaultFields).then(function (results) {
        processReleaseData(results, function (data) {
            res.json(data);
        })
    }, function (error) {
        res.json(error.message)
    })

})

/* Get Current Resolved */

app.get("/current", function(req, res) {
    var q = {
        "size": 100,
        "query": {
            "match_all": {}
        },
        "aggs": {
            "types": {
                "terms": {
                    "field": "issueType.keyword"
                },
                "aggs": {
                    "avgTimeCreated": {
                        "sum": {
                            "field": "durationPerStatusFlat.Created"
                        }
                    },
                    "avgTimeAwaitingDevelopment": {
                        "sum": {
                            "field": "durationPerStatusFlat.Awaiting_Development"
                        }
                    },
                    "avgTimeInProgress": {
                        "sum": {
                            "field": "durationPerStatusFlat.In_Progress"
                        }
                    },
                    "avgTimeAwaitingCodeReview": {
                        "sum": {
                            "field": "durationPerStatusFlat.Awaiting_Code_Review"
                        }
                    },
                    "avgTimeInCodeReview": {
                        "sum": {
                            "field": "durationPerStatusFlat.In_code_review"
                        }
                    },
                    "avgTimeAwaitingQADev": {
                        "sum": {
                            "field": "durationPerStatusFlat.Awaiting_QA_Dev"
                        }
                    },
                    "avgTimeInQADev": {
                        "sum": {
                            "field": "durationPerStatusFlat.In_QA_Dev"
                        }
                    }
                }
            },
            "label": {
                "terms": {
                    "field": "labels.keyword"
                },
                "aggs": {
                    "sp": {
                        "sum": {"field": "sp"}
                    }
                }

            },
            "sp": {
                "sum": {"field": "sp"}
            }
        }
    }
    defaultFields.type = "currentSolved";
    defaultFields.body = q;
    elastic.search(defaultFields).then(function (results) {
        processReleaseData(results, function (data) {
            res.json(data);
        })
    }, function (error) {
        res.json(error.message)
    })
})


/* Get Ongoing */

var ongoing = function(next) {
    var q = {
        "size": 100,
        "query": {
            "match_all": {}
        },
        "aggs": {
            "types": {
                "terms": {
                    "field": "issueType.keyword"
                },
                "aggs": {
                    "avgTimeCreated": {
                        "sum": {
                            "field": "durationPerStatusFlat.Created"
                        }
                    },
                    "avgTimeAwaitingDevelopment": {
                        "sum": {
                            "field": "durationPerStatusFlat.Awaiting_Development"
                        }
                    },
                    "avgTimeInProgress": {
                        "sum": {
                            "field": "durationPerStatusFlat.In_Progress"
                        }
                    },
                    "avgTimeAwaitingCodeReview": {
                        "sum": {
                            "field": "durationPerStatusFlat.Awaiting_Code_Review"
                        }
                    },
                    "avgTimeInCodeReview": {
                        "sum": {
                            "field": "durationPerStatusFlat.In_code_review"
                        }
                    },
                    "avgTimeAwaitingQADev": {
                        "sum": {
                            "field": "durationPerStatusFlat.Awaiting_QA_Dev"
                        }
                    },
                    "avgTimeInQADev": {
                        "sum": {
                            "field": "durationPerStatusFlat.In_QA_Dev"
                        }
                    }
                }
            },
            "label": {
                "terms": {
                    "field": "labels.keyword"
                },
                "aggs": {
                    "sp": {
                        "sum": {"field": "sp"}
                    }
                }

            },
            "sp": {
                "sum": {"field": "sp"}
            }
        }
    }
    defaultFields.type = "ongoing";
    defaultFields.body = q;
    elastic.search(defaultFields).then(function (results) {
        processReleaseData(results, function (data) {
            next(data);
        })
    }, function (error) {
        next(error.message)
    })
}

app.get("/ongoing", function(req, res) {
    ongoing(function(data) {
        res.json(data);
    })
})

var jobOngoing = schedule.scheduleJob('0 0 * * * *', function() {
    ongoing(function(data) {})
})

var jobFinishedCurrent = schedule.scheduleJob('1 0 * * * *', function() {
    getCurrent(function(data) {})
})

app.listen(process.env.PORT, function () {})



