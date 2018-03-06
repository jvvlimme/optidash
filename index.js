// Dependencies

require('dotenv').config();
var http = require("request"),
    _ = require("lodash"),
    async = require("async"),
    cors = require('cors'),
    moment = require('moment'),
    path = require('path'),
    bodyParser = require('body-parser'),
    ses = require('node-ses')
elasticsearch = require('elasticsearch'),
    elastic = new elasticsearch.Client({
        host: process.env.ES
    }),
    schedule = require('node-schedule');

// App setup

const filter = process.env.FILTER;
const apiuser = process.env.APIUSER;
const apipass = process.env.APIPASS;
const jira = process.env.JIRA;

const mail = ses.createClient({ key: process.env.MAILID, secret: process.env.MAILSECRET, amazon: "https://email.eu-west-1.amazonaws.com" });


const express = require('express');
const app = express();

var teamStatuses = ["Backlog", "Awaiting Development", "Done", "In Progress", "Awaiting Code Review", "In code review", "Awaiting QA Dev", "In QA Dev", "Awaiting UAT"]
var leadStatuses = ["In Progress", "Awaiting Code Review", "In code review", "Awaiting QA Dev", "In QA Dev", "Awaiting UAT"]
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

// Helper functions

function nl2br (str, is_xhtml) {
    var breakTag = (is_xhtml || typeof is_xhtml === 'undefined') ? '<br />' : '<br>';
    return (str + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + breakTag + '$2');
}


// Fetch all data

