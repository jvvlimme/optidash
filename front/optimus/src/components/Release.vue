<template>
  <div class="container">

    <div class="row">
      <div class="col-md-12">
        <select v-model="selectedRelease" @change="changeRelease()">
          <option v-for="release in releases" :value="release">{{release.key}} ({{release.date}})</option>
        </select>
      </div>
    </div>
    <div class="row">
      <div class="col-md-12">
        <column-chart :data="chartData"></column-chart>
      </div>
    </div>
    <div class="row" v-if="selectedRelease" style="margin-top: 2em;">
      <div class="col-sm-12">
        <h1>{{selectedRelease.key}}
          <small>({{selectedRelease.date}})</small>
        </h1>
      </div>
      <div class="col-sm-12">
        <div class="row">
          <div class="col-sm-6">
            <div class="card" >
              <div class="card-header">Stories</div>
              <div class="card-body">
                <div class="row">
                  <div class="col-sm-6">
                    <small>Storypoints</small>
                    <h1>{{storyData.sprint.sp}}</h1>
                    <div class="card-text">
                      <small>Avg. 5 sprints: {{storyData.avgSprints.sp}}</small>
                    </div>
                  </div>
                  <div class="col-sm-6">
                    <small>Lead Time (days)</small>
                    <h1>{{storyData.sprint.lead}}</h1>
                    <div class="card-text">
                      <small>Avg. 5 sprints: {{storyData.avgSprints.lead}}</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="col-sm-6">
            <div class="card" >
              <div class="card-header">Bugs</div>
              <div class="card-body">
                <div class="row">
                  <div class="col-sm-6">
                    <small>Bugs</small>
                    <h1>{{bugData.sprint.count || 0}}</h1>
                    <div class="card-text">
                      <small>Avg. 5 sprints: {{(bugData.avgSprints.count / 5).toFixed()}}</small>
                    </div>
                  </div>
                  <div class="col-sm-6">
                    <small>Lead Time (days)</small>
                    <h1>{{bugData.sprint.lead || 0}}</h1>
                    <div class="card-text">
                      <small>Avg. 5 sprints: {{bugData.avgSprints.lead}}</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
      <div class="col-sm-12">
        <b-table hover :fields="tableFields" :items="releaseData.issues">
          <template slot="key" slot-scope="data">
            <a v-bind:href="'https://atlassian.persgroep.net/jira/browse/' + data.item.key">{{data.item.key}}</a>
          </template>
        </b-table>
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
        tableFields: [
          {
            key: 'key',
            label: 'Key'
          },
          {
            key: 'issueType',
            label: 'Type'
          },
          {
            key: 'description',
            label: 'Descriptions'
          },
          {
            key: 'sp',
            label: 'sp',
            sortable: true
          },
          {
            key: 'lead',
            label: 'Lead Time',
            sortable: true
          }
        ],
        chartData: []
      }
    },
    created () {
      axios
        .get(this.$base + '/releases')
        .then(response => {
          this.releases = response.data
        })
    },
    methods: {
      changeRelease() {
        axios
          .get(this.$base + '/releases/' + this.selectedRelease.key)
          .then(response => {
            this.releaseData = response.data
            this.storyData.sprint = this.releaseData.types.filter(item => item.key.toLowerCase() == 'story')[0]
            this.bugData.sprint = this.releaseData.types.filter(item => item.key.toLowerCase() == 'bug')[0] || {}
            this.storyData.sprint.sp = this.releaseData.sp.total
            this.storyData.sprint.spc = ((this.releaseData.sp.mission / this.releaseData.sp.total) * 100).toFixed(0)
          })
        axios
          .get(this.$base + '/rollingAvgReleases/' + this.selectedRelease.key)
          .then(response => {
            this.avgReleaseData = response.data
            this.storyData.avgSprints.sp = response.data[response.data.length - 1].mavg
            var series = []
            var spSeries = {}
            spSeries.name = "Storypoints"
            spSeries.data = {}
            this.avgReleaseData.forEach(function (element) {
              spSeries.data[element.name] = element.sp
            })
            var avgSeries = {}
            avgSeries.name = "Average (5 sprints)"
            avgSeries.data = {}
            this.avgReleaseData.forEach(function (element) {
              avgSeries.data[element.name] = element.mavg
            })
            console.log(avgSeries)
            series.push(spSeries)
            series.push(avgSeries)
            this.chartData = series
          })
      }
    }
  }

</script>
