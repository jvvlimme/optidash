<template>
  <div>
    <p>
      <b-input class="videoBox" v-model="videoId"></b-input>
    </p>
    <p>
      <el-date-picker
        v-model="sprintDates"
        type="daterange"
        range-separator="To"
        start-placeholder="Start date"
        end-placeholder="End date">
      </el-date-picker>
    </p>
    <div class="row">
      <div class="col-md-9">
        <youtube :video-id="videoId" :player-vars="{autoplay: 1}" @ready="ready"></youtube>
      </div>
      <div class="col-md-3">
        <b-form-group>
          <b-button @click="addItem" variant="primary">Create marker</b-button>
        </b-form-group>
        <b-form-group>
          <b-form-input class="col-md4" v-model="videoItem.title"
                        type="text"
                        placeholder="Title"></b-form-input>
        </b-form-group>
        <b-form-group>
          <b-form-textarea class="" style="width: 200px" id="textarea1"
                           v-model="videoItem.description"
                           placeholder="Enter something"
                           :rows="3"
                           :max-rows="6">
          </b-form-textarea>
        </b-form-group>
        <b-form-group>
          <b-button @click="getTime" variant="success">Add Demo Item</b-button>
        </b-form-group>
          <b-form-group>
            <b-button @click="getFutureTime" variant="success">Add Future Item</b-button>
          </b-form-group>
      </div>
    </div>
    <div class="row">
      <div class="col-md-8">
        <b-table striped hover :items="videoItems">
          <template slot="title" slot-scope="row">
            <a :href="'https://www.youtube.com/watch?v='+ videoId + '&t=' +row.item.time" target="_blank">{{row.item.title}}</a>
          </template>
        </b-table>
      </div>
    </div>
    <div class="row">
      <div class="col-md-12">
        <textarea name="" id="editor" cols="30" rows="10" v-model="mdEditor"></textarea>
        <p><b>Optimus Sprint Demo (<span v-for="(d, index) in sprintDates">{{d | moment('DD/MM/YYYY')}} <span v-if="index !=sprintDates.length - 1 "> - </span></span>)</b></p>
        <p></p>
        <p>Beste Collega's</p>
        <p><b>Wat is er nieuw?</b></p>
        <p>
        <ul>
          <li v-for="item in videoItems"><a :href="'https://www.youtube.com/watch?v='+ videoId + '&t=' +item.time" target="_blank">{{item.title}}</a><br />{{item.description}}</li>
        </ul>
        </p>
        <p>
          <b>Waar werken we volgende 2 weken aan?</b>
        <p>
        <ul>
          <li v-for="item in futureItems"><a :href="'https://www.youtube.com/watch?v='+ videoId + '&t=' +item.time" target="_blank">{{item.title}}</a><br />{{item.description}}</li>
        </ul>
        </p>
        <p>
          <b>Links</b>
          <br><br>
          <a :href="'https://www.youtube.com/watch?v='+ videoId">Volledig Demo</a><br>
          <a href="https://atlassian.persgroep.net/confluence/display/PEC/Optimus+Squad+Mission+Board+3.0">Mission Board</a>
        </p>
        <p>
            Wij hopen je te mogen verwelkomen op onze volgende demo.<br><br>
          Stuur deze mail gerust door naar mogelijke geïntereseerden
        </p>
        <p>
          Vriendelijke groeten,<br><br>
          Jan van Vlimmeren<br>
          Product Owner Optimus Squad

        </p>
        <b-form-group>
          <b-button @click="sendMail" variant="primary">Send Sprint Mail</b-button>
        </b-form-group>
      </div>
    </div>
  </div>
</template>
<script>
  export default {
    name: 'Video',
    data () {
      return {
        videoId: 'c7Q9gob-onQ',
        sprintDates: null,
        player: null,
        futureItems: [],
        videoItem: {
          time: '',
          title: '',
          description: ''
        },
        videoItems: [],
        mdEditor: ''
      }
    },
    methods: {
      mounted () {
        this.videoId = 'dlL8TaBOp3M'
      },
      ready (player) {
        this.player = player
      },
      clearVideoItem () {
        this.videoItem = {
          time: '',
          title: '',
          description: ''
        }
      },
      getTime () {
        this.videoItems.push(this.videoItem)
        this.clearVideoItem()
        this.player.playVideo()
      },
      getFutureTime () {
        this.futureItems.push(this.videoItem)
        this.clearVideoItem()
        this.player.playVideo()
      },
      addItem () {
        this.player.pauseVideo()
        this.videoItem.time = Math.round(this.player.getCurrentTime())
        console.log(this.videoItem)
      },
      sendMail () {
        var x = {}
        x.videoItems = this.videoItems
        x.futureItems = this.futureItems
        this.$http(this.$base + '/sprintmail', x).then(response => {
          console.log(response)
        })
      }
    }
  }
</script>

<style>
  textarea {
    width: 300px;
  }

  .videoBox {
    margin-bottom: 20px;
  }
</style>