var fetchIssues = function (jql, qType, gnext) {

    var url = "https://" + apiuser + ":" + apipass + "@" + jira + "/search?expand=changelog&maxResults=1000&jql=" + jql
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
                var end = (typeof(x.history[index + 1]) == "undefined") ? moment() : moment(x.history[index + 1].dt);

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

                if (_.includes(leadStatuses, historyItem.status)) {
                    x.lead += x.history[index].duration;
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
            x.durationPerStatus.forEach(function (element) {
                if (element.label.indexOf(leadStatuses) > -1) {
                    x.lead += element.duration;
                }
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
    var jql = "(fixVersion=latestReleasedVersion()) AND filter=" + filter + " and resolution in (Fixed, Done)";
    var qType = "stories"
    fetchIssues(jql, qType, function (item) {
        res.json(item);
    })
})

// Fetch data from tickets that are currently ongoing

app.get("/fetchOngoing", function (req, res) {
    var jql = "filter = " + filter + " AND status not in ('Backlog', 'Awaiting Development', 'Done') AND issuetype not in ('Epic', 'UX', 'Problem', 'Service Request', 'Follow Up')";
    var qType = "ongoing";
    defaultFields.type = "ongoing"
    defaultFields.body = {query: {match_all: {}}}
    elastic.deleteByQuery(defaultFields, function (err, r) {
        fetchIssues(jql, qType, function (items) {
            res.json(items);
        })
    })
})

app.get("/fetchAll", function (req, res) {
    var jql = "filter = " + filter + " AND issuetype not in ('Epic', 'UX', 'Problem', 'Service Request', 'Follow Up') AND status NOT IN ('Done')";
    var qType = "all";
    defaultFields.type = "all"
    defaultFields.body = {query: {match_all: {}}}
    elastic.deleteByQuery(defaultFields, function (err, r) {
        fetchIssues(jql, qType, function (items) {
            res.json(items);
        })
    })
})

app.get("/fetchEpics", function (req, res) {
    var jql = "filter =" + filter + " and issuetype = Epic and status not in (Done, closed)"
    var qType = "epics";
    defaultFields.type = "epics"
    defaultFields.body = {query: {match_all: {}}}
    elastic.deleteByQuery(defaultFields, function (err, r) {
        fetchIssues(jql, qType, function (items) {
            var children = items["null"].map(function (item) {
                return item.key;
            })
            fetchEpicChildren(children, function (data) {
                res.send("ok");
            })
        })
    })
})


var fetchEpicChildren = function (children, next) {
    var jql = "'Epic Link' IN (" + children.join(",") + ")";
    console.log(jql)
    var qType = "children";
    defaultFields.type = "children"
    defaultFields.body = {query: {match_all: {}}}
    elastic.deleteByQuery(defaultFields, function (err, r) {
        fetchIssues(jql, qType, function (items) {
            next(items);
        })
    })
}


// Fetch tickets that are fixed or done in current sprint

var getCurrent = function (next) {
    var jql = "filter=" + filter + " and resolution in (Fixed, Done) and resolved >=  -14d and type != 'Epic' and fixVersion is EMPTY";
    var qType = "currentSolved";
    defaultFields.type = "currentSolved"
    defaultFields.body = {query: {match_all: {}}}
    elastic.deleteByQuery(defaultFields, function (err, r) {
        if (!err) {
            fetchIssues(jql, qType, function (items) {
                next(items);
            })
        }
    })
}

app.get("/fetchCurrentResolved", function (req, res) {
    getCurrent(function (data) {
        res.json(data);
    })
})

/* Get List of releases */

var getReleases = function (limit, next) {
    var q = {
        "aggs": {
            "releaseNames": {
                "terms": {
                    "field": "releaseName.keyword",
                    "size": 100
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
    getReleases(100, function (releases) {

        res.json(releases.filter(function (release) {
            return release.date != "Invalid date"
        }))
    })
})

var avgLeadStatusses = function (buckets) {

    var k = Object.keys(buckets),
        counter = 0;

    k.forEach(function (item) {
        if (leadStatuses.includes(item.replace("avgTime", "").replace(/_/g, " "))) {
            counter += buckets[item].value;
        }
    })

    return (counter / buckets.doc_count);

}

var processReleaseData = function (results, next) {
    var release = {}
    release.types = results.aggregations.types.buckets.map(function (bucket) {
        return {
            key: bucket.key,
            count: bucket.doc_count,
            lead: moment.duration(avgLeadStatusses(bucket), "seconds").asDays().toFixed(2)
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
                    "aggs": {}
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
        teamStatuses.forEach(function (status) {
            q.aggs.types.aggs["avgTime" + status.replace(/ /g, "_")] = {
                "sum": {"field": "durationPerStatusFlat." + status.replace(/ /g, "_")}
            }
        });
        defaultFields.body = q;
        //console.log(JSON.stringify(q))
        elastic.search(defaultFields).then(
            function (results) {
                processReleaseData(results, function (data) {
                    res.json(data);
                })
            },
            function (error) {
                console.log(error)
            }
        )
    })
});

app.get("/rollingAvgReleases/:release", function (req, res) {

    // Get release data

    var q = {
        "size": 1,
        "query": {
            "term": {
                "releaseName.keyword": req.params.release
            }
        }
    }
    //console.log(JSON.stringify(q))
    defaultFields.body = q;
    defaultFields.type = "stories"
    elastic.search(defaultFields).then(function (results) {
        var releaseDate = moment(results.hits.hits[0]._source.releaseDate).add(1, "day").format();
        console.log(releaseDate);
        var q = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "range": {
                                "releaseDate": {
                                    "gte": moment("2017-08-10").format(),
                                    "lte": releaseDate
                                }

                            }
                        }
                    ]
                }

            },
            "aggs": {
                "releases": {
                    "date_histogram": {
                        "field": "releaseDate",
                        "interval": "14d"
                    },
                    "aggs": {
                        "release": {
                            "terms": {"field": "releaseName.keyword"}
                        },
                        "sp": {
                            "sum": {
                                "field": "sp"
                            }
                        },
                        "mavg": {
                            "moving_avg": {
                                "buckets_path": "sp",
                                "window": 5
                            }
                        }
                    }
                }
            }
        }
        console.log(JSON.stringify(q))
        defaultFields.body = q;
        defaultFields.type = "stories"
        elastic.search(defaultFields).then(function (results) {
            res.send(
                results.aggregations.releases.buckets.map(function (el) {
                    var x = {}
                    x.dt = moment(el.key_as_string).format("YYYY-MM-DD");
                    x.count = el.doc_count;
                    x.name = el.release.buckets[0] ? el.release.buckets[0].key: "unknown" ;
                    x.sp = el.sp.value;
                    x.mavg = el.mavg ? el.mavg.value : 0;
                    return x;
                }))
        })

    }, function (error) {
        res.json(error.message)
    })


})


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
                "aggs": {}
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
    teamStatuses.forEach(function (status) {
        q.aggs.types.aggs["avgTime" + status.replace(/ /g, "_")] = {
            "sum": {"field": "durationPerStatusFlat." + status.replace(/ /g, "_")}
        }
    });
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

