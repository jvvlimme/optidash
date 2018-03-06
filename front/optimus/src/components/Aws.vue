<template>
  <div class="container">
    <div class="row">
      <div class="col-sm-3" style="max-height: 200px; margin-bottom: 10px">
        <div class="card text-white mb-3 bg-dark" style="max-width: 20rem;">
          <div class="card-header">AWS spend MtD</div>
          <div class="card-body">
            <div class="card-text">
              <h1>{{aws.mtd}}</h1><br/>
            </div>
          </div>
        </div>
      </div>
      <div class="col-sm-3" style="max-height: 200px; margin-bottom: 10px">
        <div class="card text-white mb-3 bg-dark" style="max-width: 20rem;">
          <div class="card-header">Forecast</div>
          <div class="card-body">
            <div class="card-text">
              <h1>{{aws.forecast}}</h1>({{aws.last}} last month)
            </div>
          </div>
        </div>
      </div>
      <div class="col-sm-3" style="max-height: 200px; margin-bottom: 10px">
        <div class="card text-white mb-3 bg-dark" style="max-width: 20rem;">
          <div class="card-header">Possible Savings</div>
          <div class="card-body">
            <div class="card-text">
              <h1>{{aws.savings.totalSavings}}</h1><br />
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="row">
      <div class="col-md-6">
        <h2>Cost per Service</h2>
        <pie-chart :data="chartData"></pie-chart>
      </div>
      <div class="col-md-6">
        <h2>Potential Saving Suggestions</h2>
        <ul>
          <li v-for="item in aws.savings.improvements">{{item.name}} ($ {{item.savings}})</li>
        </ul>
      </div>
    </div>
  </div>
</template>
<script>
  /* eslint-disable */

  export default {
    name: 'aws',
    data () {
      return {
        aws: {},
        chartData: []
      }
    },
    created () {
      this.$http
        .get(this.$base+"/aws")
        .then(response => {
          this.aws = response.data
          var x = Array(), y = Array()
          this.aws.services.forEach(function(service) {
            x = Array(service.name, parseFloat(service.cost))
            y.push(x);
          })
          this.chartData = y
        })
    }
  }

</script>
