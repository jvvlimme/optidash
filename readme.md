# Optimus Dashboard

### About

The main functionality of this script will poll the jira api every hour for a given filter and calculate the ongoing lead time of the open stories.

### How to get this running

Prerequisites:

* NodeJS
* ElasticSearch instance (I've developed this against a 5.1.1, should work with more recent versions but probably won't with < 5.1)


1. I only want the API

Run

```
npm i
```

In the root create a .env with following info:

```
ES= # Link to your elasticsearch
PORT= # Port on which the nodejs app will run
FILTER= # Your Jira board filter id
APIUSER= # Jira api username
APIPASS= # Jira api password
```

Run
```
node index
```

 It will run on the port specified in the .env file.

Run this in prod with PM2 or your preferred method

**Endpoints**

```
/fetchrelease
```
This will fetch the data of the tickets in the latest release for your filter

```
/fetchongoing
```
This will fetch the data of all your tickets that are currently ongoing

```
/fetchCurrentResolved
```
This will fetch the data of all tickets that are already resolved in the current sprint

```
/releases
```
Returns the list of all releases in the DB (there is no retroactive fetch you won't be able to fetch historical data for now)

```
/releases/:release
```
Returns the data for the given release (only will work for the releases returned by the previous call)

```
/avgReleases
```
Returns aggregated and average data for the last 5 sprints

```
/ongoing
```
Return data for tickets that are currently ongoing

```
/current
```
Returns data for tickets that are resolved in the current sprint

There are 2 jobs that calls the function behind the __fetchongoing__ and __fetchcurrentresolved__ every hour so that data is updated automatically.

2. I also want the frontend

The frontend is built with Vuejs.  Go to the ./front/optimus folder and run

```
npm i
```

In ./src/main.js find

```javascript
Vue.prototype.$base =
```
And change this to the location of your server.

To create the production version run

```
npm run build
```

And you'll find all the files in the ./dist folder after it ran.  You can upload those to your webserver.



