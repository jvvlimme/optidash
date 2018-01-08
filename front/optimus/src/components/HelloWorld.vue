<template>
    <div class="container">
        <div class="row">
            <div class="col-sm-12">
                <h3>Ongoing</h3>
            </div>
            <div class="col-sm-3" v-for="item in types" style="max-height: 200px; margin-bottom: 10px">
                <div class="card text-white mb-3 bg-dark" style="max-width: 20rem;">
                    <div class="card-header">{{item.key}}</div>
                    <div class="card-body">
                        <h1 class="card-title">{{item.count}}</h1>
                        <div class="card-text">
                            Lead: {{item.lead}} days
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="row">
            <b-table hover :fields="tableFields" :items="issues">
                <template slot="key" slot-scope="data">
                    <a v-bind:href="'https://atlassian.persgroep.net/jira/browse/' + data.item.key">{{data.item.key}}</a>
                </template>
            </b-table>
        </div>
      <div class="row">
        <div class="col-md-3">
          <div class="card mb-3 bg-light" style="max-width: 20rem;">
            <div class="card-header">SP Delivered so far</div>
            <div class="card-body">
              <h1 class="card-title">{{spcurrent}}</h1>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card mb-3 bg-light" style="max-width: 20rem;">
            <div class="card-header">SP Ongoing</div>
            <div class="card-body">
              <h1 class="card-title">{{sp}}</h1>
            </div>
          </div>
        </div>
      </div>
    </div>
</template>

<script>
    /* eslint-disable */
    import axios from 'axios'
    export default {
        name: 'HelloWorld',
        data () {
            return {
                issues: [],
                types: {},
                spcurrent: 0,
                sp: 0,
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
                        key: 'lead',
                        label: 'Lead Time',
                        sortable: true
                    }
                ]
            }
        },
        created () {
            axios
                    .get(this.$base + '/ongoing')
                    .then(response => {
                        this.issues = response.data.issues
                        var x = {}
                        this.types = response.data.types
                        this.sp = response.data.sp.total
                    })

            axios
              .get(this.$base + '/current')
              .then(response => {
                this.spcurrent = response.data.sp.total
              })
        }

    }
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
    h1, h2 {
        font-weight: normal;
    }

    ul {
        list-style-type: none;
        padding: 0;
    }

    li {
        display: inline-block;
        margin: 0 10px;
    }

    a {
        color: #42b983;
    }
</style>
