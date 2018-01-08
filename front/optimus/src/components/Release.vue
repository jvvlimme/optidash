<template>
  <div class="container">
    <div class="row">
      <div class="col-md-12">
        <select v-model="selectedRelease" @change="changeRelease()">
          <option v-for="release in releases" :value="release">{{release.key}} ({{release.date}})</option>
        </select>
      </div>
    </div>
    <div class="row" v-if="selectedRelease" style="margin-top: 2em;">
      <div class="col-sm-12">
        <h1>{{selectedRelease.key}}
          <small>({{selectedRelease.date}})</small>
        </h1>
      </div>
      <div class="col-sm-12" style="max-height: 200px; margin-bottom: 10px">
        <div class="card">
          <div class="card-header">Stories</div>
          <div class="card-body">
            <div class="row">
              <div class="col-sm-3">
                <small>Storypoints</small>
                <h1>{{storyData.sprint.sp}}</h1>
                <div class="card-text">
                  <small>Avg. last 5 sprints: {{(storyData.avgSprints.sp / 5).toFixed()}}</small>
                </div>
              </div>
              <div class="col-sm-3">
                <small>Lead Time (days)</small>
                <h1>{{storyData.sprint.lead}}</h1>
                <div class="card-text">
                  <small>Avg. last 5 sprints: {{storyData.avgSprints.lead}}</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-sm-12">
        <highcharts :options="options"></highcharts>
      </div>
    </div>
  </div>
</template>

<script>
  /*************************************
   * This is under development
   * ***********************************/

  /* eslint-disable */
  import axios from 'axios'

  var options = {
    chart: {
      type: 'column'
    },
    title: {
      text: 'Lead Time Evolution'
    },
    xAxis: {
      categories: [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
      ],
      crosshair: true
    },
    yAxis: {
      min: 0,
      title: {
        text: 'Rainfall (mm)'
      }
    },
    tooltip: {
      headerFormat: '<span style="font-size:10px">{point.key}</span><table>',
      pointFormat: '<tr><td style="color:{series.color};padding:0">{series.name}: </td>' +
      '<td style="padding:0"><b>{point.y:.1f} mm</b></td></tr>',
      footerFormat: '</table>',
      shared: true,
      useHTML: true
    },
    plotOptions: {
      column: {
        pointPadding: 0.2,
        borderWidth: 0
      }
    },
    series: [{
      name: 'Tokyo',
      data: [49.9, 71.5, 106.4, 129.2, 144.0, 176.0, 135.6, 148.5, 216.4, 194.1, 95.6, 54.4]

    }, {
      name: 'New York',
      data: [83.6, 78.8, 98.5, 93.4, 106.0, 84.5, 105.0, 104.3, 91.2, 83.5, 106.6, 92.3]

    }, {
      name: 'London',
      data: [48.9, 38.8, 39.3, 41.4, 47.0, 48.3, 59.0, 59.6, 52.4, 65.2, 59.3, 51.2]

    }, {
      name: 'Berlin',
      data: [42.4, 33.2, 34.5, 39.7, 52.6, 75.5, 57.4, 60.4, 47.6, 39.1, 46.8, 51.1]

    }]
  }

  export default {
    name: 'releases',
    data () {
      return {
        releases: [],
        selectedRelease: '',
        releaseData: {},
        avgReleaseData: {},
        storyData: {
          sprint: {},
          avgSprints: {}
        },
        bugData: {
          sprint: {},
          avgSprints: {}
        },
        options: options
      }
    },
    created () {
      axios
        .get('http://dashboard.gihq.be/releases')
        .then(response => {
        this.releases = response.data
    })
      console.log(this.releases)
    },
    methods: {
      changeRelease () {
        axios
          .get('http://dashboard.gihq.be/releases/' + this.selectedRelease.key)
          .then(response => {
          this.releaseData = response.data
        this.storyData.sprint = this.releaseData.types.filter(item => item.key.toLowerCase() == 'story')[0]
        this.bugData.sprint = this.releaseData.types.filter(item => item.key.toLowerCase() == 'bug')[0]
        this.storyData.sprint.sp = this.releaseData.sp.total
        this.storyData.sprint.spc = ((this.releaseData.sp.mission / this.releaseData.sp.total) * 100).toFixed(0)
        console.log(this.storyData.sprint.spc)
        axios
          .get('http://dashboard.gihq.be/avgReleases')
          .then(response => {
          this.avgReleaseData = response.data
        this.storyData.avgSprints = this.avgReleaseData.types.filter(item => item.key.toLowerCase() == 'story')[0]
        this.storyData.avgSprints.sp = this.avgReleaseData.sp.total
        this.storyData.avgSprints.spc = ((this.avgReleaseData.sp.mission / this.avgReleaseData.sp.total) * 100).toFixed(0)
        this.bugData.avgSprints = this.avgReleaseData.types.filter(item => item.key.toLowerCase() == 'bug')[0]
      })
      })
      }
    }
  }
</script>