app.get("/current", function (req, res) {
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
                "aggs": {}
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
    teamStatuses.forEach(function (status) {
        q.aggs.types.aggs["avgTime" + status.replace(/ /g, "_")] = {
            "sum": {"field": "durationPerStatusFlat." + status.replace(/ /g, "_")}
        }
    });
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

/* Get all open tickets */

app.get("/allIssues", function (req, res) {
    allIssues(function (data) {
        res.json(data);
    })
})

var allIssues = function (next) {
    var q = {
        "size": 1000,
        "query": {
            "match_all": {}
        },
        "aggs": {
            "types": {
                "terms": {
                    "field": "issueType.keyword"
                },
                "aggs": {}
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
    teamStatuses.forEach(function (status) {
        q.aggs.types.aggs["avgTime" + status.replace(/ /g, "_")] = {
            "sum": {"field": "durationPerStatusFlat." + status.replace(/ /g, "_")}
        }
    });
    defaultFields.type = "all";
    defaultFields.body = q;
    elastic.search(defaultFields).then(function (results) {
        processReleaseData(results, function (data) {
            var x = _.groupBy(data.issues, function (item) {
                return item.epic
            });
            data.issues = x;
            next(data);
        })
    }, function (error) {
        next(error.message)
    })
}

/* Get all epics and their stories */

var epics = function (next) {
    var t1 = {
        index: defaultFields.index,
        type: "epics"
    }
    var q1 = {
        "size": 1000,
        "query": {
            "match_all": {}
        }
    }
    var t2 = {
        index: defaultFields.index,
        type: "children"
    }
    var q2 = {
        "size": 1000,
        "query": {
            "match_all": {}
        },
        "aggs": {
            "types": {
                "terms": {
                    "field": "issueType.keyword"
                },
                "aggs": {}
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

    teamStatuses.forEach(function (status) {
        q2.aggs.types.aggs["avgTime" + status.replace(/ /g, "_")] = {
            "sum": {"field": "durationPerStatusFlat." + status.replace(/ /g, "_")}
        }
    });
    //console.log(JSON.stringify(q2))
    elastic.msearch({
        body: [
            t1,
            q1,
            t2,
            q2
        ]
    }).then(function (results) {
        // 0 = epics, 1 = stories

        //next(q2)
        processReleaseData(results.responses[1], function (data) {
            var stories = _.groupBy(data.issues, function (item) {
                return item.epic
            })
            var epics = results.responses[0].hits.hits.map(function (item) {
                return item._source;
            })

            var x = epics.map(function (item) {
                item.issues = stories[item.key];
                return item
            })
            //console.log(JSON.stringify(x));
            next(x);
        })

    })

}

app.get("/epics", function (req, res) {
    epics(function (data) {
        res.json(data);
    })
})

/* Get Ongoing */

var ongoing = function (next) {
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
                "aggs": {}
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

    teamStatuses.forEach(function (status) {
        q.aggs.types.aggs["avgTime" + status.replace(/ /g, "_")] = {
            "sum": {"field": "durationPerStatusFlat." + status.replace(/ /g, "_")}
        }
    });
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

app.get("/ongoing", function (req, res) {
    ongoing(function (data) {
        res.json(data);
    })
})

app.get("/getLead", function (req, res) {
    var q = {
        size: 10000,
        query: {
            match_all: {}
        }
    }
    defaultFields.body = q;
    defaultFields.type = "stories"
    elastic.search(defaultFields).then(function (results) {
        var r = results.hits.hits
        var lead = 0;
        r.forEach(function (el) {

        })

    })
})

// AWS

app.get("/fetchAws", function(req, res) {

    // WIP

    http("https://api.cloudcheckr.com/api/billing.json/get_detailed_billing_with_grouping_v2?saved_filter_name="+process.env.CCREPORT+"&access_key="+process.env.CLDCHKR, function(err, resp, r) {
        var awsData = JSON.parse(r).CostsByTime
        var body = []
        awsData.forEach(function(service) {
            var x = {}, z = {}
            var name = service.Groups[0].FriendlyName
            x._index='stories'
            x._type='aws'
            service.CostDates.forEach(function(point) {
                x._id = name + "-" + moment(point.Date).format("YYYY-MM-DD");
                z.index = x
                body.push(z);
                var y = {}
                y.name = name;
                y.dt = moment(point.Date).format();
                y.cost = parseFloat(point.Cost).toFixed(2);
                body.push(y);
            })
        })
        elastic.bulk({body: body}, function(err, resp) {
            res.json(resp);
        })
    })
})

app.get("/aws/detail", function(req, res) {

    // WIP

    var aggregation = {"aggs": {
        "cost_over_time": {
            "date_histogram": {
                "field": "dt",
                "interval": "day"
            },
            "aggs": {
                "service": {
                    "terms": {
                        "field": "name"
                    }
                },
                "aggs": {
                    "cost": {
                        "sum": {
                            "field": "cost"
                        }
                    }
                }
            }
        }
    }}
})


var getCostSavings = function(next) {
    http("https://api.cloudcheckr.com/api/billing.json/get_cost_saving?access_key="+process.env.CLDCHKR, function(err, resp, r) {
        var result = JSON.parse(r);
        var keys = Object.keys(result);

        var improvements = []

        keys.forEach(function(el) {
            if (el.indexOf("Total") == -1) {
                if (result[el] && result[el].length) {
                    result[el].forEach(function(imp) {
                        var x = {}
                        x.name = imp.Name;
                        x.savings = imp.TotalSaving;
                        improvements.push(x)
                    })
                }

            }
        })

        var y = {}
        y.totalSavings = result.TotalSaving;
        y.improvements = improvements;

        next(y);

    })
}

app.get("/aws/savings", function(req, res) {
    getCostSavings(function(vals) {
        res.json(vals)
    })
})

app.get("/aws", function(req, res) {
    var x = {}
    var start = moment().startOf("month").format("YYYY-MM-DD"),
        end = moment().format("YYYY-MM-DD"),
        daysInMonth = moment().daysInMonth(),
        startLastMonth = moment().subtract(1, "month").startOf("month").format("YYYY-MM-DD"),
        endLastMonth = moment().subtract(1, "month").endOf("month").format("YYYY-MM-DD");
    console.log(start, end)
    // Get data for ongoing month
    http("https://api.cloudcheckr.com/api/billing.json/get_detailed_billing_with_grouping_v2?saved_filter_name="+process.env.CCREPORT+"&access_key="+process.env.CLDCHKR + "&start=" + start + "&end=" + end, function(err, resp, r) {
        console.log(r)
        var result = JSON.parse(r);
        x.mtd = parseFloat(result.Total.toFixed(2));
        x.forecast = parseFloat(((result.Total / moment().format("DD")) * daysInMonth).toFixed(2));

            x.services = result.CostsByGroup.map(function(service) {
                var y = {}
                y.name = service.GroupValue;
                y.cost = parseFloat(service.Cost);
                return y;
            })


        // Get data for past month
        http("https://api.cloudcheckr.com/api/billing.json/get_detailed_billing_with_grouping_v2?saved_filter_name="+process.env.CCREPORT+"&access_key="+process.env.CLDCHKR + "&start=" + startLastMonth + "&end=" + endLastMonth, function(err, resp2, r2) {
            x.last = parseFloat(JSON.parse(r2).Total.toFixed(2));

            // Get savings

            getCostSavings(function(result) {
                x.savings = result;
                res.json(x);
            })

        });

    })
})

app.get("/sprintmail", function(req, res) {

    // WIP

    var CRLF = '\r\n';
    var rawMessage = [
        'From: "Jan van Vlimmeren" <jan.van.vlimmeren@persgroep.net>',
        'To: "Jan van Vlimmeren" <jan.vanvlimmeren@gmail.com>',
        'Subject: greetings',
        'Content-Type: multipart/mixed;',
        '    boundary="_003_97DCB304C5294779BEBCFC8357FCC4D2"',
        'MIME-Version: 1.0',
        '',
        '--_003_97DCB304C5294779BEBCFC8357FCC4D2',
        'Content-Type: text/plain; charset="us-ascii"',
        'Content-Transfer-Encoding: quoted-printable',
        'Hi brozeph,',
        '',
        'I have attached a code file for you.',
        '',
        'Cheers.',
        '',
        '--_003_97DCB304C5294779BEBCFC8357FCC4D2',
        'Content-Type: text/plain; name="code.txt"',
        'Content-Description: code.txt',
        'Content-Disposition: attachment; filename="code.txt"; size=4;',
        '    creation-date="Mon, 03 Aug 2015 11:39:39 GMT";',
        '    modification-date="Mon, 03 Aug 2015 11:39:39 GMT"',
        'Content-Transfer-Encoding: base64',
        '',
        'ZWNobyBoZWxsbyB3b3JsZAo=',
        '',
        '--_003_97DCB304C5294779BEBCFC8357FCC4D2',
        ''
    ].join(CRLF);

    mail.sendEmail({
        to: 'jan.van.vlimmeren@persgroep.net'
        , from: 'jan.van.vlimmeren@persgroep.net'
        , subject: 'greetings'
        , message: 'your <b>message</b> goes here'
    }, function(err, data, res) {
        console.log(err)
        console.log(data)
        console.log(res)
    });
})

module.exports = app


//app.listen(process.env.PORT, function () {})

