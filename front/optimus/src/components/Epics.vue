<template>
  <div class="container">
    <div class="row">
      <div class="col-md-11">
        <select v-model="epicSelected" @change="changeEpic()">
          <option v-for="epic in epics" :value="epic.key">{{epic.key}} - {{epic.title}} </option>
        </select>
      </div>
      <div class="col-md-1">
        <b-button size="sm" variant="primary" @click="fetchEpics()">Fetch Epics</b-button>
      </div>
    </div>
    <div v-if="epicSelected" class="row" style="margin-top: 20px">
      <div class="col-md-7">
        <div class="card text-white bg-primary">
          <div class="card-header"><a v-bind:href="'https://atlassian.persgroep.net/jira/browse/' + selectedEpic.key" style="color: white !important">{{selectedEpic.title}}</a></div>
          <div class="card-body">
            <div class="card-title"><div class="row">
              <div class="col-sm-3">
                <h1>{{selectedEpic.estSP + selectedEpic.sp}}</h1><br><small>est.</small>
              </div>
              <div class="col-sm-3">
                <h1>/ {{selectedEpic.sp}}</h1> <br><small>current</small>
              </div>
              <div class="col-sm-3"><h1>/ {{selectedEpic.lead}} </h1><br> <small>lead</small></div>
              <div class="col-sm-3"><h1>/ {{selectedEpic.leadEst}} </h1><br> <small>est. lead</small></div>
            </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-5">
        {{selectedEpic.description}}
      </div>
    </div>
    <div v-if="epicSelected" class="row" style="margin-top: 20px">
      <div class="col-sm-12">
        <div style="background-color: #F1F1F1; height: 30px;">
          <div v-bind:style="{backgroundColor: 'blue', width: selectedEpic.spPercentage + '%', color: 'white', padding: '2px', height: '100%'}">{{selectedEpic.spPercentage}} % <small>({{selectedEpic.notYetEsimated}} not yet estimated)</small></div>
        </div>
      </div>
    </div>
    <div v-if="epicSelected" class="row" style="margin-top: 20px">
      <div class="col-sm-12">
        <b-table hover :fields="tableFields" :items="selectedEpic.issues">
          <template slot="key" slot-scope="data">
            <a v-bind:href="'https://atlassian.persgroep.net/jira/browse/' + data.item.key">{{data.item.key}}</a>
          </template>
        </b-table>
      </div>
    </div>
  </div>

</template>

<script>
  /* eslint-disable */

  import axios from 'axios'

  export default {
    name: 'epics',
    data ()  {
      return {
        epics: [],
        epicsAll: {},
        epicSelected: "",
        selectedEpic: "",
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
            key: 'realStatus',
            label: 'Status'
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
        ]
      }
    },
    created () {
      this.updateEpic()
    },
    methods: {
      fetchEpics () {
        this.$http.get(this.$base + "/fetchEpics").then(response => { this.updateEpic })
      },
      updateEpic () {
        this.$http.get(this.$base + "/epics")
          .then(response => {
            this.epicsAll = response.data
            this.epics = response.data.map(item => {
              return {key: item.key, title: item.title}
            })
          })
      },
      changeEpic () {
        this.selectedEpic = this.epicsAll.filter(item => {
          return item.key == this.epicSelected
        })[0]

        var count = 0,
            lead = 0,
            spCompleted = 0,
            notYetEstimated = 0,
            withSp = 0,
            leadCompleted = 0


        this.selectedEpic.issues.map(item => {
          count += item.sp
          lead += parseFloat(item.lead)
          if (item.status == "Done" && item.sp != 0) {
            spCompleted += parseInt(item.sp)
            leadCompleted += parseFloat(item.lead)
          }
          if ((item.realStatus == "Backlog" || item.realStatus == "Awaiting Refinement") && item.sp == 0) {
            notYetEstimated++
          } else {
            withSp++
          }
        })

        this.selectedEpic.sp = count
        this.selectedEpic.lead = lead.toFixed(1)
        this.selectedEpic.spCompleted = spCompleted
        this.selectedEpic.notYetEsimated = notYetEstimated
        this.selectedEpic.estSP = ((count / withSp).toFixed(2) * notYetEstimated)
        this.selectedEpic.spPercentage = (((spCompleted) / (count + this.selectedEpic.estSP)) * 100).toFixed()
        this.selectedEpic.leadEst = ((leadCompleted / spCompleted) * (this.selectedEpic.estSP + count)).toFixed()

      }
    }
  }
</script>

